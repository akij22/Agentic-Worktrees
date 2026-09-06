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

function safeError(error: unknown, fallback: string): Error {
  const parsed = packageErrorCodeSchema.safeParse(error instanceof Error ? error.message : undefined);
  const code = parsed.success ? parsed.data : fallback;
  const safe = Object.assign(new Error(code), { code });
  safe.stack = undefined;
  return Object.freeze(safe);
}

async function safeBoundary<T>(work: () => T | Promise<T>, fallback: string): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw safeError(error, fallback);
  }
}

function safeEvent<T>(work: () => T, fallback: string): T {
  try {
    return work();
  } catch (error) {
    throw safeError(error, fallback);
  }
}

export function createMarketplaceHandlers(
  distribution: CapabilityDistributionService,
  skills: Pick<SkillService, "listSkills">,
) {
  return {
    list: (raw: unknown) => safeBoundary(async () => {
      marketplaceListRequestSchema.parse(raw ?? {});
      const capabilities = await distribution.listMarketplaceCapabilities();
      const skillItems = skills.listSkills();
      return marketplaceItemSchema.array().parse([
        ...capabilities.map((capability) => ({ kind: "capability" as const, capability })),
        ...skillSummarySchema.array().parse(skillItems).map((skill) => ({ kind: "skill" as const, skill })),
      ]);
    }, "package_sync_failed"),
    inspect: (raw: unknown) => safeBoundary(async () => {
      const request = packageInspectRequestSchema.parse(raw);
      return capabilityPackageInspectionSchema.parse(await distribution.inspect(request));
    }, "package_source_invalid"),
    install: (raw: unknown) => safeBoundary(async () => {
      const request = packageInstallRequestSchema.parse(raw);
      return capabilityDetailSchema.parse(await distribution.install(request));
    }, "package_install_failed"),
    checkUpdates: (raw: unknown) => safeBoundary(async () => {
      const request = marketplaceCheckUpdatesRequestSchema.parse(raw ?? {});
      return capabilityUpdateSchema.array().parse(await distribution.checkForUpdates(request.packageName));
    }, "package_download_failed"),
    update: (raw: unknown) => safeBoundary(async () => {
      const request = packageUpdateRequestSchema.parse(raw);
      return capabilityDetailSchema.parse(await distribution.update(request));
    }, "package_update_failed"),
    inspectRemoval: (raw: unknown) => safeBoundary(async () => {
      const request = packageRemovalInspectRequestSchema.parse(raw);
      return capabilityRemovalInspectionSchema.parse(await distribution.inspectRemoval(request));
    }, "package_remove_failed"),
    remove: (raw: unknown) => safeBoundary(async () => {
      const request = packageRemoveRequestSchema.parse(raw);
      await distribution.remove(request);
    }, "package_remove_failed"),
    cancel: (raw: unknown) => safeBoundary(async () => {
      const request = marketplaceCancelRequestSchema.parse(raw);
      await distribution.cancel(request.operationId);
    }, "package_sync_failed"),
    retryPendingMigrations: (raw: unknown) => safeBoundary(async () => {
      marketplaceRetryMigrationsRequestSchema.parse(raw ?? {});
      await distribution.retryPendingMigrations();
    }, "package_sync_failed"),
    event: (raw: unknown) => safeEvent(
      () => capabilityDistributionProgressSchema.parse(raw),
      "package_sync_failed",
    ),
  };
}
