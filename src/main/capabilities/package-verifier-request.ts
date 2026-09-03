import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { staticDescriptorFromDefinition, validateCapabilityDefinition } from "@agentic-worktrees/capability-sdk";
import { digestPackageTree } from "../packages/content-digest";
import { capabilityVerificationRequestSchema, type CapabilityVerificationResult } from "./package-verification-protocol";

export async function verifyCapabilityPackageRequest(raw: unknown): Promise<CapabilityVerificationResult> {
  const request = capabilityVerificationRequestSchema.parse(raw);
  const root = await realpath(request.packageRoot);
  const lexicalEntry = resolve(root, request.entry);
  const lexicalRelative = relative(root, lexicalEntry);
  if (!lexicalRelative || lexicalRelative.startsWith("..") || isAbsolute(lexicalRelative)) throw new Error("verification failed");
  const entryReal = await realpath(lexicalEntry);
  const realRelative = relative(root, entryReal);
  if (!realRelative || realRelative.startsWith("..") || isAbsolute(realRelative)) throw new Error("verification failed");
  const contentDigest = await digestPackageTree(root);
  if (contentDigest !== request.expectedContentDigest) throw new Error("verification failed");
  const imported: unknown = await import(`${pathToFileURL(entryReal).href}?digest=${encodeURIComponent(contentDigest)}`);
  if (!imported || typeof imported !== "object" || !("default" in imported)) throw new Error("verification failed");
  const definition = validateCapabilityDefinition((imported as { default: never }).default);
  const projected = staticDescriptorFromDefinition(definition);
  if (!isDeepStrictEqual(projected, request.expectedDescriptor)) throw new Error("verification failed");
  return { type: "capability.verified", requestId: request.requestId, capabilityId: projected.manifest.id, version: projected.manifest.version, toolNames: projected.tools.map(tool => tool.name), contentDigest };
}

export function safeCapabilityVerificationError(raw: unknown): { type: "capability.verification-error"; requestId: string; code: "verification_failed" } {
  const requestId = !!raw && typeof raw === "object" && "requestId" in raw && typeof raw.requestId === "string" && raw.requestId.length <= 4096 ? raw.requestId : "invalid";
  return { type: "capability.verification-error", requestId, code: "verification_failed" };
}
