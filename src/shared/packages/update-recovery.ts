import { z } from "zod";
import { managedPackageStateSchema, packageErrorCodeSchema, packageNameSchema, packageReviewStatusSchema, packageSourceSpecSchema, packageTrustSchema } from "./schemas";

const identifier = z.string().min(1).max(256).regex(/^[a-zA-Z0-9_.:@-]+$/);
const metadata = z.string().min(1).max(1024).regex(/^[a-zA-Z0-9_.:+/=-]+$/);
const relativeFile = z.string().max(256).regex(/^\.\/(?:[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/);
export const updateRecoveryPointerSchema = z.object({
  packageName: packageNameSchema, capabilityId: identifier, version: identifier,
  integrity: metadata, contentDigest: metadata, manifestPath: relativeFile, entryPath: relativeFile,
}).strict();
const timestamp = z.number().int().nonnegative();
// Durable JSON contract: deliberately independent of Date-valued DB entities.
export const updateRecoveryInstallationSnapshotSchema = z.object({
  packageName: packageNameSchema, itemKind: z.literal("capability"), itemId: identifier,
  requestedSpec: packageSourceSpecSchema, activeVersion: identifier,
  activeIntegrity: metadata, activeContentDigest: metadata,
  trust: packageTrustSchema, reviewStatus: packageReviewStatusSchema,
  acceptedPermissionDigest: metadata.optional(), state: managedPackageStateSchema,
  errorCode: packageErrorCodeSchema.optional(), createdAt: timestamp, updatedAt: timestamp,
}).strict();
const configuration = z.object({
  capabilityId: identifier,
  installation: z.object({ capabilityId: identifier, version: identifier, permissionDigest: metadata, configured: z.boolean(), createdAt: timestamp, updatedAt: timestamp }).strict().optional(),
  settings: z.array(z.union([
    z.object({ key: identifier, secretRef: identifier }).strict(),
    z.object({ key: identifier, value: z.union([z.string().max(16384), z.number().finite(), z.boolean()]) }).strict(),
  ])).max(1000),
}).strict();
const session = z.object({
  id: identifier, runId: identifier, capabilityId: identifier, version: identifier,
  status: z.enum(["inactive", "pending_activation", "reloading", "active", "pending_deactivation", "activation_failed"]),
  errorCode: identifier.optional(), activatedAt: timestamp.optional(), deactivatedAt: timestamp.optional(), createdAt: timestamp, updatedAt: timestamp,
}).strict();
export const updateRecoverySchema = z.object({
  operationId: identifier, ownerToken: identifier, packageName: packageNameSchema, capabilityId: identifier,
  stage: z.enum(["prepared", "committed", "recovering", "conflict", "cleanup_pending"]),
  previousPointer: updateRecoveryPointerSchema, candidatePointer: updateRecoveryPointerSchema,
  previousInstallation: updateRecoveryInstallationSnapshotSchema,
  configuration, sessions: z.array(session), obsoleteSecretRefs: z.array(identifier), errorCode: packageErrorCodeSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if ([value.previousPointer, value.candidatePointer].some((p) => p.packageName !== value.packageName || p.capabilityId !== value.capabilityId) || value.previousInstallation.packageName !== value.packageName || value.previousInstallation.itemId !== value.capabilityId || value.configuration.capabilityId !== value.capabilityId || value.sessions.some((s) => s.capabilityId !== value.capabilityId) || value.previousInstallation.activeVersion !== value.previousPointer.version || value.previousInstallation.activeIntegrity !== value.previousPointer.integrity || value.previousInstallation.activeContentDigest !== value.previousPointer.contentDigest)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Recovery identity mismatch" });
});
export type UpdateRecovery = z.infer<typeof updateRecoverySchema>;
