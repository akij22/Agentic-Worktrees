import type { Stats } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { validateCapabilityStaticDescriptor, type CapabilityStaticDescriptor } from "@agentic-worktrees/capability-sdk";
import type { ManagedPackageInstallationRecord } from "../../shared/packages/schemas";
import type { ManagedPackageLayout } from "../packages/storage-layout";
import { ManagedPackageRepository } from "../packages/package-repository";
import { digestPackageTree } from "../packages/content-digest";
import { readContainedJson } from "../packages/bounded-file-reader";
import { permissionDigest } from "./catalog";

export interface InstalledCapabilityEntry { record: ManagedPackageInstallationRecord; descriptor: CapabilityStaticDescriptor; manifestRelativePath: string; entryRelativePath: string }
export interface InstalledCatalogTestHooks { afterFirstDigest?: (record: ManagedPackageInstallationRecord) => Promise<void> }
const POINTER_MAX_BYTES = 64 * 1024; const MANIFEST_MAX_BYTES = 256 * 1024; const FAIL = "package_install_failed";
interface Pointer { packageName: string; capabilityId: string; version: string; integrity: string; contentDigest: string; manifestPath: string; entryPath: string }
const POINTER_FIELDS = ["capabilityId", "contentDigest", "entryPath", "integrity", "manifestPath", "packageName", "version"];
function deepFreeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); } return value; }
function safeRelativePath(value: unknown): value is string { return typeof value === "string" && value.length > 0 && !value.includes("\0") && !isAbsolute(value) && !/^[A-Za-z]:[\\/]/.test(value) && !value.startsWith("\\\\") && !value.replace(/\\/g, "/").split("/").includes("..") && !value.includes("\\"); }
function contained(root: string, candidate: string): boolean { const rel = relative(root, candidate); return !!rel && !rel.startsWith("..") && !isAbsolute(rel); }
function sameNode(left: Stats, right: Stats, directory: boolean): boolean { return (directory ? left.isDirectory() && right.isDirectory() : left.isFile() && right.isFile()) && !left.isSymbolicLink() && !right.isSymbolicLink() && left.dev === right.dev && left.ino === right.ino; }
async function checkedNode(path: string, managedRoot: string, directory: boolean): Promise<{ stat: Stats; real: string }> {
  const stat = await lstat(path); if (!sameNode(stat, stat, directory)) throw new Error(FAIL);
  const real = await realpath(path); const rootReal = await realpath(managedRoot); if (!contained(rootReal, real) || real !== resolve(path)) throw new Error(FAIL);
  return { stat, real };
}
function pointer(value: unknown): Pointer {
  if (!value || typeof value !== "object" || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(POINTER_FIELDS)) throw new Error(FAIL);
  const candidate = value as Record<string, unknown>;
  if (!["packageName", "capabilityId", "version", "integrity", "contentDigest"].every(key => typeof candidate[key] === "string" && candidate[key] !== "") || !safeRelativePath(candidate.manifestPath) || !safeRelativePath(candidate.entryPath)) throw new Error(FAIL);
  return candidate as unknown as Pointer;
}

export class InstalledCapabilityCatalog {
  private snapshot: readonly InstalledCapabilityEntry[] = Object.freeze([]); private refreshQueue: Promise<void> = Promise.resolve();
  constructor(private readonly layout: ManagedPackageLayout, private readonly repository = new ManagedPackageRepository(), private readonly hooks: InstalledCatalogTestHooks = {}) {}
  list(): readonly InstalledCapabilityEntry[] { return this.snapshot; }
  get(capabilityId: string, version?: string): InstalledCapabilityEntry | undefined { return this.snapshot.find(entry => entry.record.itemId === capabilityId && (version === undefined || entry.record.activeVersion === version)); }
  refresh(): Promise<void> { const run = this.refreshQueue.then(() => this.refreshNow()); this.refreshQueue = run.catch(() => undefined); return run; }
  private async refreshNow(): Promise<void> {
    const next: InstalledCapabilityEntry[] = [];
    try {
      for (const record of this.repository.list("capability")) {
        if (record.state !== "installed" || !record.activeVersion || !record.activeIntegrity || !record.activeContentDigest) continue;
        const pointerPath = `${this.layout.activePointerPath(record.itemId)}.json`;
        const activePointer = pointer(await readContainedJson(this.layout.root, pointerPath, POINTER_MAX_BYTES));
        if (activePointer.packageName !== record.packageName || activePointer.capabilityId !== record.itemId || activePointer.version !== record.activeVersion || activePointer.integrity !== record.activeIntegrity || activePointer.contentDigest !== record.activeContentDigest) throw new Error(FAIL);
        const packageRoot = this.layout.packageVersionRoot(record.itemId, record.activeVersion); const rootBefore = await checkedNode(packageRoot, this.layout.root, true);
        const manifestPath = resolve(packageRoot, activePointer.manifestPath), entryPath = resolve(packageRoot, activePointer.entryPath);
        if (!contained(packageRoot, manifestPath) || !contained(packageRoot, entryPath)) throw new Error(FAIL);
        const manifestBefore = await checkedNode(manifestPath, packageRoot, false); const entryBefore = await checkedNode(entryPath, packageRoot, false);
        const firstDigest = await digestPackageTree(packageRoot); await this.hooks.afterFirstDigest?.(record);
        const descriptor = validateCapabilityStaticDescriptor(await readContainedJson(packageRoot, manifestPath, MANIFEST_MAX_BYTES));
        const secondDigest = await digestPackageTree(packageRoot);
        const rootAfter = await checkedNode(packageRoot, this.layout.root, true), manifestAfter = await checkedNode(manifestPath, packageRoot, false), entryAfter = await checkedNode(entryPath, packageRoot, false);
        if (!sameNode(rootBefore.stat, rootAfter.stat, true) || rootBefore.real !== rootAfter.real || !sameNode(manifestBefore.stat, manifestAfter.stat, false) || manifestBefore.real !== manifestAfter.real || !sameNode(entryBefore.stat, entryAfter.stat, false) || entryBefore.real !== entryAfter.real || firstDigest !== secondDigest || secondDigest !== record.activeContentDigest || secondDigest !== activePointer.contentDigest || descriptor.manifest.id !== record.itemId || descriptor.manifest.version !== record.activeVersion || (record.acceptedPermissionDigest && permissionDigest(descriptor.manifest) !== record.acceptedPermissionDigest)) throw new Error(FAIL);
        next.push(deepFreeze({ record: deepFreeze({ ...record }), descriptor: deepFreeze(descriptor), manifestRelativePath: activePointer.manifestPath, entryRelativePath: activePointer.entryPath }));
      }
      next.sort((left, right) => Buffer.compare(Buffer.from(left.record.itemId), Buffer.from(right.record.itemId)) || Buffer.compare(Buffer.from(left.record.activeVersion ?? ""), Buffer.from(right.record.activeVersion ?? "")));
      this.snapshot = deepFreeze(next);
    } catch (cause) { throw new Error(FAIL, { cause }); }
  }
}
