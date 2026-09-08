import { z } from "zod";
import { packageNameSchema, packageErrorCodeSchema } from "./schemas";
import { recoveryConfigurationSchema, recoverySessionSchema, updateRecoveryInstallationSnapshotSchema, updateRecoveryPointerSchema } from "./update-recovery";
const segment = z.string().min(1).max(256).regex(/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/);
export const removalRecoverySchema = z.object({
  operationId: segment, ownerToken: segment, packageName: packageNameSchema, capabilityId: segment,
  stage: z.enum(["prepared", "detached", "committed", "cleanup_pending", "conflict"]),
  previousInstallation: updateRecoveryInstallationSnapshotSchema,
  pointerText: z.string().max(16384).refine((text) => { try { return updateRecoveryPointerSchema.safeParse(JSON.parse(text)).success; } catch { return false; } }),
  configuration: recoveryConfigurationSchema,
  sessions: z.array(recoverySessionSchema),
  gcVersions: z.array(z.object({ version: segment, contentDigest: z.string().regex(/^[a-f0-9]{64}$/) }).strict()),
  errorCode: packageErrorCodeSchema.optional(),
}).strict().superRefine((row, ctx) => {
  const parsed = (() => { try { return updateRecoveryPointerSchema.safeParse(JSON.parse(row.pointerText)); } catch { return undefined; } })();
  if (!parsed?.success || parsed.data.packageName !== row.packageName || parsed.data.capabilityId !== row.capabilityId || parsed.data.version !== row.previousInstallation.activeVersion || parsed.data.integrity !== row.previousInstallation.activeIntegrity || parsed.data.contentDigest !== row.previousInstallation.activeContentDigest || row.previousInstallation.packageName !== row.packageName || row.previousInstallation.itemId !== row.capabilityId || row.configuration.capabilityId !== row.capabilityId || row.sessions.some((session) => session.capabilityId !== row.capabilityId))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Removal recovery identity mismatch" });
});
export type RemovalRecovery = z.infer<typeof removalRecoverySchema>;
