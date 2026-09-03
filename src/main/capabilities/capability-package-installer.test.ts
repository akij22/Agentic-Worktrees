import BetterSqlite3 from "better-sqlite3";
import { mkdtemp, mkdir, readFile, rm, writeFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapSchemaSql } from "../database/bootstrap";
import { ManagedPackageRepository } from "../packages/package-repository";
import { createManagedPackageLayout } from "../packages/storage-layout";
import { digestPackageTree } from "../packages/content-digest";
import { CapabilityRepository } from "./capability-repository";
import { CapabilityPackageInstaller } from "./capability-package-installer";

const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "cap-installer-")); roots.push(root);
  const layout = createManagedPackageLayout(root); const db = new BetterSqlite3(":memory:"); db.exec(bootstrapSchemaSql);
  const repo = new ManagedPackageRepository(db); const capabilities = new CapabilityRepository(db);
  const operationId = "op-1", packageName = "@example/search", capabilityId = "example.search", version = "1.2.3", integrity = "sha512-integrity";
  const stage = join(layout.stagingOperationRoot(operationId), "package"); await mkdir(join(stage, "dist"), { recursive: true });
  const descriptor = { manifest: { id: capabilityId, version, name: "Search", description: "Search", sdkVersion: ">=0.1.0", permissions: [], settings: {} }, entry: "./dist/index.js" };
  await writeFile(join(stage, "package.json"), JSON.stringify({ name: packageName, version, agenticWorktrees: { kind: "capability", manifest: "./capability.json", entry: "./dist/index.js" } }));
  await writeFile(join(stage, "capability.json"), JSON.stringify(descriptor)); await writeFile(join(stage, "dist/index.js"), "module.exports = {};");
  const contentDigest = await digestPackageTree(stage);
  const staged = { packageRoot: stage, packageName, resolvedVersion: version, integrity, contentDigest, operationId, requestedSpec: `${packageName}@${version}` };
  const inspected = { staged, descriptor, packageMetadata: { kind: "capability", manifest: "./capability.json", entry: "./dist/index.js" }, permissionDigest: "perm", trust: "community", reviewStatus: "unreviewed" } as never;
  repo.beginOperation({ operationId, action: "install", stage: "installing", packageName, requestedSpec: staged.requestedSpec });
  return { root, layout, db, repo, capabilities, staged, inspected, capabilityId, version, packageName, integrity, contentDigest };
}
afterEach(async () => { while (roots.length) await rm(roots.pop()!, { recursive: true, force: true }); });

describe("CapabilityPackageInstaller real fixtures", () => {
  it("moves a successful staged package to the exact version directory", async () => { const f = await fixture(); await new CapabilityPackageInstaller(f.layout, f.repo).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] }); await expect(readFile(join(f.layout.packageVersionRoot(f.capabilityId, f.version), "dist/index.js"), "utf8")).resolves.toBe("module.exports = {};"); });
  it("writes an atomic active pointer with exact identity and relative paths", async () => { const f = await fixture(); await new CapabilityPackageInstaller(f.layout, f.repo).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] }); const p = JSON.parse(await readFile(`${f.layout.activePointerPath(f.capabilityId)}.json`, "utf8")); expect(p).toEqual({ packageName: f.packageName, capabilityId: f.capabilityId, version: f.version, integrity: f.integrity, contentDigest: f.contentDigest, manifestPath: "./capability.json", entryPath: "./dist/index.js" }); });
  it("verifies committed path, commits DB, then refreshes catalog", async () => { const f = await fixture(); const order: string[] = []; const installer = new CapabilityPackageInstaller(f.layout, f.repo, { verifyCommittedPath: async () => { order.push("verify"); }, refreshCatalog: async () => { order.push("refresh"); } }); const commit = f.repo.commitInstallation.bind(f.repo); vi.spyOn(f.repo, "commitInstallation").mockImplementation((...args) => { order.push("db"); return commit(...args); }); await installer.commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] }); expect(order).toEqual(["verify", "db", "refresh"]); });
  it("rejects a same-version collision with a different digest without overwrite", async () => { const f = await fixture(); const destination = f.layout.packageVersionRoot(f.capabilityId, f.version); await mkdir(destination, { recursive: true }); await writeFile(join(destination, "sentinel"), "untouched"); await expect(new CapabilityPackageInstaller(f.layout, f.repo).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] })).rejects.toThrow("package_install_failed"); await expect(readFile(join(destination, "sentinel"), "utf8")).resolves.toBe("untouched"); });
  it("reuses an identical same-version destination without duplicate state", async () => { const f = await fixture(); const destination = f.layout.packageVersionRoot(f.capabilityId, f.version); await mkdir(destination, { recursive: true }); await rename(f.staged.packageRoot, destination); await new CapabilityPackageInstaller(f.layout, f.repo).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] }); expect(f.repo.list()).toHaveLength(1); });
  it("does not modify unrelated package directory, pointer, or DB record", async () => { const f = await fixture(); const other = f.layout.packageVersionRoot("other.cap", "1.0.0"); await mkdir(other, { recursive: true }); await writeFile(join(other, "x"), "stable"); await mkdir(join(f.layout.root, "active"), { recursive: true }); await writeFile(`${f.layout.activePointerPath("other.cap")}.json`, "pointer"); f.repo.beginOperation({ operationId: "other", action: "install", stage: "installing", packageName: "other", requestedSpec: "other" }); const before = [await readFile(join(other, "x")), await readFile(`${f.layout.activePointerPath("other.cap")}.json`), f.repo.getByPackageName("other")]; await new CapabilityPackageInstaller(f.layout, f.repo).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] }); expect(await readFile(join(other, "x"))).toEqual(before[0]); expect(await readFile(`${f.layout.activePointerPath("other.cap")}.json`)).toEqual(before[1]); expect(f.repo.getByPackageName("other")).toEqual(before[2]); });
  it("returns path-free stable records and DTOs", async () => { const f = await fixture(); const result = await new CapabilityPackageInstaller(f.layout, f.repo).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] }); expect(JSON.stringify(result)).not.toContain(f.root); });
  it("initializes ready defaults without sessions or activation", async () => { const f = await fixture(); f.capabilities.initializeInstalledConfiguration({ id: f.capabilityId, version: f.version, settings: { mode: { type: "string", default: "fast" } } }, "perm"); expect(f.capabilities.getInstallation(f.capabilityId)?.configured).toBe(true); expect(f.capabilities.listSessionCapabilities("run")).toEqual([]); });
});
