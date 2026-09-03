import { randomUUID } from "node:crypto";
import { capabilityDetailSchema, type CapabilitySummaryDto, type CapabilityDetailDto } from "../../shared/capabilities/schemas";
import { capabilityPackageInspectionSchema, capabilityDistributionProgressSchema, packageInspectRequestSchema, packageInstallRequestSchema, type CapabilityPackageInspectionDto, type CapabilityDistributionProgress, type PackageInspectRequest, type PackageInstallRequest } from "../../shared/packages/schemas";
import { NpmPackageAcquirer, type StagedNpmPackage } from "../packages/npm-acquirer";
import { CapabilityPackageInspector, type InspectedCapabilityPackage } from "./package-inspector";
import type { CapabilityPackageVerifier } from "./package-verifier";
import { CapabilityPackageInstaller } from "./capability-package-installer";
import { ManagedPackageRepository } from "../packages/package-repository";
import type { ManagedPackageLayout } from "../packages/storage-layout";
import { OfficialCatalogService } from "../packages/catalog/official-catalog";
import { PackageLock } from "../packages/package-lock";
import { CapabilityRepository } from "./capability-repository";
import { ConsentLeaseRegistry, type ConsentLeaseScheduler } from "./consent-lease-registry";
import { getSqlite } from "../database/client";

const detail = (inspected: InspectedCapabilityPackage, configured: boolean): CapabilityDetailDto => {
  const m = inspected.descriptor.manifest;
  return capabilityDetailSchema.parse({ ...m, state: configured ? "ready" : "needs_setup", secretConfigured: configured, installationState: "installed", source: "npm", trust: inspected.trust, reviewStatus: inspected.reviewStatus, activeRunCount: 0, providedTools: inspected.descriptor.tools.map(t => t.name), permissionDigest: inspected.permissionDigest });
};

export class CapabilityDistributionService {
  private readonly listeners = new Set<(event: CapabilityDistributionProgress) => void>();
  private readonly repository: ManagedPackageRepository;
  private readonly capabilityRepository?: CapabilityRepository;
  private readonly lock: PackageLock;
  private readonly registry: ConsentLeaseRegistry;
  private readonly acquirer: NpmPackageAcquirer;
  private readonly inspector: CapabilityPackageInspector;
  private readonly installer: CapabilityPackageInstaller;
  constructor(private readonly deps: { layout: ManagedPackageLayout; acquirer?: NpmPackageAcquirer; inspector?: CapabilityPackageInspector; verifier: CapabilityPackageVerifier; installer?: CapabilityPackageInstaller; repository?: ManagedPackageRepository; officialCatalog?: OfficialCatalogService; packageLock?: PackageLock; clock?: () => number; scheduler?: ConsentLeaseScheduler }) {
    this.repository = deps.repository ?? new ManagedPackageRepository();
    this.lock = deps.packageLock ?? new PackageLock(deps.layout.root + "/.packages.lock"); this.acquirer = deps.acquirer ?? new NpmPackageAcquirer(deps.layout); this.inspector = deps.inspector ?? new CapabilityPackageInspector();
    if (deps.installer) this.installer = deps.installer;
    else { this.capabilityRepository = new CapabilityRepository(getSqlite()); this.installer = new CapabilityPackageInstaller(deps.layout, this.repository, this.capabilityRepository, <T>(work: () => T) => getSqlite().transaction(work)()); }
    this.registry = new ConsentLeaseRegistry({ lock: this.lock, clock: deps.clock ?? Date.now, scheduler: deps.scheduler ?? { setTimeout, clearTimeout } });
  }
  subscribe(listener: (event: CapabilityDistributionProgress) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit(operationId: string, stage: CapabilityDistributionProgress["stage"], status: CapabilityDistributionProgress["status"], extra: Partial<CapabilityDistributionProgress> = {}) {
    const event = Object.freeze(capabilityDistributionProgressSchema.parse({ operationId, action: "install", stage, status, updatedAt: new Date().toISOString(), ...extra }));
    for (const listener of this.listeners) { try { listener(event); } catch { /* observers are isolated */ } }
  }
  async listMarketplaceCapabilities(): Promise<CapabilitySummaryDto[]> { return []; }
  async getInstalledCapability(_packageName: string): Promise<CapabilityDetailDto> { throw new Error("package_not_found"); }
  async inspect(input: PackageInspectRequest): Promise<CapabilityPackageInspectionDto> {
    const request = packageInspectRequestSchema.parse(input); const id = randomUUID(); const controller = new AbortController(); let inspectedForAccept: InspectedCapabilityPackage | undefined;
    const lease = this.registry.start<StagedNpmPackage, CapabilityPackageInspectionDto, PackageInstallRequest, CapabilityDetailDto>({ operationId: id,
      acquire: async () => { this.repository.beginOperation({ operationId: id, action: "install", stage: "resolving", requestedSpec: request.sourceSpec }); return this.acquirer.acquire(id, request.sourceSpec, controller.signal, stage => this.emit(id, stage, "in_progress")); },
      inspect: async (staged, timing) => { const official = request.officialCapabilityId ? await (this.deps.officialCatalog ?? new OfficialCatalogService()).findCapability(request.officialCapabilityId) : undefined; if (request.officialCapabilityId && !official) throw new Error("package_not_found"); const inspected = await this.inspector.inspect(staged, official ? { trust: "official", reviewStatus: "official-reviewed", officialEntry: official } : { trust: "community", reviewStatus: "unreviewed" }); inspectedForAccept = inspected; if (this.repository.getByPackageName(staged.packageName) || this.repository.getByItemId("capability", inspected.descriptor.manifest.id)) throw new Error("package_install_failed"); this.repository.markAwaitingConsent(id, { packageName: staged.packageName, version: staged.resolvedVersion, integrity: staged.integrity, contentDigest: staged.contentDigest }); const dto = capabilityPackageInspectionSchema.parse({ inspectionId: id, packageName: staged.packageName, requestedSpec: staged.requestedSpec, resolvedVersion: staged.resolvedVersion, integrity: staged.integrity, contentDigest: staged.contentDigest, trust: inspected.trust, reviewStatus: inspected.reviewStatus, releaseNotes: official?.releaseNotes ?? "", capability: detail(inspected, false), permissionDigest: inspected.permissionDigest, expiresAt: new Date(timing.expiresAt).toISOString() }); this.emit(id, "verifying", "awaiting_consent", { packageName: staged.packageName, capabilityId: inspected.descriptor.manifest.id }); return Object.freeze(dto); },
      accept: async (payload, staged) => { if (!inspectedForAccept || payload.acceptedPackageName !== staged.packageName || payload.acceptedVersion !== staged.resolvedVersion || payload.acceptedIntegrity !== staged.integrity || payload.acceptedPermissionDigest !== inspectedForAccept.permissionDigest) throw new Error("package_permission_denied"); const found = inspectedForAccept; const verification = await this.deps.verifier.verify(found, controller.signal); const record = await this.installer.commitFresh(found, verification); this.emit(id, "installing", "completed", { packageName: staged.packageName, capabilityId: found.descriptor.manifest.id }); return detail(found, record.state === "installed" && Boolean(this.capabilityRepository?.getInstallation(found.descriptor.manifest.id)?.configured)); },
      cleanup: () => this.acquirer.discard(id),
    });
    return lease.ready;
  }
  async install(input: PackageInstallRequest): Promise<CapabilityDetailDto> { return this.registry.accept(input.inspectionId, packageInstallRequestSchema.parse(input)); }
  async cancel(operationId: string) { return this.registry.cancel(operationId); }
  async reconcileInterruptedOperations() { return; }
}
