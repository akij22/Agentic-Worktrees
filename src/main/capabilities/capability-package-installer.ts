import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { InspectedCapabilityPackage } from "./package-inspector";
import type { CapabilityExecutableVerification } from "./package-verifier";
import type { ManagedPackageInstallationRecord, PackageOperationRecord } from "../../shared/packages/schemas";
import { ManagedPackageRepository } from "../packages/package-repository";
import { digestPackageTree } from "../packages/content-digest";
import type { ManagedPackageLayout } from "../packages/storage-layout";
import type { CapabilityRepository, InstalledConfigurationSnapshot } from "./capability-repository";

function isEnoent(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function readOptional(path: string): Promise<Buffer | undefined> {
  try { return await readFile(path); } catch (error) { if (isEnoent(error)) return undefined; throw error; }
}

async function statOptional(path: string): Promise<Awaited<ReturnType<typeof stat>> | undefined> {
  try { return await stat(path); } catch (error) { if (isEnoent(error)) return undefined; throw error; }
}

export class CapabilityPackageInstaller {
  constructor(private readonly layout: ManagedPackageLayout, private readonly repository: ManagedPackageRepository, private readonly capabilityRepository: CapabilityRepository, private readonly runInTransaction: <T>(work: () => T) => T, private readonly hooks: { verifyCommittedPath?: (path: string, expectedDigest: string) => Promise<void>; refreshCatalog?: () => Promise<void> } = {}) {}
  async commitFresh(inspected: InspectedCapabilityPackage, verification: CapabilityExecutableVerification): Promise<ManagedPackageInstallationRecord> {
    const s = inspected.staged;
    const capabilityId = inspected.descriptor.manifest.id;
    const destination = this.layout.packageVersionRoot(capabilityId, s.resolvedVersion);
    const pointer = `${this.layout.activePointerPath(capabilityId)}.json`;
    const temp = `${pointer}.${process.pid}.tmp`;
    let snapshotsComplete = false;
    let operationSnapshot: PackageOperationRecord | undefined;
    let previousPointer: Buffer | undefined;
    let previousInstallation: ManagedPackageInstallationRecord | undefined;
    let previousConfiguration: InstalledConfigurationSnapshot | undefined;
    let destinationExisted = false;
    let destinationDigest: string | undefined;
    let destinationOwnedByAttempt = false;

    try {
      // Journal acquisition is strictly read-only. No target directory, pointer, or
      // database row is changed until every snapshot below has been acquired.
      operationSnapshot = this.repository.snapshotOperation(s.operationId);
      if (!operationSnapshot) throw new Error("package_install_failed");
      if (verification.contentDigest !== s.contentDigest || verification.capabilityId !== capabilityId || verification.version !== s.resolvedVersion) throw new Error("package_verification_failed");
      previousInstallation = this.repository.getByPackageName(s.packageName);
      previousConfiguration = this.capabilityRepository.snapshotInstalledConfiguration(capabilityId);
      const existing = await statOptional(destination);
      destinationExisted = existing !== undefined;
      if (existing) destinationDigest = await digestPackageTree(destination);
      previousPointer = await readOptional(pointer);
      snapshotsComplete = true;

      if (destinationExisted) {
        if (destinationDigest !== s.contentDigest) throw new Error("package_install_failed");
      } else {
        await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
        await rename(s.packageRoot, destination);
        destinationOwnedByAttempt = true;
      }
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
      const expected = { operationId: s.operationId, packageName: s.packageName, requestedSpec: s.requestedSpec };
      if (!snapshotsComplete) {
        if (operationSnapshot) {
          try { this.repository.compensateFailedInstall(operationSnapshot, expected, "package_install_failed"); } catch { /* preserve the path-free public failure */ }
        }
      } else if (operationSnapshot && previousConfiguration) {
        const acquiredOperation = operationSnapshot;
        const acquiredConfiguration = previousConfiguration;
        try {
          this.runInTransaction(() => {
            this.repository.restoreInstallation(s.packageName, previousInstallation);
            this.capabilityRepository.restoreInstalledConfiguration(acquiredConfiguration);
            this.repository.compensateFailedInstall(acquiredOperation, expected, "package_install_failed");
          });
        } catch { /* preserve stable public error and continue filesystem compensation */ }
        try { if (previousPointer !== undefined) await writeFile(pointer, previousPointer, { mode: 0o600 }); else await rm(pointer, { force: true }); } catch { /* retry-safe compensation */ }
        await rm(temp, { force: true }).catch(() => undefined);
        if (destinationOwnedByAttempt) await rm(destination, { recursive: true, force: true }).catch(() => undefined);
      }
      const message = cause instanceof Error && cause.message === "package_verification_failed" ? "package_verification_failed" : "package_install_failed";
      throw new Error(message);
    }
  }
}
