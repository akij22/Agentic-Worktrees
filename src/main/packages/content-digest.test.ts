import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, rename, stat, symlink, writeFile } from "node:fs/promises";
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
	it("uses explicit UTF-8 bytewise path ordering rather than locale collation", async () => {
		const dir = await root(); await writeFile(join(dir, "a"), "lower"); await writeFile(join(dir, "Z"), "upper");
		const expected = createHash("sha256");
		for (const [name, content] of [["Z", "upper"], ["a", "lower"]] as const) { expected.update(name); expected.update("\0"); expected.update(((await stat(join(dir, name))).mode & 0o777).toString(8)); expected.update("\0"); expected.update(content); expected.update("\0"); }
		expect(await digestPackageTree(dir)).toBe(expected.digest("hex"));
	});
	it("rejects a pathname replaced after descriptor reading", async () => {
		const dir = await root(); const path = join(dir, "a"); await writeFile(path, "original");
		await expect(digestPackageTree(dir, { afterFileRead: async () => { await rename(path, `${path}.old`); await writeFile(path, "replacement"); } })).rejects.toThrow("changed");
	});
	it("rejects symbolic and hard links", async () => { const dir = await root(); await writeFile(join(dir, "a"), "x"); await symlink("a", join(dir, "s")); await expect(digestPackageTree(dir)).rejects.toThrow("link"); const dir2 = await root(); await writeFile(join(dir2, "a"), "x"); await link(join(dir2, "a"), join(dir2, "b")); await expect(digestPackageTree(dir2)).rejects.toThrow("link"); });
	it("enforces limits", async () => { const dir = await root(); await mkdir(join(dir, "d")); await writeFile(join(dir, "d", "x"), "1234"); await expect(digestPackageTree(dir, { maxBytes: 3 })).rejects.toThrow("size"); await expect(digestPackageTree(dir, { maxEntries: 1 })).rejects.toThrow("entries"); });
});
