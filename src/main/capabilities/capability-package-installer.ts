import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import type { InspectedCapabilityPackage } from "./package-inspector";
import type { CapabilityExecutableVerification } from "./package-verifier";
import type { ManagedPackageInstallationRecord } from "../../shared/packages/schemas";
import { ManagedPackageRepository } from "../packages/package-repository";
import { digestPackageTree } from "../packages/content-digest";
import type { ManagedPackageLayout } from "../packages/storage-layout";
import type { CapabilityRepository } from "./capability-repository";

export class CapabilityPackageInstaller {
  constructor(private readonly layout: ManagedPackageLayout, private readonly repository: ManagedPackageRepository, private readonly capabilityRepository: CapabilityRepository, private readonly runInTransaction: <T>(work: () => T) => T, private readonly hooks: { verifyCommittedPath?: (path: string, expectedDigest: string) => Promise<void>; refreshCatalog?: () => Promise<void> } = {}) {}
  async commitFresh(inspected: InspectedCapabilityPackage, verification: CapabilityExecutableVerification): Promise<ManagedPackageInstallationRecord> {
    const s = inspected.staged;
    const capabilityId = inspected.descriptor.manifest.id;
    const destination = this.layout.packageVersionRoot(capabilityId, s.resolvedVersion);
    const pointer = `${this.layout.activePointerPath(capabilityId)}.json`;
    const temp = `${pointer}.${process.pid}.tmp`;
    let previousPointer: Buffer | undefined;
    let previousInstallation: ManagedPackageInstallationRecord | undefined;
    let previousConfiguration: ReturnType<CapabilityRepository["snapshotInstalledConfiguration"]> | undefined;
    let moved = false;
    let destinationExisted = false;
    // Kept for journal diagnostics: compensation intentionally does not restore a completed operation.
    let operationSnapshot: ReturnType<ManagedPackageRepository["snapshotOperation"]>;
    try {
      operationSnapshot = this.repository.snapshotOperation(s.operationId);
      if (verification.contentDigest !== s.contentDigest || verification.capabilityId !== capabilityId || verification.version !== s.resolvedVersion) throw new Error("package_verification_failed");
      await mkdir(destination.replace(/\/[^/]*$/, ""), { recursive: true, mode: 0o700 });
      const existing = await stat(destination).catch(() => undefined);
      destinationExisted = Boolean(existing);
      previousPointer = await readFile(pointer).catch(() => undefined);
      previousInstallation = this.repository.getByPackageName(s.packageName);
      previousConfiguration = this.capabilityRepository.snapshotInstalledConfiguration(capabilityId);
      if (existing) {
        if ((await digestPackageTree(destination)) !== s.contentDigest) throw new Error("package_install_failed");
      } else { await rename(s.packageRoot, destination); moved = true; }
      if ((await digestPackageTree(destination)) !== s.contentDigest) throw new Error("package_verification_failed");
      await this.hooks.verifyCommittedPath?.(destination, s.contentDigest);
      const data = { packageName: s.packageName, capabilityId, version: s.resolvedVersion, integrity: s.integrity, contentDigest: s.contentDigest, manifestPath: inspected.packageMetadata.manifest, entryPath: inspected.packageMetadata.entry };
      await mkdir(this.layout.activeRoot, { recursive: true, mode: 0o700 });
      await writeFile(temp, JSON.stringify(data), { mode: 0o600 });
      await rename(temp, pointer);
      const record = this.runInTransaction(() => {
        this.capabilityRepository.initializeInstalledConfiguration(inspected.descriptor.manifest, inspected.permissionDigest);
        return this.repository.commitInstallation(s.operationId, { packageName: s.packageName, itemKind: "capability", itemId: capabilityId, requestedSpec: s.requestedSpec, activeVersion: s.resolvedVersion, activeIntegrity: s.integrity, activeContentDigest: s.contentDigest, trust: inspected.trust, reviewStatus: inspected.reviewStatus, permissionDigest: inspected.permissionDigest, state: "installed" });
      });
      await this.hooks.refreshCatalog?.();
      return record;
    } catch (cause) {
      try { this.runInTransaction(() => {
        this.repository.restoreInstallation(s.packageName, previousInstallation);
        this.capabilityRepository.restoreInstalledConfiguration(previousConfiguration ?? { capabilityId, installation: undefined, settings: [] });
        this.repository.failOperationCoherently(s.operationId, "package_install_failed");
      }); } catch { /* preserve stable public error and continue filesystem compensation */ }
      try { if (previousPointer !== undefined) await writeFile(pointer, previousPointer, { mode: 0o600 }); else await rm(pointer, { force: true }); } catch { /* idempotent compensation */ }
      await rm(temp, { force: true }).catch(() => undefined);
      if (moved && !destinationExisted) await rm(destination, { recursive: true, force: true }).catch(() => undefined);
      const message = cause instanceof Error && cause.message === "package_verification_failed" ? "package_verification_failed" : "package_install_failed";
      throw new Error(message);
    }
  }
}
