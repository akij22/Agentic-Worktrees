import { describe, expect, it } from "vitest";
import { capabilityVerificationRequestSchema, capabilityVerificationResultSchema } from "./package-verification-protocol";

const descriptor = { manifest: { id: "example.search", name: "Search", version: "1.0.0", sdkVersion: "^0.1.0", description: "Search", category: "test", author: { name: "Test" }, license: "MIT", compatibility: { codex: "supported", opencode: "supported" }, permissions: { network: [], secrets: [] }, settings: {} }, tools: [] } as const;
describe("capability verification protocol", () => {
  it("accepts exact bounded requests", () => { const request = { type: "capability.verify", requestId: "verify-1", packageRoot: "/managed/staging/op/package", entry: "./dist/index.js", expectedContentDigest: "sha256-value", expectedDescriptor: descriptor }; expect(capabilityVerificationRequestSchema.parse(request)).toEqual(request); expect(() => capabilityVerificationRequestSchema.parse({ ...request, rendererPath: "/untrusted" })).toThrow(); });
  it("rejects oversized and extra result fields", () => { expect(() => capabilityVerificationRequestSchema.parse({ type: "capability.verify", requestId: "x".repeat(4097), packageRoot: "/x", entry: "./x", expectedContentDigest: "x", expectedDescriptor: descriptor })).toThrow(); expect(() => capabilityVerificationResultSchema.parse({ type: "capability.verified", requestId: "x", capabilityId: "x", version: "1", toolNames: [], contentDigest: "x", error: "secret" })).toThrow(); });
});
