import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { InspectedCapabilityPackage } from "./package-inspector";
import type { CapabilityExecutableVerification } from "./package-verifier";
import type { ManagedPackageInstallationRecord } from "../../shared/packages/schemas";
import { ManagedPackageRepository } from "../packages/package-repository";
import type { ManagedPackageLayout } from "../packages/storage-layout";

export class CapabilityPackageInstaller {
  constructor(private readonly layout: ManagedPackageLayout, private readonly repository = new ManagedPackageRepository()) {}
  async commitFresh(inspected: InspectedCapabilityPackage, verification: CapabilityExecutableVerification): Promise<ManagedPackageInstallationRecord> {
    const s = inspected.staged;
    if (verification.contentDigest !== s.contentDigest || verification.capabilityId !== inspected.descriptor.manifest.id || verification.version !== s.resolvedVersion) throw new Error("package_verification_failed");
    const destination = this.layout.packageVersionRoot(inspected.descriptor.manifest.id, s.resolvedVersion);
    const pointer = this.layout.activePointerPath(inspected.descriptor.manifest.id) + ".json";
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    const existing = await stat(destination).catch(() => undefined);
    if (existing) throw new Error("package_install_failed");
    await rename(s.packageRoot, destination);
    try {
      const digest = createHash("sha256").update(JSON.stringify(inspected.descriptor)).digest("hex");
      const data = { packageName: s.packageName, version: s.resolvedVersion, integrity: s.integrity, digest: s.contentDigest, manifestPath: inspected.packageMetadata.manifest, entryPath: inspected.packageMetadata.entry };
      const temp = `${pointer}.${process.pid}.tmp`;
      await mkdir(dirname(pointer), { recursive: true, mode: 0o700 }); await writeFile(temp, JSON.stringify(data), { mode: 0o600 }); await rename(temp, pointer);
      const record = this.repository.commitInstallation(s.operationId, { packageName: s.packageName, itemKind: "capability", itemId: inspected.descriptor.manifest.id, requestedSpec: s.requestedSpec, activeVersion: s.resolvedVersion, activeIntegrity: s.integrity, activeContentDigest: s.contentDigest, trust: inspected.trust, reviewStatus: inspected.reviewStatus, permissionDigest: inspected.permissionDigest, state: "installed" });
      void digest;
      return record;
    } catch (error) { await rm(pointer, { force: true }).catch(() => undefined); await rm(destination, { recursive: true, force: true }).catch(() => undefined); throw error; }
  }
}
