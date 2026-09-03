import { link, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { digestPackageTree, normalizePackagePath } from "./content-digest";

const root = () => mkdtemp(join(tmpdir(), "digest-"));
describe("digestPackageTree", () => {
	it("changes when a byte changes", async () => { const dir = await root(); await writeFile(join(dir, "a"), "one"); const first = await digestPackageTree(dir); await writeFile(join(dir, "a"), "two"); expect(await digestPackageTree(dir)).not.toBe(first); });
	it("is independent of insertion order and normalizes Windows separators", async () => {
		const first = await root(); const second = await root();
		await writeFile(join(first, "z"), "z"); await writeFile(join(first, "a"), "a");
		await writeFile(join(second, "a"), "a"); await writeFile(join(second, "z"), "z");
		expect(await digestPackageTree(first)).toBe(await digestPackageTree(second));
		expect(normalizePackagePath("dir\\file.js")).toBe("dir/file.js");
	});
	it("rejects symbolic and hard links", async () => { const dir = await root(); await writeFile(join(dir, "a"), "x"); await symlink("a", join(dir, "s")); await expect(digestPackageTree(dir)).rejects.toThrow("link"); const dir2 = await root(); await writeFile(join(dir2, "a"), "x"); await link(join(dir2, "a"), join(dir2, "b")); await expect(digestPackageTree(dir2)).rejects.toThrow("link"); });
	it("enforces limits", async () => { const dir = await root(); await mkdir(join(dir, "d")); await writeFile(join(dir, "d", "x"), "1234"); await expect(digestPackageTree(dir, { maxBytes: 3 })).rejects.toThrow("size"); await expect(digestPackageTree(dir, { maxEntries: 1 })).rejects.toThrow("entries"); });
});
