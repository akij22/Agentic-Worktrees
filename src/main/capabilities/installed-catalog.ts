import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { CapabilityStaticDescriptor } from "@agentic-worktrees/capability-sdk";
import type { ManagedPackageInstallationRecord } from "../../shared/packages/schemas";
import type { ManagedPackageLayout } from "../packages/storage-layout";
import { ManagedPackageRepository } from "../packages/package-repository";

export interface InstalledCapabilityEntry { record: ManagedPackageInstallationRecord; descriptor: CapabilityStaticDescriptor; manifestRelativePath: string; entryRelativePath: string }
interface Pointer { packageName: string; version: string; integrity: string; digest: string; manifestPath: string; entryPath: string }
export class InstalledCapabilityCatalog {
  private snapshot: readonly InstalledCapabilityEntry[] = Object.freeze([]);
  constructor(private readonly layout: ManagedPackageLayout, private readonly repository = new ManagedPackageRepository(), private readonly descriptors = new Map<string, CapabilityStaticDescriptor>()) {}
  list(): readonly InstalledCapabilityEntry[] { return this.snapshot }
  get(capabilityId: string, version?: string) { return this.snapshot.find(x => x.record.itemId === capabilityId && (!version || x.record.activeVersion === version)); }
  async refresh(): Promise<void> {
    const next: InstalledCapabilityEntry[] = [];
    for (const record of this.repository.list("capability")) {
      if (record.state !== "installed" || !record.activeVersion || !record.activeIntegrity || !record.activeContentDigest) continue;
      const pointerPath = `${this.layout.activePointerPath(record.itemId)}.json`;
      const pointer = JSON.parse(await readFile(pointerPath, "utf8")) as Pointer;
      if (pointer.packageName !== record.packageName || pointer.version !== record.activeVersion || pointer.integrity !== record.activeIntegrity || pointer.digest !== record.activeContentDigest) throw new Error("package_install_failed");
      const root = this.layout.packageVersionRoot(record.itemId, record.activeVersion);
      const manifest = resolve(root, pointer.manifestPath), entry = resolve(root, pointer.entryPath);
      this.layout.assertManagedPath(manifest); this.layout.assertManagedPath(entry); await stat(manifest); await stat(entry);
      const descriptor = this.descriptors.get(record.itemId); if (!descriptor) continue;
      next.push({ record, descriptor, manifestRelativePath: pointer.manifestPath, entryRelativePath: pointer.entryPath });
    }
    this.snapshot = Object.freeze(next);
  }
}
