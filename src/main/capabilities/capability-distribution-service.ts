import { randomUUID } from "node:crypto";
import type { CapabilitySummaryDto, CapabilityDetailDto } from "../../shared/capabilities/schemas";
import type { CapabilityPackageInspectionDto, CapabilityDistributionProgress, PackageInspectRequest, PackageInstallRequest } from "../../shared/packages/schemas";
import { NpmPackageAcquirer } from "../packages/npm-acquirer";
import { CapabilityPackageInspector, type InspectedCapabilityPackage } from "./package-inspector";
import type { CapabilityPackageVerifier } from "./package-verifier";
import { CapabilityPackageInstaller } from "./capability-package-installer";
import { ManagedPackageRepository } from "../packages/package-repository";
import type { ManagedPackageLayout } from "../packages/storage-layout";
import { OfficialCatalogService } from "../packages/catalog/official-catalog";
import { PackageLock } from "../packages/package-lock";

export class CapabilityDistributionService {
  private readonly listeners = new Set<(event: CapabilityDistributionProgress) => void>();
  private readonly inspections = new Map<string, { inspected: InspectedCapabilityPackage; expires: number }>();
  private busy = false;
  constructor(private readonly deps: { layout: ManagedPackageLayout; acquirer?: NpmPackageAcquirer; inspector?: CapabilityPackageInspector; verifier: CapabilityPackageVerifier; installer?: CapabilityPackageInstaller; repository?: ManagedPackageRepository; officialCatalog?: OfficialCatalogService; packageLock?: PackageLock }) {
    this.acquirer = deps.acquirer ?? new NpmPackageAcquirer(deps.layout); this.inspector = deps.inspector ?? new CapabilityPackageInspector(); this.installer = deps.installer ?? new CapabilityPackageInstaller(deps.layout, deps.repository);
  }
  private acquirer: NpmPackageAcquirer; private inspector: CapabilityPackageInspector; private installer: CapabilityPackageInstaller;
  subscribe(listener: (event: CapabilityDistributionProgress) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit(operationId: string, stage: CapabilityDistributionProgress["stage"], status: CapabilityDistributionProgress["status"], extra: Partial<CapabilityDistributionProgress> = {}) { const event = { operationId, action: "install" as const, stage, status, updatedAt: new Date().toISOString(), ...extra }; for (const listener of this.listeners) listener(event); }
  async listMarketplaceCapabilities(): Promise<CapabilitySummaryDto[]> { return []; }
  async getInstalledCapability(_packageName: string): Promise<CapabilityDetailDto> { throw new Error("package_not_found"); }
  async inspect(input: PackageInspectRequest): Promise<CapabilityPackageInspectionDto> {
    if (this.busy) throw new Error("package_busy"); this.busy = true;
    const id = randomUUID(), controller = new AbortController();
    try {
      const staged = await (this.deps.packageLock ?? new PackageLock(this.deps.layout.root + "/.packages.lock")).runExclusive(() => this.acquirer.acquire(id, input.sourceSpec, controller.signal, stage => this.emit(id, stage, "in_progress")));
      const official = input.officialCapabilityId ? await (this.deps.officialCatalog ?? new OfficialCatalogService()).findCapability(input.officialCapabilityId) : undefined;
      const inspected = await this.inspector.inspect(staged, official ? { trust: "official", reviewStatus: "official-reviewed", officialEntry: official } : { trust: "community", reviewStatus: "unreviewed" });
      this.inspections.set(id, { inspected, expires: Date.now() + 900_000 }); this.busy = false;
      return { inspectionId: id, packageName: staged.packageName, requestedSpec: staged.requestedSpec, resolvedVersion: staged.resolvedVersion, integrity: staged.integrity, contentDigest: staged.contentDigest, trust: inspected.trust, reviewStatus: inspected.reviewStatus, releaseNotes: official?.releaseNotes ?? "", capability: inspected.descriptor as unknown as CapabilityDetailDto, permissionDigest: inspected.permissionDigest, expiresAt: new Date(Date.now() + 900_000).toISOString() };
    } catch (e) { this.busy = false; await this.acquirer.discard(id); throw e; }
  }
  async install(input: PackageInstallRequest): Promise<CapabilityDetailDto> {
    if (this.busy) throw new Error("package_busy"); const found = this.inspections.get(input.inspectionId); if (!found || found.expires < Date.now()) throw new Error("package_permission_denied");
    if (input.acceptedPackageName !== found.inspected.staged.packageName || input.acceptedVersion !== found.inspected.staged.resolvedVersion || input.acceptedIntegrity !== found.inspected.staged.integrity || input.acceptedPermissionDigest !== found.inspected.permissionDigest) throw new Error("package_permission_denied");
    this.busy = true; try { const result = await (this.deps.packageLock ?? new PackageLock(this.deps.layout.root + "/.packages.lock")).runExclusive(async () => { const verification = await this.deps.verifier.verify(found.inspected, new AbortController().signal); return this.installer.commitFresh(found.inspected, verification); }); const record = await result; this.inspections.delete(input.inspectionId); this.busy = false; return { ...found.inspected.descriptor as unknown as CapabilityDetailDto, source: "npm", state: record.state === "installed" ? "ready" : "needs_setup" }; } finally { this.busy = false; }
  }
  async cancel(operationId: string) { this.inspections.delete(operationId); await this.acquirer.discard(operationId); }
  async reconcileInterruptedOperations() { return; }
}
