import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parentPort as workerParentPort } from "node:worker_threads";
import { isDeepStrictEqual } from "node:util";
import { staticDescriptorFromDefinition, validateCapabilityDefinition } from "@agentic-worktrees/capability-sdk";
import { digestPackageTree } from "../packages/content-digest";
import { capabilityVerificationRequestSchema } from "./package-verification-protocol";

const parentPort = process.parentPort ?? workerParentPort;
if (!parentPort) throw new Error("Capability verifier requires a utility-process parent");
let handled = false;
parentPort.on("message", (event: unknown) => {
  if (handled) return; handled = true;
  const candidate = event && typeof event === "object" && "data" in event ? (event as { data: unknown }).data : event;
  void verify(candidate).then(message => parentPort.postMessage(message), () => parentPort.postMessage({ type: "capability.verification-error", requestId: requestIdOf(candidate), code: "verification_failed" })).finally(() => setImmediate(() => process.exit(0)));
});
function requestIdOf(value: unknown): string { return !!value && typeof value === "object" && "requestId" in value && typeof value.requestId === "string" && value.requestId.length <= 4096 ? value.requestId : "invalid"; }
async function verify(raw: unknown) {
  const request = capabilityVerificationRequestSchema.parse(raw);
  const root = await realpath(request.packageRoot), entry = resolve(root, request.entry), entryReal = await realpath(entry), rel = relative(root, entryReal);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("entry containment failed");
  const contentDigest = await digestPackageTree(root);
  if (contentDigest !== request.expectedContentDigest) throw new Error("digest mismatch");
  const imported: unknown = await import(`${pathToFileURL(entryReal).href}?digest=${encodeURIComponent(contentDigest)}`);
  if (!imported || typeof imported !== "object" || !("default" in imported)) throw new Error("missing definition");
  const definition = validateCapabilityDefinition((imported as { default: never }).default);
  const projected = staticDescriptorFromDefinition(definition);
  if (!isDeepStrictEqual(projected, request.expectedDescriptor)) throw new Error("descriptor mismatch");
  return { type: "capability.verified" as const, requestId: request.requestId, capabilityId: projected.manifest.id, version: projected.manifest.version, toolNames: projected.tools.map(tool => tool.name), contentDigest };
}
