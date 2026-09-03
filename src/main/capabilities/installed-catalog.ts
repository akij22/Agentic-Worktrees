import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { validateCapabilityStaticDescriptor, type CapabilityStaticDescriptor } from "@agentic-worktrees/capability-sdk";
import type { ManagedPackageInstallationRecord } from "../../shared/packages/schemas";
import type { ManagedPackageLayout } from "../packages/storage-layout";
import { ManagedPackageRepository } from "../packages/package-repository";
import { digestPackageTree } from "../packages/content-digest";

export interface InstalledCapabilityEntry { record: ManagedPackageInstallationRecord; descriptor: CapabilityStaticDescriptor; manifestRelativePath: string; entryRelativePath: string }
interface Pointer { packageName: string; version: string; integrity: string; digest?: string; contentDigest?: string; manifestPath: string; entryPath: string }
const frozen = <T extends object>(value: T): T => Object.freeze(value);

export class InstalledCapabilityCatalog {
  private snapshot: readonly InstalledCapabilityEntry[] = Object.freeze([]);
  constructor(private readonly layout: ManagedPackageLayout, private readonly repository = new ManagedPackageRepository(), private readonly descriptors = new Map<string, CapabilityStaticDescriptor>()) {}
  list(): readonly InstalledCapabilityEntry[] { return this.snapshot }
  get(capabilityId: string, version?: string): InstalledCapabilityEntry | undefined { return this.snapshot.find(x => x.record.itemId === capabilityId && (!version || x.record.activeVersion === version)); }
  async refresh(): Promise<void> {
    const next: InstalledCapabilityEntry[] = [];
    for (const record of this.repository.list("capability")) {
      if (record.state !== "installed" || !record.activeVersion || !record.activeIntegrity || !record.activeContentDigest) continue;
      const pointerPath = `${this.layout.activePointerPath(record.itemId)}.json`;
      const pointer = JSON.parse(await readFile(pointerPath, "utf8")) as Pointer;
      const digest = pointer.contentDigest ?? pointer.digest;
      if (pointer.packageName !== record.packageName || pointer.version !== record.activeVersion || pointer.integrity !== record.activeIntegrity || digest !== record.activeContentDigest) throw new Error("package_install_failed");
      if (!pointer.manifestPath || !pointer.entryPath || pointer.manifestPath.includes("..") || pointer.entryPath.includes("..")) throw new Error("package_install_failed");
      const root = this.layout.packageVersionRoot(record.itemId, record.activeVersion);
      const manifest = resolve(root, pointer.manifestPath), entry = resolve(root, pointer.entryPath);
      this.layout.assertManagedPath(manifest); this.layout.assertManagedPath(entry);
      await stat(root); await stat(manifest); await stat(entry);
      if ((await digestPackageTree(root)) !== record.activeContentDigest) throw new Error("package_install_failed");
      const raw = JSON.parse(await readFile(manifest, "utf8"));
      const descriptor = validateCapabilityStaticDescriptor(raw);
      if (descriptor.manifest.id !== record.itemId || descriptor.manifest.version !== record.activeVersion) throw new Error("package_install_failed");
      if (record.acceptedPermissionDigest) {
        const permissionDigest = createHash("sha256").update(JSON.stringify({ permissions: descriptor.manifest.permissions, version: descriptor.manifest.version })).digest("hex");
        if (permissionDigest !== record.acceptedPermissionDigest) throw new Error("package_install_failed");
      }
      next.push({ record: frozen({ ...record }), descriptor: frozen(descriptor), manifestRelativePath: pointer.manifestPath, entryRelativePath: pointer.entryPath });
    }
    next.sort((a, b) => a.record.itemId.localeCompare(b.record.itemId) || (a.record.activeVersion ?? "").localeCompare(b.record.activeVersion ?? ""));
    this.snapshot = Object.freeze(next);
  }
}
