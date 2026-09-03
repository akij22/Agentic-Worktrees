import { describe, expect, it } from "vitest";
import {
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
