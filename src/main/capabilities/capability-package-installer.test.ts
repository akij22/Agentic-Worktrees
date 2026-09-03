import BetterSqlite3 from "better-sqlite3";
import { access, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapSchemaSql } from "../database/bootstrap";
import { ManagedPackageRepository } from "../packages/package-repository";
import { createManagedPackageLayout } from "../packages/storage-layout";
import { digestPackageTree } from "../packages/content-digest";
import { CapabilityRepository } from "./capability-repository";
import { CapabilityPackageInstaller, isUnsupportedDirectorySyncError, type InstallerFileSystem } from "./capability-package-installer";

const roots: string[] = [];
async function snapshotTree(root: string, relative = ""): Promise<Array<{ path: string; kind: "directory" | "file"; mode: number; bytes?: string }>> {
  const entries: Array<{ path: string; kind: "directory" | "file"; mode: number; bytes?: string }> = [];
  for (const name of (await readdir(join(root, relative))).sort()) {
    const path = join(relative, name); const info = await stat(join(root, path));
    if (info.isDirectory()) { entries.push({ path, kind: "directory", mode: info.mode & 0o777 }); entries.push(...await snapshotTree(root, path)); }
    else entries.push({ path, kind: "file", mode: info.mode & 0o777, bytes: (await readFile(join(root, path))).toString("base64") });
  }
  return entries;
}
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
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function installUnrelated(f: Fixture) {
  const capabilityId = "other.cap", packageName = "@example/other", version = "2.0.0", operationId = "op-other";
  const stage = join(f.layout.stagingOperationRoot(operationId), "package"); await mkdir(join(stage, "bin/nested"), { recursive: true });
  const descriptor = { manifest: { id: capabilityId, version, name: "Other", description: "Other", sdkVersion: ">=0.1.0", permissions: [], settings: { mode: { type: "string", default: "safe" } } }, entry: "./bin/main.js" };
  await writeFile(join(stage, "package.json"), JSON.stringify({ name: packageName, version, agenticWorktrees: { kind: "capability", manifest: "./capability.json", entry: "./bin/main.js" } })); await writeFile(join(stage, "capability.json"), JSON.stringify(descriptor)); await writeFile(join(stage, "bin/main.js"), "exports.stable = true;", { mode: 0o744 }); await writeFile(join(stage, "bin/nested/data.bin"), Buffer.from([0, 1, 2, 255]), { mode: 0o640 });
  const contentDigest = await digestPackageTree(stage); const requestedSpec = `${packageName}@${version}`; f.repo.beginOperation({ operationId, action: "install", stage: "installing", packageName, requestedSpec });
  const inspected = { staged: { packageRoot: stage, packageName, resolvedVersion: version, integrity: "other-integrity", contentDigest, operationId, requestedSpec }, descriptor, packageMetadata: { kind: "capability", manifest: "./capability.json", entry: "./bin/main.js" }, permissionDigest: "other-perm", trust: "community", reviewStatus: "unreviewed" } as never;
  await new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)()).commitFresh(inspected, { capabilityId, version, contentDigest, toolNames: [] });
  return { f, capabilityId, packageName, version };
}
async function snapshotInstalledFixture(unrelated: Awaited<ReturnType<typeof installUnrelated>>) {
  const { f, capabilityId, packageName, version } = unrelated;
  return { tree: await snapshotTree(f.layout.packageVersionRoot(capabilityId, version)), pointer: await readFile(`${f.layout.activePointerPath(capabilityId)}.json`), managedInstallation: f.repo.getByPackageName(packageName), capabilityInstallation: f.capabilities.getInstallation(capabilityId), settings: f.capabilities.getSettings(capabilityId) };
}
async function createTargetAttempt(f: Fixture, operationId: string) {
  const stage = join(f.layout.stagingOperationRoot(operationId), "package"); await mkdir(join(stage, "dist"), { recursive: true }); const descriptor = (f.inspected as never as { descriptor: object }).descriptor;
  await writeFile(join(stage, "package.json"), JSON.stringify({ name: f.packageName, version: f.version, agenticWorktrees: { kind: "capability", manifest: "./capability.json", entry: "./dist/index.js" } })); await writeFile(join(stage, "capability.json"), JSON.stringify(descriptor)); await writeFile(join(stage, "dist/index.js"), "module.exports = {};");
  const contentDigest = await digestPackageTree(stage); const requestedSpec = `${f.packageName}@${f.version}`; f.repo.beginOperation({ operationId, action: "install", stage: "installing", packageName: f.packageName, requestedSpec });
  return { inspected: { ...(f.inspected as never as object), staged: { packageRoot: stage, packageName: f.packageName, resolvedVersion: f.version, integrity: f.integrity, contentDigest, operationId, requestedSpec } } as never, contentDigest };
}
afterEach(async () => { while (roots.length) await rm(roots.pop()!, { recursive: true, force: true }); });

describe("CapabilityPackageInstaller real fixtures", () => {
  it("moves a successful staged package to the exact version directory", async () => { const f = await fixture(); await new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)()).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] }); await expect(readFile(join(f.layout.packageVersionRoot(f.capabilityId, f.version), "dist/index.js"), "utf8")).resolves.toBe("module.exports = {};"); await expect(access(f.staged.packageRoot)).rejects.toMatchObject({ code: "ENOENT" }); });
  it("writes an atomic active pointer with exact identity and relative paths", async () => { const f = await fixture(); await new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)()).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] }); const p = JSON.parse(await readFile(`${f.layout.activePointerPath(f.capabilityId)}.json`, "utf8")); expect(p).toEqual({ packageName: f.packageName, capabilityId: f.capabilityId, version: f.version, integrity: f.integrity, contentDigest: f.contentDigest, manifestPath: "./capability.json", entryPath: "./dist/index.js" }); });
  it("verifies committed path, commits DB, then refreshes catalog", async () => { const f = await fixture(); const order: string[] = []; const installer = new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)(), { verifyCommittedPath: async () => { order.push("verify"); }, refreshCatalog: async () => { order.push("refresh"); } }); const commit = f.repo.commitInstallation.bind(f.repo); vi.spyOn(f.repo, "commitInstallation").mockImplementation((...args) => { order.push("db"); return commit(...args); }); await installer.commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] }); expect(order).toEqual(["verify", "db", "refresh"]); });
  it("rejects a same-version collision with a different digest without overwrite", async () => { const f = await fixture(); const destination = f.layout.packageVersionRoot(f.capabilityId, f.version); await mkdir(destination, { recursive: true }); await writeFile(join(destination, "sentinel"), "untouched"); await expect(new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)()).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] })).rejects.toThrow("package_install_failed"); await expect(readFile(join(destination, "sentinel"), "utf8")).resolves.toBe("untouched"); });
  it("reuses an identical same-version destination without duplicate state", async () => { const f = await fixture(); const destination = f.layout.packageVersionRoot(f.capabilityId, f.version); await mkdir(destination, { recursive: true }); await rename(f.staged.packageRoot, destination); await new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)()).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] }); expect(f.repo.list()).toHaveLength(1); });
  it("does not modify unrelated package directory, pointer, or DB record", async () => { const f = await fixture(); const other = f.layout.packageVersionRoot("other.cap", "1.0.0"); await mkdir(other, { recursive: true }); await writeFile(join(other, "x"), "stable"); await mkdir(join(f.layout.root, "active"), { recursive: true }); await writeFile(`${f.layout.activePointerPath("other.cap")}.json`, "pointer"); f.repo.beginOperation({ operationId: "other", action: "install", stage: "installing", packageName: "other", requestedSpec: "other" }); f.repo.commitInstallation("other", { packageName: "other", itemKind: "capability", itemId: "other.cap", requestedSpec: "other@1.0.0", activeVersion: "1.0.0", activeIntegrity: "other-integrity", activeContentDigest: "other-digest", trust: "community", reviewStatus: "unreviewed", permissionDigest: "other-perm", state: "installed" }); const before = [await readFile(join(other, "x")), await readFile(`${f.layout.activePointerPath("other.cap")}.json`), f.repo.getByPackageName("other")]; await new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)()).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] }); expect(await readFile(join(other, "x"))).toEqual(before[0]); expect(await readFile(`${f.layout.activePointerPath("other.cap")}.json`)).toEqual(before[1]); expect(f.repo.getByPackageName("other")).toEqual(before[2]); });
  it("returns path-free stable records and DTOs", async () => { const f = await fixture(); const result = await new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)()).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] }); expect(JSON.stringify(result)).not.toContain(f.root); });
  it("rolls back package state when configuration initialization fails", async () => { const f = await fixture(); const failing = { initializeInstalledConfiguration: vi.fn(() => { throw new Error("configuration_failed"); }) } as never; await expect(new CapabilityPackageInstaller(f.layout, f.repo, failing, (work) => f.db.transaction(work)()).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] })).rejects.toThrow("package_install_failed"); expect(f.repo.getByPackageName(f.packageName)).toBeUndefined(); await expect(access(f.layout.packageVersionRoot(f.capabilityId, f.version))).rejects.toMatchObject({ code: "ENOENT" }); });
  it("initializes accepted permission defaults ready without sessions or activation", async () => { const f = await fixture(); Object.assign((f.inspected as unknown as { descriptor: { manifest: Record<string, unknown> } }).descriptor.manifest, { settings: { mode: { type: "string", default: "fast" } } }); await new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)()).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] }); expect(f.capabilities.getInstallation(f.capabilityId)).toMatchObject({ permissionDigest: "perm", configured: true }); expect(f.capabilities.getSettings(f.capabilityId)).toEqual([{ key: "mode", value: "fast" }]); expect(f.capabilities.listSessionCapabilities("run")).toEqual([]); });

  it("rolls back settings operation pointer destination temp and sessions when managed commit throws", async () => {
    const f = await fixture(); vi.spyOn(f.repo, "commitInstallation").mockImplementation(() => { throw new Error("db failed"); });
    const pointer = `${f.layout.activePointerPath(f.capabilityId)}.json`;
    await expect(new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)()).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] })).rejects.toThrow("package_install_failed");
    expect(f.capabilities.getInstallation(f.capabilityId)).toBeUndefined(); expect(f.capabilities.getSettings(f.capabilityId)).toEqual([]); expect(f.repo.snapshotOperation("op-1")).toMatchObject({ status: "failed", stage: "installing", errorCode: "package_install_failed" }); expect(f.capabilities.listSessionCapabilities("run")).toEqual([]);
    await expect(access(pointer)).rejects.toMatchObject({ code: "ENOENT" }); await expect(access(f.layout.packageVersionRoot(f.capabilityId, f.version))).rejects.toMatchObject({ code: "ENOENT" }); await expect(access(`${pointer}.${process.pid}.tmp`)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("compensates a fresh catalog refresh failure to exact absence", async () => {
    const f = await fixture(); const pointer = `${f.layout.activePointerPath(f.capabilityId)}.json`;
    const installer = new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)(), { refreshCatalog: async () => { throw new Error("refresh failed"); } });
    await expect(installer.commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] })).rejects.toThrow("package_install_failed");
    expect(f.repo.getByPackageName(f.packageName)).toBeUndefined(); expect(f.capabilities.getInstallation(f.capabilityId)).toBeUndefined(); expect(f.capabilities.getSettings(f.capabilityId)).toEqual([]); expect(f.repo.snapshotOperation("op-1")?.status).toBe("failed"); await expect(access(pointer)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("restores prior managed configuration settings and pointer bytes after catalog failure", async () => {
    const f = await fixture(); const pointer = `${f.layout.activePointerPath(f.capabilityId)}.json`; await mkdir(f.layout.activeRoot, { recursive: true }); await writeFile(pointer, "prior-pointer");
    f.capabilities.saveConfiguration({ capabilityId: f.capabilityId, version: "0.9.0", permissionDigest: "prior-perm", configured: false }, [{ key: "token", secretRef: "secret:old" }]);
    f.repo.restoreInstallation(f.packageName, { packageName: f.packageName, itemKind: "capability", itemId: f.capabilityId, requestedSpec: `${f.packageName}@0.9.0`, activeVersion: "0.9.0", activeIntegrity: "old-i", activeContentDigest: "old-d", trust: "community", reviewStatus: "unreviewed", acceptedPermissionDigest: "prior-perm", state: "installed", createdAt: new Date(10), updatedAt: new Date(20) });
    const beforeManaged = f.repo.getByPackageName(f.packageName); const beforeConfig = f.capabilities.snapshotInstalledConfiguration(f.capabilityId);
    await expect(new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)(), { refreshCatalog: async () => { throw new Error("refresh failed"); } }).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] })).rejects.toThrow("package_install_failed");
    expect(f.repo.getByPackageName(f.packageName)).toEqual(beforeManaged); expect(f.capabilities.snapshotInstalledConfiguration(f.capabilityId)).toEqual(beforeConfig); expect(await readFile(pointer, "utf8")).toBe("prior-pointer");
  });

  it("preserves a pre-existing identical destination when a later refresh fails", async () => {
    const f = await fixture(); const destination = f.layout.packageVersionRoot(f.capabilityId, f.version); await mkdir(destination, { recursive: true }); await rename(f.staged.packageRoot, destination); const before = await readFile(join(destination, "dist/index.js"));
    await expect(new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)(), { refreshCatalog: async () => { throw new Error("no"); } }).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] })).rejects.toThrow("package_install_failed"); expect(await readFile(join(destination, "dist/index.js"))).toEqual(before);
  });

  it("removes orphan settings when restoring an absent prior capability", async () => {
    const f = await fixture(); const snapshot = f.capabilities.snapshotInstalledConfiguration(f.capabilityId); f.db.pragma("foreign_keys = OFF"); f.db.prepare("INSERT INTO capability_settings (id,capability_id,key,value_json,created_at,updated_at) VALUES ('orphan',?,?,?,1,1)").run(f.capabilityId, "x", JSON.stringify("y")); f.capabilities.restoreInstalledConfiguration(snapshot); expect(f.capabilities.getSettings(f.capabilityId)).toEqual([]); expect(f.capabilities.getInstallation(f.capabilityId)).toBeUndefined();
  });

  it.each([
    ["target success", "success"],
    ["committed-path verification failure", "verification"],
    ["managed DB commit failure after capability initialization", "database"],
    ["catalog refresh failure", "catalog"],
  ] as const)("preserves the exact unrelated installed fixture after %s", async (_name, path) => {
    const f = await fixture(); const unrelated = await installUnrelated(f); const before = await snapshotInstalledFixture(unrelated); const hooks: ConstructorParameters<typeof CapabilityPackageInstaller>[4] = {};
    if (path === "verification") hooks.verifyCommittedPath = async () => { throw new Error("verification failed"); };
    if (path === "catalog") hooks.refreshCatalog = async () => { throw new Error("catalog failed"); };
    if (path === "database") vi.spyOn(f.repo, "commitInstallation").mockImplementation(() => { expect(f.capabilities.getInstallation(f.capabilityId)).toBeDefined(); throw new Error("database failed"); });
    const result = new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)(), hooks).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] });
    if (path === "success") await expect(result).resolves.toMatchObject({ packageName: f.packageName }); else await expect(result).rejects.toThrow("package_install_failed");
    expect(await snapshotInstalledFixture(unrelated)).toEqual(before);
  });

  it("fully compensates two consecutive catalog failures through commitFresh without baseline drift", async () => {
    const f = await fixture(); const unrelated = await installUnrelated(f); const unrelatedBaseline = await snapshotInstalledFixture(unrelated); const targetBaseline = { managed: f.repo.getByPackageName(f.packageName), configuration: f.capabilities.snapshotInstalledConfiguration(f.capabilityId) }; const pointer = `${f.layout.activePointerPath(f.capabilityId)}.json`; const destination = f.layout.packageVersionRoot(f.capabilityId, f.version); const temp = `${pointer}.${process.pid}.tmp`;
    const attempts = [{ inspected: f.inspected, contentDigest: f.contentDigest, operationId: "op-1" }, { ...(await createTargetAttempt(f, "op-2")), operationId: "op-2" }];
    for (const attempt of attempts) {
      await expect(new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)(), { refreshCatalog: async () => { throw new Error("catalog failed"); } }).commitFresh(attempt.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: attempt.contentDigest, toolNames: [] })).rejects.toThrow("package_install_failed");
      expect(f.repo.getByPackageName(f.packageName)).toEqual(targetBaseline.managed); expect(f.capabilities.snapshotInstalledConfiguration(f.capabilityId)).toEqual(targetBaseline.configuration); expect(f.repo.snapshotOperation(attempt.operationId)).toMatchObject({ status: "failed", stage: "installing", errorCode: "package_install_failed" });
      await expect(access(pointer)).rejects.toMatchObject({ code: "ENOENT" }); await expect(access(destination)).rejects.toMatchObject({ code: "ENOENT" }); await expect(access(temp)).rejects.toMatchObject({ code: "ENOENT" }); expect(await snapshotInstalledFixture(unrelated)).toEqual(unrelatedBaseline);
    }
  });

  it("does not mutate target state when operation repository snapshot fails", async () => {
    const f = await fixture(); vi.spyOn(f.repo, "snapshotOperation").mockImplementation(() => { throw new Error("snapshot I/O"); });
    await expect(new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)()).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] })).rejects.toThrow("package_install_failed"); expect(f.repo.getByPackageName(f.packageName)).toBeUndefined(); expect(f.capabilities.getInstallation(f.capabilityId)).toBeUndefined(); await expect(access(f.staged.packageRoot)).resolves.toBeUndefined();
  });

  it("propagates non-ENOENT pointer reads as a safe path-free failure without target mutation", async () => {
    const f = await fixture(); const pointer = `${f.layout.activePointerPath(f.capabilityId)}.json`; await mkdir(pointer, { recursive: true });
    let error: Error | undefined; try { await new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)()).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] }); } catch (cause) { error = cause as Error; }
    expect(error?.message).toBe("package_install_failed"); expect(error?.message).not.toContain(f.root); expect(f.repo.getByPackageName(f.packageName)).toBeUndefined(); expect(f.capabilities.getInstallation(f.capabilityId)).toBeUndefined(); await expect(access(f.staged.packageRoot)).resolves.toBeUndefined(); await expect((await import("node:fs/promises")).stat(pointer)).resolves.toMatchObject({});
  });

  for (const failure of ["write", "file-sync", "rename", "directory-sync"] as const) {
    it(`restores exact prior target state after deterministic pointer ${failure} failure`, async () => {
      const f = await fixture(); const unrelated = await installUnrelated(f); const unrelatedBaseline = await snapshotInstalledFixture(unrelated);
      await new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)()).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] });
      const pointer = `${f.layout.activePointerPath(f.capabilityId)}.json`; const distinctivePointer = Buffer.from(`{\"prior\":\"${failure}-pointer-bytes\"}\n`); await writeFile(pointer, distinctivePointer);
      const targetBaseline = { managed: f.repo.getByPackageName(f.packageName), configuration: f.capabilities.snapshotInstalledConfiguration(f.capabilityId), tree: await snapshotTree(f.layout.packageVersionRoot(f.capabilityId, f.version)) };
      const attempt = await createTargetAttempt(f, `op-retry-${failure}`); const temp = `${pointer}.${process.pid}.tmp`; const native = await import("node:fs/promises");
      const fs: InstallerFileSystem = { mkdir: native.mkdir, readFile: (path) => native.readFile(path), stat: native.stat, writeFile: native.writeFile, rm: native.rm,
        rename: async (from, to) => { if (failure === "rename") throw new Error(`${f.root}/rename`); await native.rename(from, to); },
        open: async (path, flags, mode) => { const handle = await native.open(path, flags, mode); return new Proxy(handle, { get(target, property) { if (property === "writeFile" && failure === "write") return async () => { throw new Error(`${f.root}/write`); }; if (property === "sync" && failure === "file-sync") return async () => { throw new Error(`${f.root}/sync`); }; const value = Reflect.get(target, property, target) as unknown; return typeof value === "function" ? value.bind(target) : value; } }) as never; },
        syncDirectory: async () => { if (failure === "directory-sync") throw new Error(`${f.root}/directory-sync`); },
      };
      let error: Error | undefined; try { await new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)(), { fs }).commitFresh(attempt.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: attempt.contentDigest, toolNames: [] }); } catch (cause) { error = cause as Error; }
      expect(error?.message).toBe("package_install_failed"); expect(error?.message).not.toContain(f.root); expect(f.repo.getByPackageName(f.packageName)).toEqual(targetBaseline.managed); expect(f.capabilities.snapshotInstalledConfiguration(f.capabilityId)).toEqual(targetBaseline.configuration); expect(f.repo.snapshotOperation(`op-retry-${failure}`)).toMatchObject({ status: "failed", stage: "installing" });
      expect(await readFile(pointer)).toEqual(distinctivePointer); await expect(access(temp)).rejects.toMatchObject({ code: "ENOENT" }); expect(await snapshotTree(f.layout.packageVersionRoot(f.capabilityId, f.version))).toEqual(targetBaseline.tree); expect(await snapshotInstalledFixture(unrelated)).toEqual(unrelatedBaseline);
    });
  }

  it("records invalid recovery evidence and logs a stable code when cleanup fails", async () => {
    const f = await fixture(); const native = await import("node:fs/promises"); const destination = f.layout.packageVersionRoot(f.capabilityId, f.version); const logs: string[] = []; let renameCalls = 0;
    const fs: InstallerFileSystem = { mkdir: native.mkdir, readFile: (path) => native.readFile(path), stat: native.stat, open: native.open, writeFile: native.writeFile,
      rename: async (from, to) => { renameCalls++; if (renameCalls === 2) throw new Error(`${f.root}/rename`); await native.rename(from, to); }, rm: async (path, options) => { if (path === destination) throw new Error(`${f.root}/cleanup`); await native.rm(path, options); }, syncDirectory: async () => undefined };
    await expect(new CapabilityPackageInstaller(f.layout, f.repo, f.capabilities, (work) => f.db.transaction(work)(), { fs, logger: (code) => logs.push(code) }).commitFresh(f.inspected, { capabilityId: f.capabilityId, version: f.version, contentDigest: f.contentDigest, toolNames: [] })).rejects.toThrow("package_install_failed");
    expect(f.repo.getByPackageName(f.packageName)).toMatchObject({ state: "invalid", errorCode: "package_install_failed" }); expect(f.repo.snapshotOperation("op-1")).toMatchObject({ status: "failed", stage: "installing", errorCode: "package_install_failed" }); expect(logs).toEqual(["package_install_cleanup_failed"]); expect(JSON.stringify(logs)).not.toContain(f.root); await expect(access(destination)).resolves.toBeUndefined();
  });

  it("tolerates only documented Windows directory-sync unsupported codes", () => {
    for (const code of ["EPERM", "EINVAL", "ENOTSUP", "EISDIR", "ENOSYS"]) expect(isUnsupportedDirectorySyncError({ code }, "win32")).toBe(true);
    expect(isUnsupportedDirectorySyncError({ code: "EACCES" }, "win32")).toBe(false);
    expect(isUnsupportedDirectorySyncError({ code: "ENOTSUP" }, "darwin")).toBe(false);
    expect(isUnsupportedDirectorySyncError(new Error("raw"), "win32")).toBe(false);
  });
});
