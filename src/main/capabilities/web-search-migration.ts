import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { CapabilityStaticDescriptor } from "@agentic-worktrees/capability-sdk";
import fallbackCatalog from "../packages/catalog/official-catalog.fallback.json";
import type { NpmPackageAcquirer } from "../packages/npm-acquirer";
import type { OfficialCatalogService } from "../packages/catalog/official-catalog";
import type { PackageLock } from "../packages/package-lock";
import type { ManagedPackageRepository } from "../packages/package-repository";
import { permissionDigest } from "./catalog";
import type {
  CapabilityPackageInspector,
  InspectedCapabilityPackage,
} from "./package-inspector";
import type { CapabilityPackageInstaller } from "./capability-package-installer";
import type { CapabilityRepository } from "./capability-repository";
import type { CapabilityPackageVerifier } from "./package-verifier";

const reviewed = fallbackCatalog.entries.find(
  (entry) => entry.capabilityId === "agentic-worktrees.web-search",
);
if (!reviewed) throw new Error("web_search_migration_identity_missing");
const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};
const descriptor = deepFreeze(
  reviewed.descriptor as CapabilityStaticDescriptor,
);

export const WEB_SEARCH_MIGRATION = Object.freeze({
  capabilityId: "agentic-worktrees.web-search",
  packageName: "@agentic-worktrees/web-search",
  version: "0.1.0",
  requestedSpec: "@agentic-worktrees/web-search@0.1.0",
  descriptor,
  permissionDigest: permissionDigest(descriptor.manifest),
});

export type WebSearchMigrationResult =
  "not_needed" | "migrated" | "migration_pending";

export class WebSearchMigration {
  constructor(
    private readonly dependencies: {
      capabilities: CapabilityRepository;
      packages: ManagedPackageRepository;
      officialCatalog: Pick<OfficialCatalogService, "findCapability">;
      acquirer: Pick<NpmPackageAcquirer, "acquire" | "discard">;
      inspector: Pick<CapabilityPackageInspector, "inspect">;
      verifier: CapabilityPackageVerifier;
      installer: Pick<CapabilityPackageInstaller, "commitFresh">;
      lock: PackageLock;
    },
  ) {}

  async reconcile(signal: AbortSignal): Promise<WebSearchMigrationResult> {
    const legacy = this.dependencies.capabilities.getInstallation(
      WEB_SEARCH_MIGRATION.capabilityId,
    );
    const managed = this.dependencies.packages.getByPackageName(
      WEB_SEARCH_MIGRATION.packageName,
    );
    if (!legacy) return "not_needed";
    if (managed?.state === "installed") return "migrated";
    if (managed && managed.state !== "migration_pending")
      return this.pending(legacy.permissionDigest);
    return this.run(legacy.version, legacy.permissionDigest, signal);
  }

  async retry(
    signal: AbortSignal,
  ): Promise<Exclude<WebSearchMigrationResult, "not_needed">> {
    const legacy = this.dependencies.capabilities.getInstallation(
      WEB_SEARCH_MIGRATION.capabilityId,
    );
    const managed = this.dependencies.packages.getByPackageName(
      WEB_SEARCH_MIGRATION.packageName,
    );
    if (managed?.state === "installed") return "migrated";
    if (!legacy) return "migration_pending";
    return this.run(legacy.version, legacy.permissionDigest, signal);
  }

  private pending(permissionDigest?: string): "migration_pending" {
    this.dependencies.packages.saveMigrationPending({
      packageName: WEB_SEARCH_MIGRATION.packageName,
      itemKind: "capability",
      itemId: WEB_SEARCH_MIGRATION.capabilityId,
      requestedSpec: WEB_SEARCH_MIGRATION.requestedSpec,
      trust: "official",
      reviewStatus: "official-reviewed",
      permissionDigest,
    });
    return "migration_pending";
  }

  private async run(
    version: string,
    acceptedDigest: string,
    signal: AbortSignal,
  ): Promise<"migrated" | "migration_pending"> {
    if (
      version !== WEB_SEARCH_MIGRATION.version ||
      acceptedDigest !== WEB_SEARCH_MIGRATION.permissionDigest
    )
      return this.pending(acceptedDigest);
    const operationId = randomUUID();
    let operationCreated = false;
    try {
      return await this.dependencies.lock.runExclusive(async (owner) => {
        owner.assertHealthy();
        const official = await this.dependencies.officialCatalog.findCapability(
          WEB_SEARCH_MIGRATION.capabilityId,
        );
        if (
          !official ||
          official.packageName !== WEB_SEARCH_MIGRATION.packageName ||
          official.releaseSpec !== WEB_SEARCH_MIGRATION.version ||
          !isDeepStrictEqual(
            official.descriptor,
            WEB_SEARCH_MIGRATION.descriptor,
          )
        )
          return this.pending(acceptedDigest);
        this.dependencies.packages.beginOperation({
          operationId,
          action: "install",
          stage: "resolving",
          packageName: WEB_SEARCH_MIGRATION.packageName,
          requestedSpec: WEB_SEARCH_MIGRATION.requestedSpec,
        });
        operationCreated = true;
        const staged = await this.dependencies.acquirer.acquire(
          operationId,
          WEB_SEARCH_MIGRATION.requestedSpec,
          signal,
          () => undefined,
        );
        const inspected: InspectedCapabilityPackage =
          await this.dependencies.inspector.inspect(staged, {
            trust: "official",
            reviewStatus: "official-reviewed",
            officialEntry: official,
          });
        if (
          inspected.staged.packageName !== WEB_SEARCH_MIGRATION.packageName ||
          inspected.staged.resolvedVersion !== WEB_SEARCH_MIGRATION.version ||
          inspected.permissionDigest !==
            WEB_SEARCH_MIGRATION.permissionDigest ||
          !isDeepStrictEqual(
            inspected.descriptor,
            WEB_SEARCH_MIGRATION.descriptor,
          )
        )
          throw new Error("package_permission_denied");
        owner.assertHealthy();
        const verification = await this.dependencies.verifier.verify(
          inspected,
          signal,
        );
        owner.assertHealthy();
        if (
          verification.capabilityId !== WEB_SEARCH_MIGRATION.capabilityId ||
          verification.version !== WEB_SEARCH_MIGRATION.version ||
          verification.contentDigest !== inspected.staged.contentDigest ||
          verification.toolNames.length !== inspected.descriptor.tools.length ||
          verification.toolNames.some(
            (name, index) => name !== inspected.descriptor.tools[index]?.name,
          )
        )
          throw new Error("package_verification_failed");
        await this.dependencies.installer.commitFresh(
          inspected,
          verification,
          undefined,
          undefined,
          true,
        );
        return "migrated";
      });
    } catch {
      if (operationCreated)
        this.dependencies.packages.failOperationCoherently(
          operationId,
          "package_download_failed",
        );
      return this.pending(acceptedDigest);
    } finally {
      if (operationCreated)
        await this.dependencies.acquirer
          .discard(operationId)
          .catch(() => undefined);
    }
  }
}
