import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CapabilityStaticDescriptor } from "@agentic-worktrees/capability-sdk";
import { digestPackageTree } from "../packages/content-digest";
import { safeCapabilityVerificationError, verifyCapabilityPackageRequest } from "./package-verifier-request";

const descriptor: CapabilityStaticDescriptor = { manifest: { id: "example.cap", name: "Example", version: "1.0.0", sdkVersion: "^0.1.0", description: "Example", category: "test", author: { name: "Test" }, license: "MIT", compatibility: { codex: "supported", opencode: "supported" }, permissions: { network: [], secrets: [] }, settings: {} }, tools: [{ name: "example", description: "Example", inputSchema: { type: "object" } }] };

function moduleSource(value: CapabilityStaticDescriptor = descriptor): string {
  return `export default { manifest: ${JSON.stringify(value.manifest)}, tools: [{ ...${JSON.stringify(value.tools[0])}, execute: async () => ({ content: [] }) }] };`;
}
async function fixture(source = moduleSource()) {
  const root = await mkdtemp(join(tmpdir(), "cap-verify-"));
  await writeFile(join(root, "package.json"), JSON.stringify({ type: "module" }));
  await writeFile(join(root, "index.js"), source);
  const contentDigest = await digestPackageTree(root);
  return { root, contentDigest, request: { type: "capability.verify" as const, requestId: `request-${Math.random()}`, packageRoot: root, entry: "./index.js", expectedContentDigest: contentDigest, expectedDescriptor: descriptor } };
}

describe("verifyCapabilityPackageRequest", () => {
  it("verifies a real package and returns bounded metadata", async () => {
    const { request } = await fixture();
    await expect(verifyCapabilityPackageRequest(request)).resolves.toMatchObject({ capabilityId: "example.cap", version: "1.0.0", toolNames: ["example"] });
  });
  it("rejects lexical and realpath entry escapes", async () => {
    const item = await fixture();
    await expect(verifyCapabilityPackageRequest({ ...item.request, entry: "../outside.js" })).rejects.toThrow("verification failed");
    const outside = join(item.root, "..", `outside-${Date.now()}.js`); await writeFile(outside, moduleSource()); await symlink(outside, join(item.root, "link.js"));
    await expect(verifyCapabilityPackageRequest({ ...item.request, entry: "./link.js" })).rejects.toThrow("verification failed");
  });
  it("recomputes the digest and rejects tampering", async () => {
    const item = await fixture(); await writeFile(join(item.root, "index.js"), `${moduleSource()}\n// tampered`);
    await expect(verifyCapabilityPackageRequest(item.request)).rejects.toThrow("verification failed");
  });
  it.each([["missing default", "export const value = 1;"], ["invalid default", "export default null;"]])("rejects %s", async (_label, source) => {
    const item = await fixture(source); await expect(verifyCapabilityPackageRequest(item.request)).rejects.toThrow();
  });
  it("rejects actual static/runtime descriptor mismatch", async () => {
    const changed = { ...descriptor, manifest: { ...descriptor.manifest, name: "Changed" } }; const item = await fixture(moduleSource(changed));
    await expect(verifyCapabilityPackageRequest(item.request)).rejects.toThrow("verification failed");
  });
  it("redacts raw import errors", async () => {
    const item = await fixture("throw new Error('SECRET LOCAL IMPORT DETAIL');");
    await expect(verifyCapabilityPackageRequest(item.request).catch(() => { throw new Error(safeCapabilityVerificationError(item.request).code); })).rejects.toThrow("verification_failed");
    expect(safeCapabilityVerificationError(item.request)).toEqual({ type: "capability.verification-error", requestId: item.request.requestId, code: "verification_failed" });
  });
});
