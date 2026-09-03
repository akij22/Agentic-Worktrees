import { createHash } from "node:crypto";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { validateCapabilityStaticDescriptor, type CapabilityStaticDescriptor } from "@agentic-worktrees/capability-sdk";
import type { ManagedPackageInstallationRecord } from "../../shared/packages/schemas";
import type { ManagedPackageLayout } from "../packages/storage-layout";
import { ManagedPackageRepository } from "../packages/package-repository";
import { digestPackageTree } from "../packages/content-digest";

export interface InstalledCapabilityEntry { record: ManagedPackageInstallationRecord; descriptor: CapabilityStaticDescriptor; manifestRelativePath: string; entryRelativePath: string }
const MAX_METADATA = 256 * 1024;
const FAIL = "package_install_failed";
interface Pointer { packageName: string; capabilityId: string; version: string; integrity: string; contentDigest: string; manifestPath: string; entryPath: string }
function deepFreeze<T>(v: T): T { if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); for (const child of Object.values(v as Record<string, unknown>)) deepFreeze(child); } return v; }
function relativePath(value: unknown): value is string { return typeof value === "string" && value.length > 0 && !value.includes("\0") && !isAbsolute(value) && !/^[A-Za-z]:[\\/]/.test(value) && !value.startsWith("\\\\") && !value.replace(/\\/g, "/").split("/").includes("..") && !value.includes("\\"); }
async function boundedJson(path: string, root: string): Promise<unknown> {
  const rootReal = await realpath(root); const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size > MAX_METADATA) throw new Error(FAIL);
  const canonical = await realpath(path); const rel = relative(rootReal, canonical);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error(FAIL);
  const h = await open(path, "r"); try { const s = await h.stat(); if (s.size > MAX_METADATA) throw new Error(FAIL); const b = Buffer.alloc(MAX_METADATA + 1); let n = 0; while (n < b.length) { const r = await h.read(b, n, b.length-n, n); if (!r.bytesRead) break; n += r.bytesRead; } if (n > MAX_METADATA) throw new Error(FAIL); return JSON.parse(b.subarray(0,n).toString()); } finally { await h.close(); }
}
function permissionDigest(d: CapabilityStaticDescriptor): string { return createHash("sha256").update(JSON.stringify({ permissions: d.manifest.permissions, version: d.manifest.version })).digest("hex"); }

export class InstalledCapabilityCatalog {
  private snapshot: readonly InstalledCapabilityEntry[] = Object.freeze([]);
  private refreshQueue: Promise<void> = Promise.resolve();
  constructor(private readonly layout: ManagedPackageLayout, private readonly repository = new ManagedPackageRepository()) {}
  list(): readonly InstalledCapabilityEntry[] { return this.snapshot; }
  get(capabilityId: string, version?: string): InstalledCapabilityEntry | undefined { return this.snapshot.find(x => x.record.itemId === capabilityId && (version === undefined || x.record.activeVersion === version)); }
  refresh(): Promise<void> { const run = this.refreshQueue.then(() => this.refreshNow()); this.refreshQueue = run.catch(() => undefined); return run; }
  private async refreshNow(): Promise<void> {
    const next: InstalledCapabilityEntry[] = [];
    try {
      for (const record of this.repository.list("capability")) {
        if (record.state !== "installed" || !record.activeVersion || !record.activeIntegrity || !record.activeContentDigest) continue;
        const pointerFile = `${this.layout.activePointerPath(record.itemId)}.json`;
        const raw = await boundedJson(pointerFile, this.layout.root);
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(FAIL);
        const keys = Object.keys(raw).sort(); const expected = ["capabilityId","contentDigest","entryPath","integrity","manifestPath","packageName","version"].sort();
        if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new Error(FAIL);
        const p = raw as Pointer;
        if (p.capabilityId !== record.itemId || p.packageName !== record.packageName || p.version !== record.activeVersion || p.integrity !== record.activeIntegrity || p.contentDigest !== record.activeContentDigest || !relativePath(p.manifestPath) || !relativePath(p.entryPath)) throw new Error(FAIL);
        const root = this.layout.packageVersionRoot(record.itemId, record.activeVersion); const rootReal = await realpath(root); if (rootReal !== root) throw new Error(FAIL);
        const manifest = resolve(root, p.manifestPath), entry = resolve(root, p.entryPath); this.layout.assertManagedPath(manifest); this.layout.assertManagedPath(entry);
        const entryStat = await lstat(entry); if (!entryStat.isFile() || entryStat.isSymbolicLink()) throw new Error(FAIL);
        const descriptor = validateCapabilityStaticDescriptor(await boundedJson(manifest, root));
        if (descriptor.manifest.id !== record.itemId || descriptor.manifest.version !== record.activeVersion || (record.acceptedPermissionDigest && permissionDigest(descriptor) !== record.acceptedPermissionDigest) || await digestPackageTree(root) !== record.activeContentDigest) throw new Error(FAIL);
        next.push(deepFreeze({ record: deepFreeze({ ...record }), descriptor: deepFreeze(descriptor), manifestRelativePath: p.manifestPath, entryRelativePath: p.entryPath }));
      }
    } catch (cause) { throw new Error(FAIL, { cause }); }
    next.sort((a,b) => a.record.itemId.localeCompare(b.record.itemId) || (a.record.activeVersion ?? "").localeCompare(b.record.activeVersion ?? "")); this.snapshot = deepFreeze(next);
  }
}
