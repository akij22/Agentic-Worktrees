import { z } from "zod";

export const capabilityInstallationStateSchema = z.enum([
	"available", "installing", "installed", "needs_setup", "update_available", "updating",
	"incompatible", "blocked", "invalid", "removing", "migration_pending",
]);
export type CapabilityInstallationStateDto = z.infer<typeof capabilityInstallationStateSchema>;

export const capabilityStateSchema = z.enum([
	"available", "needs_setup", "ready", "pending_activation", "reloading",
	"active", "pending_deactivation", "activation_failed", "inactive", "unavailable",
]);
export type CapabilityStateDto = z.infer<typeof capabilityStateSchema>;

const capabilityCompatibilitySchema = z.object({
	codex: z.enum(["supported", "unsupported"]),
	opencode: z.enum(["supported", "unsupported"]),
});

export const capabilitySummarySchema = z.object({
	id: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/),
	name: z.string(), version: z.string(), description: z.string(), category: z.string(),
	compatibility: capabilityCompatibilitySchema, state: capabilityStateSchema,
	secretConfigured: z.boolean(), installationState: capabilityInstallationStateSchema,
	source: z.enum(["bundled", "npm"]), packageName: z.string().optional(),
	trust: z.enum(["built-in", "official", "community"]),
	reviewStatus: z.enum(["bundled-reviewed", "official-reviewed", "unreviewed"]),
});
export type CapabilitySummaryDto = z.infer<typeof capabilitySummarySchema>;

const capabilitySettingDetailSchema = z.object({
	key: z.string(), type: z.enum(["string", "integer", "boolean", "secret"]),
	required: z.boolean().optional(), default: z.union([z.string(), z.number(), z.boolean()]).optional(),
	enum: z.array(z.string()).optional(), min: z.number().optional(), max: z.number().optional(),
});

export const capabilityDetailSchema = capabilitySummarySchema.extend({
	sdkVersion: z.string(), author: z.object({ name: z.string(), url: z.string().url().optional() }),
	license: z.string(), provenance: z.object({
		kind: z.string(), source: z.string(), package: z.string(), sourceVersion: z.string(), repository: z.string().url(),
	}).optional(),
	permissions: z.object({ network: z.array(z.string()), secrets: z.array(z.string()) }),
	settings: z.array(capabilitySettingDetailSchema), activeRunCount: z.number().int().nonnegative(),
	providedTools: z.array(z.string()), permissionDigest: z.string(),
	warningCode: z.enum(["upstream_unavailable"]).optional(),
});
export type CapabilityDetailDto = z.infer<typeof capabilityDetailSchema>;
