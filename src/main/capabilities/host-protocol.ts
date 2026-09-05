import { z } from "zod";
import type { CapabilityErrorCode } from "@agentic-worktrees/capability-sdk";
import type { CapabilityRuntimeDescriptor } from "./catalog";

const identifierSchema = z.string().min(1).max(256);
const settingsSchema = z.record(
  identifierSchema,
  z.record(identifierSchema, z.unknown()),
);
const bundledRuntimeDescriptorSchema = z
  .object({
    kind: z.literal("bundled"),
    capabilityId: identifierSchema,
    version: identifierSchema,
  })
  .strict();
const managedRuntimeDescriptorSchema = z
  .object({
    kind: z.literal("managed"),
    capabilityId: identifierSchema,
    packageName: identifierSchema,
    version: identifierSchema,
    packageRoot: z.string().min(1).max(4096),
    manifest: z.string().min(1).max(1024),
    entry: z.string().min(1).max(1024),
    contentDigest: z.string().min(1).max(256),
  })
  .strict();
export const capabilityRuntimeDescriptorSchema: z.ZodType<CapabilityRuntimeDescriptor> =
  z.discriminatedUnion("kind", [
    bundledRuntimeDescriptorSchema,
    managedRuntimeDescriptorSchema,
  ]);
const descriptorsSchema = z
  .array(capabilityRuntimeDescriptorSchema)
  .max(100)
  .superRefine((values, context) => {
    const ids = new Set<string>();
    for (const value of values)
      if (ids.has(value.capabilityId))
        context.addIssue({
          code: "custom",
          message: "Duplicate capability descriptor.",
        });
      else ids.add(value.capabilityId);
  });
const capabilityErrorCodeSchema = z.enum([
  "invalid_input",
  "missing_secret",
  "permission_denied",
  "rate_limited",
  "upstream_unavailable",
  "upstream_protocol_error",
  "cancelled",
  "activation_failed",
  "agent_reload_failed",
  "internal_error",
] satisfies readonly CapabilityErrorCode[]);

export const mainToHostMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("host.initialize"),
      runId: identifierSchema,
      token: z.string().min(32).max(256),
      capabilities: descriptorsSchema,
      settings: settingsSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("host.capabilities.set"),
      requestId: identifierSchema,
      capabilities: descriptorsSchema,
      settings: settingsSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("host.secret.result"),
      requestId: identifierSchema,
      value: z.string().min(1).optional(),
      errorCode: z.literal("missing_secret").optional(),
    })
    .strict()
    .refine((message) => Boolean(message.value) !== Boolean(message.errorCode)),
]);

export const hostToMainMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("host.ready"),
      runId: identifierSchema,
      port: z.number().int().min(1).max(65_535),
    })
    .strict(),
  z
    .object({
      type: z.literal("host.secret.request"),
      requestId: identifierSchema,
      capabilityId: identifierSchema,
      settingKey: identifierSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("host.capabilities.applied"),
      requestId: identifierSchema,
      toolNames: z.array(identifierSchema).max(1_000),
    })
    .strict(),
  z
    .object({
      type: z.literal("host.error"),
      requestId: identifierSchema.optional(),
      code: capabilityErrorCodeSchema,
      message: z.string().min(1).max(2_000),
    })
    .strict(),
]);

export type MainToHostMessage = z.infer<typeof mainToHostMessageSchema>;
export type HostToMainMessage = z.infer<typeof hostToMainMessageSchema>;

export function isMainToHostMessage(
  value: unknown,
): value is MainToHostMessage {
  return mainToHostMessageSchema.safeParse(value).success;
}

export function isHostToMainMessage(
  value: unknown,
): value is HostToMainMessage {
  return hostToMainMessageSchema.safeParse(value).success;
}
