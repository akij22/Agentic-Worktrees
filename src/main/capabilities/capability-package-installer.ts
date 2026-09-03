import { mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname } from "node:path";
import type { InspectedCapabilityPackage } from "./package-inspector";
import type { CapabilityExecutableVerification } from "./package-verifier";
import type { ManagedPackageInstallationRecord, PackageOperationRecord } from "../../shared/packages/schemas";
import { ManagedPackageRepository } from "../packages/package-repository";
import { digestPackageTree } from "../packages/content-digest";
import type { ManagedPackageLayout } from "../packages/storage-layout";
import type { CapabilityRepository, InstalledConfigurationSnapshot } from "./capability-repository";

function isEnoent(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"; }
function directorySyncUnsupported(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && ["EINVAL", "ENOTSUP", "EISDIR"].includes(String(error.code)); }

export interface InstallerFileSystem {
  mkdir(path: string, options: { recursive: true; mode: number }): Promise<unknown>;
  rename(from: string, to: string): Promise<void>;
  readFile(path: string): Promise<Buffer>;
  stat(path: string): ReturnType<typeof stat>;
  open(path: string, flags: string, mode?: number): Promise<FileHandle>;
  writeFile(path: string, data: string | Buffer, options?: { mode: number }): Promise<void>;
  rm(path: string, options: { force: true; recursive?: true }): Promise<void>;
}

const realFileSystem: InstallerFileSystem = { mkdir, rename, readFile: (path) => readFile(path), stat, open, writeFile, rm };
export interface InstallerHooks {
  verifyCommittedPath?: (path: string, expectedDigest: string) => Promise<void>;
  refreshCatalog?: () => Promise<void>;
  fs?: InstallerFileSystem;
  logger?: (code: "package_install_cleanup_failed") => void;
}

export class CapabilityPackageInstaller {
  constructor(private readonly layout: ManagedPackageLayout, private readonly repository: ManagedPackageRepository, private readonly capabilityRepository: CapabilityRepository, private readonly runInTransaction: <T>(work: () => T) => T, private readonly hooks: InstallerHooks = {}) {}
  async commitFresh(inspected: InspectedCapabilityPackage, verification: CapabilityExecutableVerification): Promise<ManagedPackageInstallationRecord> {
    const fs = this.hooks.fs ?? realFileSystem; const s = inspected.staged; const capabilityId = inspected.descriptor.manifest.id;
    const destination = this.layout.packageVersionRoot(capabilityId, s.resolvedVersion); const pointer = `${this.layout.activePointerPath(capabilityId)}.json`; const temp = `${pointer}.${process.pid}.tmp`;
    let snapshotsComplete = false; let operationSnapshot: PackageOperationRecord | undefined; let previousPointer: Buffer | undefined;
    let previousInstallation: ManagedPackageInstallationRecord | undefined; let previousConfiguration: InstalledConfigurationSnapshot | undefined;
    let destinationExisted = false; let destinationDigest: string | undefined; let destinationOwnedByAttempt = false;
    const readOptional = async (path: string) => { try { return await fs.readFile(path); } catch (error) { if (isEnoent(error)) return undefined; throw error; } };
    const statOptional = async (path: string) => { try { return await fs.stat(path); } catch (error) { if (isEnoent(error)) return undefined; throw error; } };
    try {
      operationSnapshot = this.repository.snapshotOperation(s.operationId); if (!operationSnapshot) throw new Error("package_install_failed");
      if (verification.contentDigest !== s.contentDigest || verification.capabilityId !== capabilityId || verification.version !== s.resolvedVersion) throw new Error("package_verification_failed");
      previousInstallation = this.repository.getByPackageName(s.packageName); previousConfiguration = this.capabilityRepository.snapshotInstalledConfiguration(capabilityId);
      const existing = await statOptional(destination); destinationExisted = existing !== undefined; if (existing) destinationDigest = await digestPackageTree(destination);
      previousPointer = await readOptional(pointer); snapshotsComplete = true;
      if (destinationExisted) { if (destinationDigest !== s.contentDigest) throw new Error("package_install_failed"); }
      else { await fs.mkdir(dirname(destination), { recursive: true, mode: 0o700 }); await fs.rename(s.packageRoot, destination); destinationOwnedByAttempt = true; }
      if ((await digestPackageTree(destination)) !== s.contentDigest) throw new Error("package_verification_failed");
      await this.hooks.verifyCommittedPath?.(destination, s.contentDigest);
      const data = { packageName: s.packageName, capabilityId, version: s.resolvedVersion, integrity: s.integrity, contentDigest: s.contentDigest, manifestPath: inspected.packageMetadata.manifest, entryPath: inspected.packageMetadata.entry };
      await fs.mkdir(this.layout.activeRoot, { recursive: true, mode: 0o700 });
      const file = await fs.open(temp, "w", 0o600); try { await file.writeFile(JSON.stringify(data)); await file.sync(); } finally { await file.close(); }
      await fs.rename(temp, pointer);
      const directory = await fs.open(dirname(pointer), "r"); try { try { await directory.sync(); } catch (error) { if (!directorySyncUnsupported(error)) throw error; } } finally { await directory.close(); }
      const record = this.runInTransaction(() => { this.capabilityRepository.initializeInstalledConfiguration(inspected.descriptor.manifest, inspected.permissionDigest); return this.repository.commitInstallation(s.operationId, { packageName: s.packageName, itemKind: "capability", itemId: capabilityId, requestedSpec: s.requestedSpec, activeVersion: s.resolvedVersion, activeIntegrity: s.integrity, activeContentDigest: s.contentDigest, trust: inspected.trust, reviewStatus: inspected.reviewStatus, permissionDigest: inspected.permissionDigest, state: "installed" }); });
      await this.hooks.refreshCatalog?.(); return record;
    } catch (cause) {
      const expected = { operationId: s.operationId, packageName: s.packageName, requestedSpec: s.requestedSpec }; let cleanupFailed = false;
      if (!snapshotsComplete) { if (operationSnapshot) { try { this.repository.compensateFailedInstall(operationSnapshot, expected, "package_install_failed"); } catch { cleanupFailed = true; } } }
      else if (operationSnapshot && previousConfiguration) {
        try { this.runInTransaction(() => { this.repository.restoreInstallation(s.packageName, previousInstallation); this.capabilityRepository.restoreInstalledConfiguration(previousConfiguration!); this.repository.compensateFailedInstall(operationSnapshot!, expected, "package_install_failed"); }); } catch { cleanupFailed = true; }
        try { if (previousPointer !== undefined) await fs.writeFile(pointer, previousPointer, { mode: 0o600 }); else await fs.rm(pointer, { force: true }); } catch { cleanupFailed = true; }
        try { await fs.rm(temp, { force: true }); } catch { cleanupFailed = true; }
        if (destinationOwnedByAttempt) { try { await fs.rm(destination, { recursive: true, force: true }); } catch { cleanupFailed = true; } }
      }
      if (cleanupFailed && operationSnapshot) {
        try { this.runInTransaction(() => { this.repository.markInstallationInvalid({ packageName: s.packageName, itemKind: "capability", itemId: capabilityId, requestedSpec: s.requestedSpec, activeVersion: s.resolvedVersion, activeIntegrity: s.integrity, activeContentDigest: s.contentDigest, trust: inspected.trust, reviewStatus: inspected.reviewStatus, permissionDigest: inspected.permissionDigest, state: "invalid" }, "package_install_failed"); this.repository.failOperationCoherently(s.operationId, "package_install_failed"); }); } catch { /* startup reconciliation still has the original operation */ }
        (this.hooks.logger ?? ((code) => console.error(code)))("package_install_cleanup_failed");
      }
      const message = cause instanceof Error && cause.message === "package_verification_failed" ? "package_verification_failed" : "package_install_failed"; throw new Error(message);
    }
  }
}
