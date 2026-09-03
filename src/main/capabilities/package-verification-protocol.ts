import { z } from "zod";
import { validateCapabilityStaticDescriptor, type CapabilityStaticDescriptor } from "@agentic-worktrees/capability-sdk";

const boundedText = z.string().min(1).max(4096);
const descriptorSchema = z.custom<CapabilityStaticDescriptor>((value) => {
  try { const encoded = JSON.stringify(value); return Buffer.byteLength(encoded) <= 256 * 1024 && validateCapabilityStaticDescriptor(value) !== undefined; } catch { return false; }
});

export const capabilityVerificationRequestSchema = z.object({
  type: z.literal("capability.verify"),
  requestId: boundedText,
  packageRoot: boundedText,
  entry: boundedText,
  expectedContentDigest: boundedText,
  expectedDescriptor: descriptorSchema,
}).strict();

export const capabilityVerificationResultSchema = z.object({
  type: z.literal("capability.verified"),
  requestId: boundedText,
  capabilityId: boundedText,
  version: boundedText,
  toolNames: z.array(boundedText).max(100),
  contentDigest: boundedText,
}).strict();

export const capabilityVerificationErrorSchema = z.object({
  type: z.literal("capability.verification-error"), requestId: boundedText, code: z.enum(["verification_failed", "invalid_request"]),
}).strict();

export type CapabilityVerificationRequest = z.infer<typeof capabilityVerificationRequestSchema>;
export type CapabilityVerificationResult = z.infer<typeof capabilityVerificationResultSchema>;
export type CapabilityVerificationError = z.infer<typeof capabilityVerificationErrorSchema>;
