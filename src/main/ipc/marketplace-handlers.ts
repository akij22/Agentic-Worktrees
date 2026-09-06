import {
  capabilityDetailSchema,
  marketplaceCancelRequestSchema,
  marketplaceCheckUpdatesRequestSchema,
  marketplaceItemSchema,
  marketplaceListRequestSchema,
  marketplaceRetryMigrationsRequestSchema,
} from "../../shared/ipc/schemas";
import {
  capabilityDistributionProgressSchema,
  capabilityPackageInspectionSchema,
  capabilityRemovalInspectionSchema,
  capabilityUpdateSchema,
  packageErrorCodeSchema,
  packageInspectRequestSchema,
  packageInstallRequestSchema,
  packageRemovalInspectRequestSchema,
  packageRemoveRequestSchema,
  packageUpdateRequestSchema,
} from "../../shared/packages/schemas";
import { skillSummarySchema } from "../../shared/skills/schemas";
import type { CapabilityDistributionService } from "../capabilities/capability-distribution-service";
import type { SkillService } from "../skills/skill-service";

async function safeServiceCall<T>(work: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const code = packageErrorCodeSchema.safeParse(error instanceof Error ? error.message : undefined);
    throw new Error(code.success ? code.data : fallback);
  }
}

export function createMarketplaceHandlers(
  distribution: CapabilityDistributionService,
  skills: Pick<SkillService, "listSkills">,
) {
  return {
    async list(raw: unknown) {
      marketplaceListRequestSchema.parse(raw ?? {});
      const capabilities = await safeServiceCall(() => distribution.listMarketplaceCapabilities(), "package_sync_failed");
      const skillItems = skills.listSkills();
      return marketplaceItemSchema.array().parse([
        ...capabilities.map((capability) => ({ kind: "capability" as const, capability })),
        ...skillSummarySchema.array().parse(skillItems).map((skill) => ({ kind: "skill" as const, skill })),
      ]);
    },
    async inspect(raw: unknown) {
      const request = packageInspectRequestSchema.parse(raw);
      return capabilityPackageInspectionSchema.parse(await safeServiceCall(() => distribution.inspect(request), "package_download_failed"));
    },
    async install(raw: unknown) {
      const request = packageInstallRequestSchema.parse(raw);
      return capabilityDetailSchema.parse(await safeServiceCall(() => distribution.install(request), "package_install_failed"));
    },
    async checkUpdates(raw: unknown) {
      const request = marketplaceCheckUpdatesRequestSchema.parse(raw ?? {});
      return capabilityUpdateSchema.array().parse(await safeServiceCall(() => distribution.checkForUpdates(request.packageName), "package_download_failed"));
    },
    async update(raw: unknown) {
      const request = packageUpdateRequestSchema.parse(raw);
      return capabilityDetailSchema.parse(await safeServiceCall(() => distribution.update(request), "package_update_failed"));
    },
    async inspectRemoval(raw: unknown) {
      const request = packageRemovalInspectRequestSchema.parse(raw);
      return capabilityRemovalInspectionSchema.parse(await safeServiceCall(() => distribution.inspectRemoval(request), "package_remove_failed"));
    },
    async remove(raw: unknown) {
      const request = packageRemoveRequestSchema.parse(raw);
      await safeServiceCall(() => distribution.remove(request), "package_remove_failed");
    },
    async cancel(raw: unknown) {
      const request = marketplaceCancelRequestSchema.parse(raw);
      await safeServiceCall(() => distribution.cancel(request.operationId), "package_sync_failed");
    },
    async retryPendingMigrations(raw: unknown) {
      marketplaceRetryMigrationsRequestSchema.parse(raw ?? {});
      await safeServiceCall(() => distribution.retryPendingMigrations(), "package_sync_failed");
    },
    event(raw: unknown) {
      return capabilityDistributionProgressSchema.parse(raw);
    },
  };
}
