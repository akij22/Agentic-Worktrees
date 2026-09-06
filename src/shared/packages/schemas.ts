import { z } from "zod";
import {
	capabilityDetailSchema,
	capabilityInstallationStateSchema,
} from "../capabilities/schemas";
export { capabilityInstallationStateSchema } from "../capabilities/schemas";
export type { CapabilityInstallationStateDto } from "../capabilities/schemas";

export const packageItemKindSchema = z.enum(["capability", "skill"]);
export type PackageItemKind = z.infer<typeof packageItemKindSchema>;
export const packageTrustSchema = z.enum(["official", "community"]);
export type PackageTrust = z.infer<typeof packageTrustSchema>;
export const packageReviewStatusSchema = z.enum(["official-reviewed", "unreviewed"]);
export type PackageReviewStatus = z.infer<typeof packageReviewStatusSchema>;
export const managedPackageStateSchema = z.enum(["installed", "incompatible", "blocked", "invalid", "migration_pending"]);
export type ManagedPackageState = z.infer<typeof managedPackageStateSchema>;
export const packageOperationActionSchema = z.enum(["inspect", "install", "update", "remove", "migrate"]);
export type PackageOperationAction = z.infer<typeof packageOperationActionSchema>;
export const packageOperationStageSchema = z.enum(["resolving", "downloading", "verifying", "installing", "removing"]);
export type PackageOperationStage = z.infer<typeof packageOperationStageSchema>;
export const packageOperationStatusSchema = z.enum(["in_progress", "awaiting_consent", "completed", "failed", "cancelled"]);
export type PackageOperationStatus = z.infer<typeof packageOperationStatusSchema>;
export const packageErrorCodeSchema = z.enum([
	"package_not_found", "package_version_not_found", "package_source_invalid",
	"package_integrity_failed", "package_archive_invalid", "package_manifest_invalid",
	"package_kind_unsupported", "package_incompatible", "package_blocked",
	"package_permission_denied", "package_busy", "package_download_failed",
	"package_verification_failed", "package_install_failed", "package_update_failed",
	"package_remove_failed", "package_sync_failed",
]);
export type PackageErrorCode = z.infer<typeof packageErrorCodeSchema>;

export const packageNameSchema = z.string().trim().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/);
export const packageSourceSpecSchema = z.string().trim().refine((value) => {
	const match = /^(?:(@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*)|([a-z0-9][a-z0-9._-]*))(?:@([^\s/]+))?$/.exec(value);
	return Boolean(match && (match[1] || match[2]));
}, "Expected an npm registry package spec.");
const nonEmptyString = z.string().trim().min(1);

export const managedPackageInstallationRecordSchema = z.object({
	packageName: packageNameSchema, itemKind: packageItemKindSchema, itemId: nonEmptyString,
	requestedSpec: packageSourceSpecSchema, activeVersion: nonEmptyString.optional(),
	activeIntegrity: nonEmptyString.optional(), activeContentDigest: nonEmptyString.optional(),
	trust: packageTrustSchema, reviewStatus: packageReviewStatusSchema,
	acceptedPermissionDigest: nonEmptyString.optional(), state: managedPackageStateSchema,
	errorCode: packageErrorCodeSchema.optional(), createdAt: z.date(), updatedAt: z.date(),
});
export type ManagedPackageInstallationRecord = z.infer<typeof managedPackageInstallationRecordSchema>;

export const packageOperationRecordSchema = z.object({
	operationId: nonEmptyString, action: packageOperationActionSchema, stage: packageOperationStageSchema,
	status: packageOperationStatusSchema, packageName: packageNameSchema.optional(),
	requestedSpec: packageSourceSpecSchema, candidateVersion: nonEmptyString.optional(),
	candidateIntegrity: nonEmptyString.optional(), candidateContentDigest: nonEmptyString.optional(),
	errorCode: packageErrorCodeSchema.optional(), createdAt: z.date(), updatedAt: z.date(),
});
export type PackageOperationRecord = z.infer<typeof packageOperationRecordSchema>;

export const packageInspectRequestSchema = z.object({ sourceSpec: packageSourceSpecSchema, officialCapabilityId: nonEmptyString.optional(), intent: z.enum(["install", "update"]).default("install") });
export type PackageInspectRequest = z.input<typeof packageInspectRequestSchema>;
export const packageInstallRequestSchema = z.object({
	inspectionId: nonEmptyString, acceptedPackageName: packageNameSchema, acceptedVersion: nonEmptyString,
	acceptedIntegrity: nonEmptyString, acceptedPermissionDigest: nonEmptyString,
});
export type PackageInstallRequest = z.infer<typeof packageInstallRequestSchema>;
export const packageUpdateRequestSchema = packageInstallRequestSchema.extend({
	packageName: packageNameSchema, acceptedDowngrade: z.boolean(), acceptedActiveRunCount: z.number().int().nonnegative(),
});
export type PackageUpdateRequest = z.infer<typeof packageUpdateRequestSchema>;
export const packageRemoveRequestSchema = z.object({ packageName: packageNameSchema, acceptedActiveRunCount: z.number().int().nonnegative() });
export type PackageRemoveRequest = z.infer<typeof packageRemoveRequestSchema>;

export const capabilityUpdateSchema = z.object({
	packageName: packageNameSchema, capabilityId: nonEmptyString, currentVersion: nonEmptyString,
	candidateVersion: nonEmptyString, releaseNotes: z.string().optional(), permissionChanged: z.boolean().optional(),
	downgrade: z.boolean(), requiresSetup: z.boolean().optional(), activeRunCount: z.number().int().nonnegative(),
	// Discovery cannot know manifest compatibility before explicit static inspection.
	requiresReview: z.boolean().optional(),
});
export type CapabilityUpdateDto = z.infer<typeof capabilityUpdateSchema>;
export const capabilityDistributionProgressSchema = z.object({
	operationId: nonEmptyString, capabilityId: nonEmptyString.optional(), packageName: packageNameSchema.optional(),
	action: packageOperationActionSchema, stage: packageOperationStageSchema, status: packageOperationStatusSchema,
	errorCode: packageErrorCodeSchema.optional(), updatedAt: z.string().datetime(),
});
export type CapabilityDistributionProgress = z.infer<typeof capabilityDistributionProgressSchema>;

export const capabilityPackageInspectionSchema = z.object({
	inspectionId: nonEmptyString,
	packageName: packageNameSchema,
	requestedSpec: packageSourceSpecSchema,
	resolvedVersion: nonEmptyString,
	integrity: nonEmptyString,
	contentDigest: nonEmptyString,
	trust: packageTrustSchema,
	reviewStatus: packageReviewStatusSchema,
	releaseNotes: z.string(),
	capability: capabilityDetailSchema,
	permissionDigest: nonEmptyString,
	expiresAt: z.string().datetime(),
	update: capabilityUpdateSchema.optional(),
});
export type CapabilityPackageInspectionDto = z.infer<typeof capabilityPackageInspectionSchema>;
