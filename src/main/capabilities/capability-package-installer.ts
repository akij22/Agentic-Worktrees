import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
    if (verification.contentDigest !== s.contentDigest || verification.capabilityId !== inspected.descriptor.manifest.id || verification.version !== s.resolvedVersion) throw new Error("package_verification_failed");
    const destination = this.layout.packageVersionRoot(inspected.descriptor.manifest.id, s.resolvedVersion);
    const pointer = this.layout.activePointerPath(inspected.descriptor.manifest.id) + ".json";
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    const existing = await stat(destination).catch(() => undefined);
    const moved = !existing;
    const previousPointer = await readFile(pointer).catch(() => undefined);
    const previousInstallation = this.repository.getByPackageName(s.packageName);
    const capabilityApi = this.capabilityRepository as CapabilityRepository & { snapshotInstalledConfiguration?: CapabilityRepository["snapshotInstalledConfiguration"]; restoreInstalledConfiguration?: CapabilityRepository["restoreInstalledConfiguration"] };
    const previousConfiguration = capabilityApi.snapshotInstalledConfiguration?.(inspected.descriptor.manifest.id);
    if (existing) {
      // Re-installing the exact immutable artifact is safe and idempotent.
      if ((await digestPackageTree(destination)) !== s.contentDigest) throw new Error("package_install_failed");
    } else await rename(s.packageRoot, destination);
    try {
      const actualDigest = await digestPackageTree(destination);
      if (actualDigest !== s.contentDigest) throw new Error("package_verification_failed");
      await this.hooks.verifyCommittedPath?.(destination, s.contentDigest);
      const data = { packageName: s.packageName, capabilityId: inspected.descriptor.manifest.id, version: s.resolvedVersion, integrity: s.integrity, contentDigest: s.contentDigest, manifestPath: inspected.packageMetadata.manifest, entryPath: inspected.packageMetadata.entry };
      const temp = `${pointer}.${process.pid}.tmp`;
      await mkdir(dirname(pointer), { recursive: true, mode: 0o700 }); await writeFile(temp, JSON.stringify(data), { mode: 0o600 }); await rename(temp, pointer);
      const record = this.runInTransaction(() => { this.capabilityRepository.initializeInstalledConfiguration(inspected.descriptor.manifest, inspected.permissionDigest); return this.repository.commitInstallation(s.operationId, { packageName: s.packageName, itemKind: "capability", itemId: inspected.descriptor.manifest.id, requestedSpec: s.requestedSpec, activeVersion: s.resolvedVersion, activeIntegrity: s.integrity, activeContentDigest: s.contentDigest, trust: inspected.trust, reviewStatus: inspected.reviewStatus, permissionDigest: inspected.permissionDigest, state: "installed" }); });
      await this.hooks.refreshCatalog?.();
      return record;
    } catch (error) {
      // Catalog refresh is outside the DB transaction, so restore the complete
      // pre-install state before making the operation retryable.
      await this.runInTransaction(() => {
        this.repository.restoreInstallation(s.packageName, previousInstallation);
        if (previousConfiguration && capabilityApi.restoreInstalledConfiguration) capabilityApi.restoreInstalledConfiguration(previousConfiguration);
        else if (capabilityApi.restoreInstalledConfiguration) capabilityApi.restoreInstalledConfiguration({ capabilityId: inspected.descriptor.manifest.id, installation: undefined, settings: [] });
        this.repository.failOperationCoherently(s.operationId, "package_install_failed");
      });
      if (previousPointer) await writeFile(pointer, previousPointer, { mode: 0o600 });
      else await rm(pointer, { force: true }).catch(() => undefined);
      await rm(`${pointer}.${process.pid}.tmp`, { force: true }).catch(() => undefined);
      if (moved) await rm(destination, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }
}
