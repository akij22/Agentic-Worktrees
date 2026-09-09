import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createManagedPackageLayout } from "./storage-layout";

describe("managed package layout", () => {
	it("derives app-owned paths", () => {
		const root = mkdtempSync(join(tmpdir(), "packages-"));
		const layout = createManagedPackageLayout(root);
		expect(layout.packageVersionRoot("web-search", "1.0.0")).toBe(join(layout.root, "packages", "web-search", "1.0.0"));
		expect(layout.stagingOperationRoot("op-1")).toBe(join(layout.root, "staging", "op-1"));
	});
	it.each(["../escape", "/absolute", "a/b", ".."])("rejects unsafe segment %s", value => {
		const layout = createManagedPackageLayout(mkdtempSync(join(tmpdir(), "packages-")));
		expect(() => layout.packageVersionRoot(value, "1.0.0")).toThrow();
		expect(() => layout.stagingOperationRoot(value)).toThrow();
	});
});
