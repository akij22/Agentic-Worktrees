import { randomUUID } from "node:crypto";
import {
  capabilityDetailSchema,
  type CapabilitySummaryDto,
  type CapabilityDetailDto,
} from "../../shared/capabilities/schemas";
import {
  capabilityPackageInspectionSchema,
  capabilityDistributionProgressSchema,
  packageErrorCodeSchema,
  packageInspectRequestSchema,
  packageInstallRequestSchema,
  type CapabilityPackageInspectionDto,
  type CapabilityDistributionProgress,
  type PackageErrorCode,
  type PackageInspectRequest,
  type PackageInstallRequest,
} from "../../shared/packages/schemas";
import {
  NpmPackageAcquirer,
  type StagedNpmPackage,
} from "../packages/npm-acquirer";
import {
  CapabilityPackageInspector,
  type InspectedCapabilityPackage,
} from "./package-inspector";
import type { CapabilityPackageVerifier } from "./package-verifier";
import { CapabilityPackageInstaller } from "./capability-package-installer";
import { ManagedPackageRepository } from "../packages/package-repository";
import type { ManagedPackageLayout } from "../packages/storage-layout";
import { OfficialCatalogService } from "../packages/catalog/official-catalog";
import { PackageLock } from "../packages/package-lock";
import { CapabilityRepository } from "./capability-repository";
import {
  ConsentLeaseRegistry,
  type ConsentLeaseScheduler,
} from "./consent-lease-registry";
import { getSqlite } from "../database/client";

const detail = (
  inspected: InspectedCapabilityPackage,
  configured: boolean,
): CapabilityDetailDto => {
  const m = inspected.descriptor.manifest;
  return capabilityDetailSchema.parse({
    ...m,
    settings: Object.entries(m.settings ?? {}).map(([key, setting]) => ({
      key,
      ...setting,
    })),
    state: configured ? "ready" : "needs_setup",
    secretConfigured: configured,
    installationState: "installed",
    source: "npm",
    packageName: inspected.staged.packageName,
    trust: inspected.trust,
    reviewStatus: inspected.reviewStatus,
    activeRunCount: 0,
    providedTools: inspected.descriptor.tools.map((t) => t.name),
    permissionDigest: inspected.permissionDigest,
  });
};

export class CapabilityDistributionService {
  private readonly listeners = new Set<
    (event: CapabilityDistributionProgress) => void
  >();
  private readonly repository: ManagedPackageRepository;
  private readonly capabilityRepository: CapabilityRepository;
  private readonly lock: PackageLock;
  private readonly registry: ConsentLeaseRegistry;
  private readonly acquirer: NpmPackageAcquirer;
  private readonly inspector: CapabilityPackageInspector;
  private readonly installer: CapabilityPackageInstaller;
  constructor(
    private readonly deps: {
      layout: ManagedPackageLayout;
      acquirer?: NpmPackageAcquirer;
      inspector?: CapabilityPackageInspector;
      verifier: CapabilityPackageVerifier;
      installer?: CapabilityPackageInstaller;
      repository?: ManagedPackageRepository;
      capabilityRepository?: CapabilityRepository;
      officialCatalog?: OfficialCatalogService;
      packageLock?: PackageLock;
      clock?: () => number;
      scheduler?: ConsentLeaseScheduler;
    },
  ) {
    this.repository = deps.repository ?? new ManagedPackageRepository();
    this.capabilityRepository =
      deps.capabilityRepository ?? new CapabilityRepository(getSqlite());
    this.lock =
      deps.packageLock ?? new PackageLock(deps.layout.root + "/.packages.lock");
    this.acquirer = deps.acquirer ?? new NpmPackageAcquirer(deps.layout);
    this.inspector = deps.inspector ?? new CapabilityPackageInspector();
    this.installer =
      deps.installer ??
      new CapabilityPackageInstaller(
        deps.layout,
        this.repository,
        this.capabilityRepository,
        <T>(work: () => T) => getSqlite().transaction(work)(),
      );
    this.registry = new ConsentLeaseRegistry({
      lock: this.lock,
      clock: deps.clock ?? Date.now,
      scheduler: deps.scheduler ?? { setTimeout, clearTimeout },
    });
  }
  subscribe(
    listener: (event: CapabilityDistributionProgress) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(
    operationId: string,
    stage: CapabilityDistributionProgress["stage"],
    status: CapabilityDistributionProgress["status"],
    extra: Partial<CapabilityDistributionProgress> = {},
  ) {
    const event = Object.freeze(
      capabilityDistributionProgressSchema.parse({
        operationId,
        action: "install",
        stage,
        status,
        updatedAt: new Date().toISOString(),
        ...extra,
      }),
    );
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* observers are isolated */
      }
    }
  }
  async listMarketplaceCapabilities(): Promise<CapabilitySummaryDto[]> {
    return [];
  }
  async getInstalledCapability(
    _packageName: string,
  ): Promise<CapabilityDetailDto> {
    throw new Error("package_not_found");
  }
  async inspect(
    input: PackageInspectRequest,
  ): Promise<CapabilityPackageInspectionDto> {
    const request = packageInspectRequestSchema.parse(input);
    const id = randomUUID();
    const controller = new AbortController();
    let inspectedForAccept: InspectedCapabilityPackage | undefined;
    let operationCreated = false;
    const coded = (error: unknown, fallback: PackageErrorCode): Error => {
      const candidate = error instanceof Error ? error.message : undefined;
      const parsed = packageErrorCodeSchema.safeParse(candidate);
      return new Error(parsed.success ? parsed.data : fallback);
    };
    const lease = this.registry.start<
      StagedNpmPackage,
      CapabilityPackageInspectionDto,
      PackageInstallRequest,
      CapabilityDetailDto
    >({
      operationId: id,
      acquire: async () => {
        this.repository.beginOperation({
          operationId: id,
          action: "install",
          stage: "resolving",
          requestedSpec: request.sourceSpec,
        });
        operationCreated = true;
        try {
          return await this.acquirer.acquire(
            id,
            request.sourceSpec,
            controller.signal,
            (stage) => this.emit(id, stage, "in_progress"),
          );
        } catch (error) {
          throw coded(error, "package_download_failed");
        }
      },
      inspect: async (staged, timing) => {
        const official = request.officialCapabilityId
          ? await (
              this.deps.officialCatalog ?? new OfficialCatalogService()
            ).findCapability(request.officialCapabilityId)
          : undefined;
        if (request.officialCapabilityId && !official)
          throw new Error("package_not_found");
        let inspected: InspectedCapabilityPackage;
        try {
          inspected = await this.inspector.inspect(
            staged,
            official
              ? {
                  trust: "official",
                  reviewStatus: "official-reviewed",
                  officialEntry: official,
                }
              : { trust: "community", reviewStatus: "unreviewed" },
          );
        } catch (error) {
          throw coded(error, "package_manifest_invalid");
        }
        inspectedForAccept = inspected;
        if (
          this.repository.getByPackageName(staged.packageName) ||
          this.repository.getByItemId(
            "capability",
            inspected.descriptor.manifest.id,
          )
        )
          throw new Error("package_blocked");
        this.repository.markAwaitingConsent(id, {
          packageName: staged.packageName,
          version: staged.resolvedVersion,
          integrity: staged.integrity,
          contentDigest: staged.contentDigest,
        });
        const dto = capabilityPackageInspectionSchema.parse({
          inspectionId: id,
          packageName: staged.packageName,
          requestedSpec: staged.requestedSpec,
          resolvedVersion: staged.resolvedVersion,
          integrity: staged.integrity,
          contentDigest: staged.contentDigest,
          trust: inspected.trust,
          reviewStatus: inspected.reviewStatus,
          releaseNotes: official?.releaseNotes ?? "",
          capability: detail(inspected, false),
          permissionDigest: inspected.permissionDigest,
          expiresAt: new Date(timing.expiresAt).toISOString(),
        });
        this.emit(id, "verifying", "awaiting_consent", {
          packageName: staged.packageName,
          capabilityId: inspected.descriptor.manifest.id,
        });
        return Object.freeze(dto);
      },
      onCancel: () => controller.abort(new Error("package_cancelled")),
      accept: async (payload, staged, owner) => {
        if (
          !inspectedForAccept ||
          payload.acceptedPackageName !== staged.packageName ||
          payload.acceptedVersion !== staged.resolvedVersion ||
          payload.acceptedIntegrity !== staged.integrity ||
          payload.acceptedPermissionDigest !==
            inspectedForAccept.permissionDigest
        )
          throw new Error("package_permission_denied");
        const found = inspectedForAccept;
        try {
          owner.assertHealthy();
        } catch {
          throw new Error("package_busy");
        }
        owner.setPhase?.("verifying");
        let verification;
        try {
          verification = await this.deps.verifier.verify(
            found,
            controller.signal,
          );
        } catch (error) {
          throw coded(error, "package_verification_failed");
        }
        try {
          owner.assertHealthy();
        } catch {
          throw new Error("package_busy");
        }
        if (
          verification.capabilityId !== found.descriptor.manifest.id ||
          verification.version !== found.descriptor.manifest.version ||
          verification.contentDigest !== found.staged.contentDigest ||
          verification.toolNames.length !== found.descriptor.tools.length ||
          verification.toolNames.some(
            (name, index) => name !== found.descriptor.tools[index]?.name,
          )
        )
          throw new Error("package_verification_failed");
        owner.setPhase?.("committing");
        let record;
        try {
          record = await this.installer.commitFresh(found, verification);
        } catch (error) {
          throw coded(error, "package_install_failed");
        }
        const configured =
          record.state === "installed" &&
          Boolean(
            this.capabilityRepository.getInstallation(
              found.descriptor.manifest.id,
            )?.configured,
          );
        this.emit(id, "installing", "completed", {
          packageName: staged.packageName,
          capabilityId: found.descriptor.manifest.id,
        });
        return detail(found, configured);
      },
      terminal: (outcome) => {
        if (!operationCreated || outcome.reason === "completed") return;
        if (outcome.reason === "cancelled") this.repository.cancelOperation(id);
        else this.repository.failOperationCoherently(id, outcome.code);
        this.emit(
          id,
          inspectedForAccept ? "verifying" : "resolving",
          outcome.reason === "cancelled" ? "cancelled" : "failed",
          {
            ...(inspectedForAccept
              ? {
                  packageName: inspectedForAccept.staged.packageName,
                  capabilityId: inspectedForAccept.descriptor.manifest.id,
                }
              : {}),
            ...(outcome.reason !== "cancelled"
              ? { errorCode: outcome.code }
              : {}),
          },
        );
      },
      cleanup: () =>
        operationCreated ? this.acquirer.discard(id) : Promise.resolve(),
    });
    return lease.ready;
  }
  async install(input: PackageInstallRequest): Promise<CapabilityDetailDto> {
    return this.registry.accept(
      input.inspectionId,
      packageInstallRequestSchema.parse(input),
    );
  }
  async cancel(operationId: string) {
    return this.registry.cancel(operationId);
  }
  async reconcileInterruptedOperations() {
    return;
  }
}
