import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createManagedPackageLayout } from "./storage-layout";
import { NpmPackageAcquirer, type NpmRegistryAdapter, type ResolvedNpmSource } from "./npm-acquirer";

const source: ResolvedNpmSource = { requestedSpec: "pkg@1.0.0", packageName: "pkg", resolvedVersion: "1.0.0", integrity: "sha512-test" };
async function setup(extract: NpmRegistryAdapter["extract"], resolved = source) { const layout = createManagedPackageLayout(await mkdtemp(join(tmpdir(), "acquire-"))); const adapter = { resolve: vi.fn(async () => resolved), extract: vi.fn(extract) }; return { layout, adapter, acquirer: new NpmPackageAcquirer(layout, adapter) }; }
const validExtract: NpmRegistryAdapter["extract"] = async (_s, destination) => { await mkdir(destination, { recursive: true }); await writeFile(join(destination, "package.json"), JSON.stringify({ name: "pkg", version: "1.0.0", scripts: { install: "never" } })); };
describe("NpmPackageAcquirer", () => {
	it("reports stages and returns verified staging", async () => { const { acquirer } = await setup(validExtract); const stages: string[] = []; const result = await acquirer.acquire("op", "pkg@1", new AbortController().signal, s => stages.push(s)); expect(stages).toEqual(["resolving", "downloading", "verifying"]); expect(result.packageJson).toMatchObject({ name: "pkg" }); expect(result.contentDigest).toMatch(/^[a-f0-9]{64}$/); });
	it("rejects declared oversize before extraction", async () => { const { acquirer, adapter } = await setup(validExtract, { ...source, unpackedSize: 50 * 1024 * 1024 + 1 }); await expect(acquirer.acquire("op", "pkg", new AbortController().signal, () => {})).rejects.toThrow("size"); expect(adapter.extract).not.toHaveBeenCalled(); });
	it("requires package.json and rejects extracted limits", async () => { const missing = await setup(async (_s, d) => { await mkdir(d, { recursive: true }); }); await expect(missing.acquirer.acquire("op", "pkg", new AbortController().signal, () => {})).rejects.toThrow("package.json"); const huge = await setup(async (_s, d) => { await mkdir(d, { recursive: true }); await writeFile(join(d, "package.json"), "{}"); await writeFile(join(d, "large"), Buffer.alloc(50 * 1024 * 1024 + 1)); }); await expect(huge.acquirer.acquire("op", "pkg", new AbortController().signal, () => {})).rejects.toThrow("size"); });
	it("cleans staging on abort", async () => { const controller = new AbortController(); const { acquirer, layout } = await setup(async (_s, d) => { await mkdir(d, { recursive: true }); controller.abort(); }); await expect(acquirer.acquire("op", "pkg", controller.signal, () => {})).rejects.toThrow(); await expect(access(layout.stagingOperationRoot("op"))).rejects.toThrow(); });
});
