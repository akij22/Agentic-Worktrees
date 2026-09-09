import { describe, expect, it } from "vitest";
import {
	capabilityPackageInspectionSchema,
	packageErrorCodeSchema,
	packageInstallRequestSchema,
	packageOperationRecordSchema,
	packageSourceSpecSchema,
} from "./schemas";

describe("package lifecycle schemas", () => {
	it("accepts exact npm package specs and rejects non-registry sources", () => {
		expect(packageSourceSpecSchema.parse("@agentic-worktrees/web-search@0.1.0"))
			.toBe("@agentic-worktrees/web-search@0.1.0");
		expect(packageSourceSpecSchema.parse("@agentic-worktrees/web-search"))
			.toBe("@agentic-worktrees/web-search");
		expect(() => packageSourceSpecSchema.parse("git+https://example.com/repo.git"))
			.toThrow();
	});

	it("strips fields that must not cross IPC", () => {
		expect(packageInstallRequestSchema.parse({
			inspectionId: "inspection-1",
			acceptedPackageName: "@agentic-worktrees/web-search",
			acceptedVersion: "0.1.0",
			acceptedIntegrity: "sha512-value",
			acceptedPermissionDigest: "permission-digest",
			executablePath: "/must/not/cross/ipc",
		})).not.toHaveProperty("executablePath");
	});

	it("validates path-free package inspections with capability details", () => {
		const parsed = capabilityPackageInspectionSchema.parse({
			inspectionId: "inspection-1", packageName: "@agentic-worktrees/web-search",
			requestedSpec: "@agentic-worktrees/web-search@0.1.0", resolvedVersion: "0.1.0",
			integrity: "sha512-value", contentDigest: "content-digest", trust: "official",
			reviewStatus: "official-reviewed", releaseNotes: "Initial release",
			capability: {
				id: "agentic-worktrees.web-search", name: "Web Search", version: "0.1.0",
				description: "Search", category: "web-browser", compatibility: { codex: "supported", opencode: "supported" },
				state: "available", secretConfigured: false, installationState: "available", source: "npm",
				packageName: "@agentic-worktrees/web-search", trust: "official", reviewStatus: "official-reviewed",
				sdkVersion: "^0.1.0", author: { name: "Agentic Worktrees" }, license: "MIT",
				permissions: { network: [], secrets: [] }, settings: [], activeRunCount: 0,
				providedTools: ["web_search"], permissionDigest: "permission-digest",
				entryPath: "/must/not/cross-ipc",
			},
			permissionDigest: "permission-digest", expiresAt: "2026-09-03T00:00:00.000Z",
			archivePath: "/must/not/cross-ipc",
		});
		expect(parsed).not.toHaveProperty("archivePath");
		expect(parsed.capability).not.toHaveProperty("entryPath");
	});

	it("defines stable safe errors and operation state", () => {
		expect(packageErrorCodeSchema.parse("package_integrity_failed"))
			.toBe("package_integrity_failed");
		expect(packageOperationRecordSchema.parse({
			operationId: "operation-1",
			action: "install",
			stage: "verifying",
			status: "in_progress",
			requestedSpec: "@agentic-worktrees/web-search@0.1.0",
			createdAt: new Date(),
			updatedAt: new Date(),
		}).status).toBe("in_progress");
	});
});
