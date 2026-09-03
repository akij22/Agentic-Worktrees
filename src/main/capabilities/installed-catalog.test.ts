import BetterSqlite3 from "better-sqlite3";
import { access, lstat, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { bootstrapSchemaSql } from "../database/bootstrap";
import { permissionDigest } from "./catalog";
import { digestPackageTree } from "../packages/content-digest";
import { ManagedPackageRepository } from "../packages/package-repository";
import { createManagedPackageLayout } from "../packages/storage-layout";
import { InstalledCapabilityCatalog } from "./installed-catalog";

const roots: string[] = [];
afterEach(async () => { while (roots.length) await rm(roots.pop()!, { recursive: true, force: true }); });
const absent = async (path: string) => expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
function descriptor(id: string, version: string) { return { manifest: { id, version, name: id, description: "Search", sdkVersion: ">=0.1.0", category: "utility", author: { name: "Demo" }, license: "MIT", compatibility: { codex: "supported" as const, opencode: "unsupported" as const }, permissions: { network: [], secrets: [] }, settings: {} }, tools: [] }; }
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "installed-catalog-")); roots.push(root); const layout = createManagedPackageLayout(root); const db = new BetterSqlite3(":memory:"); db.exec(bootstrapSchemaSql); const repo = new ManagedPackageRepository(db);
  async function install(id: string, version = "1.0.0", packageName = `@demo/${id.replace(".", "-")}`) {
    const packageRoot = layout.packageVersionRoot(id, version); await mkdir(join(packageRoot, "dist"), { recursive: true }); const manifest = descriptor(id, version);
    await writeFile(join(packageRoot, "capability.json"), JSON.stringify(manifest)); await writeFile(join(packageRoot, "dist/index.js"), `export const version=${JSON.stringify(version)};`);
    const contentDigest = await digestPackageTree(packageRoot); const integrity = `integrity-${version}`; await mkdir(layout.activeRoot, { recursive: true });
    const pointerPath = `${layout.activePointerPath(id)}.json`; const pointer = { packageName, capabilityId: id, version, integrity, contentDigest, manifestPath: "./capability.json", entryPath: "./dist/index.js" }; await writeFile(pointerPath, JSON.stringify(pointer));
    const existing = repo.getByPackageName(packageName); const record = { packageName, itemKind: "capability" as const, itemId: id, requestedSpec: `${packageName}@${version}`, activeVersion: version, activeIntegrity: integrity, activeContentDigest: contentDigest, trust: "community" as const, reviewStatus: "unreviewed" as const, acceptedPermissionDigest: permissionDigest(manifest.manifest), state: "installed" as const, createdAt: existing?.createdAt ?? new Date(), updatedAt: new Date() };
    repo.restoreInstallation(packageName, record); return { id, version, packageName, packageRoot, pointerPath, pointer, manifest, contentDigest, integrity };
  }
  const installed = await install("demo.search"); return { root, layout, db, repo, install, ...installed };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function rewritePointer(f: Fixture, change: (pointer: Record<string, unknown>) => void) { const value = JSON.parse(await readFile(f.pointerPath, "utf8")) as Record<string, unknown>; change(value); await writeFile(f.pointerPath, JSON.stringify(value)); expect(JSON.parse(await readFile(f.pointerPath, "utf8"))).toEqual(value); }
async function expectRejectedWithPrior(f: Fixture, mutate: (fixture: Fixture) => Promise<void>) {
  const catalog = new InstalledCapabilityCatalog(f.layout, f.repo); await catalog.refresh(); const previous = catalog.list(); const content = structuredClone(previous); await mutate(f);
  let error: Error | undefined; try { await catalog.refresh(); } catch (cause) { error = cause as Error; }
  expect(error?.message).toBe("package_install_failed"); expect(error?.message).not.toContain(f.root); expect(catalog.list()).toBe(previous); expect(catalog.list()).toEqual(content);
}

interface RejectionCase { name: string; mutate: (f: Fixture) => Promise<void> }
const pointerCases: RejectionCase[] = [
  { name: "missing pointer", mutate: async f => { await rm(f.pointerPath); await absent(f.pointerPath); } },
  { name: "malformed pointer JSON", mutate: async f => { await writeFile(f.pointerPath, "{"); expect(await readFile(f.pointerPath, "utf8")).toBe("{"); } },
  { name: "oversized pointer", mutate: async f => { await writeFile(f.pointerPath, "x".repeat(64 * 1024 + 1)); expect((await lstat(f.pointerPath)).size).toBeGreaterThan(64 * 1024); } },
  { name: "unknown pointer field", mutate: f => rewritePointer(f, p => { p.unknown = true; }) },
  { name: "missing pointer field", mutate: f => rewritePointer(f, p => { delete p.entryPath; }) },
  { name: "legacy pointer digest alias", mutate: f => rewritePointer(f, p => { p.digest = p.contentDigest; delete p.contentDigest; }) },
  ...(["packageName", "capabilityId", "version", "integrity", "contentDigest"] as const).map(field => ({ name: `${field} identity mismatch`, mutate: (f: Fixture) => rewritePointer(f, p => { p[field] = `wrong-${field}`; }) })),
];
const pathCases: RejectionCase[] = [
  { name: "absolute POSIX manifest path", mutate: f => rewritePointer(f, p => { p.manifestPath = "/tmp/escape"; }) },
  { name: "Windows drive entry path", mutate: f => rewritePointer(f, p => { p.entryPath = "C:\\escape.js"; }) },
  { name: "Windows UNC entry path", mutate: f => rewritePointer(f, p => { p.entryPath = "\\\\server\\share\\x.js"; }) },
  { name: "traversal manifest path", mutate: f => rewritePointer(f, p => { p.manifestPath = "../escape.json"; }) },
  { name: "backslash separator ambiguity", mutate: f => rewritePointer(f, p => { p.entryPath = "dist\\index.js"; }) },
  { name: "NUL path", mutate: f => rewritePointer(f, p => { p.entryPath = "dist/\0index.js"; }) },
];
const filesystemCases: RejectionCase[] = [
  { name: "pointer symlink", mutate: async f => { const target = `${f.pointerPath}.target`; await rename(f.pointerPath, target); await symlink(target, f.pointerPath); expect((await lstat(f.pointerPath)).isSymbolicLink()).toBe(true); } },
  { name: "package-root symlink", mutate: async f => { const target = `${f.packageRoot}.target`; await rename(f.packageRoot, target); await symlink(target, f.packageRoot); expect((await lstat(f.packageRoot)).isSymbolicLink()).toBe(true); } },
  { name: "manifest symlink", mutate: async f => { const path = join(f.packageRoot, "capability.json"), target = join(f.packageRoot, "manifest-target.json"); await rename(path, target); await symlink(target, path); expect((await lstat(path)).isSymbolicLink()).toBe(true); } },
  { name: "entry symlink", mutate: async f => { const path = join(f.packageRoot, "dist/index.js"), target = join(f.packageRoot, "dist/target.js"); await rename(path, target); await symlink(target, path); expect((await lstat(path)).isSymbolicLink()).toBe(true); } },
  { name: "non-file entry", mutate: async f => { const path = join(f.packageRoot, "dist/index.js"); await rm(path); await mkdir(path); expect((await lstat(path)).isDirectory()).toBe(true); } },
  { name: "missing package root", mutate: async f => { await rm(f.packageRoot, { recursive: true }); await absent(f.packageRoot); } },
  { name: "missing manifest", mutate: async f => { const path = join(f.packageRoot, "capability.json"); await rm(path); await absent(path); } },
  { name: "missing entry", mutate: async f => { const path = join(f.packageRoot, "dist/index.js"); await rm(path); await absent(path); } },
  { name: "oversized manifest", mutate: async f => { const path = join(f.packageRoot, "capability.json"); await writeFile(path, "x".repeat(256 * 1024 + 1)); expect((await lstat(path)).size).toBeGreaterThan(256 * 1024); } },
];
const descriptorCases: RejectionCase[] = [
  { name: "invalid static descriptor", mutate: async f => { const path = join(f.packageRoot, "capability.json"); await writeFile(path, "{}"); expect(await readFile(path, "utf8")).toBe("{}"); } },
  { name: "descriptor capability ID mismatch", mutate: async f => { const path = join(f.packageRoot, "capability.json"); await writeFile(path, JSON.stringify(descriptor("other.id", f.version))); expect(await readFile(path, "utf8")).toContain("other.id"); } },
  { name: "descriptor version mismatch", mutate: async f => { const path = join(f.packageRoot, "capability.json"); await writeFile(path, JSON.stringify(descriptor(f.id, "9.0.0"))); expect(await readFile(path, "utf8")).toContain("9.0.0"); } },
  { name: "package tree tamper", mutate: async f => { const path = join(f.packageRoot, "dist/index.js"); await writeFile(path, "tampered"); expect(await readFile(path, "utf8")).toBe("tampered"); } },
  { name: "accepted permission digest mismatch", mutate: async f => { f.db.prepare("UPDATE managed_package_installations SET accepted_permission_digest = ? WHERE package_name = ?").run("wrong-permission", f.packageName); expect(f.repo.getByPackageName(f.packageName)?.acceptedPermissionDigest).toBe("wrong-permission"); } },
];

describe("InstalledCapabilityCatalog", () => {
  it("starts with an immutable empty snapshot", () => { const catalog = new InstalledCapabilityCatalog({} as never, { list: () => [] } as never); expect(catalog.list()).toEqual([]); expect(Object.isFrozen(catalog.list())).toBe(true); });
  it("loads multiple real entries in deterministic ID/version order and performs exact lookup", async () => { const f = await fixture(); await f.install("alpha.cap", "2.0.0"); await f.install("zeta.cap", "0.5.0"); const catalog = new InstalledCapabilityCatalog(f.layout, f.repo); await catalog.refresh(); expect(catalog.list().map(entry => `${entry.record.itemId}@${entry.record.activeVersion}`)).toEqual(["alpha.cap@2.0.0", "demo.search@1.0.0", "zeta.cap@0.5.0"]); expect(catalog.get("demo.search", "1.0.0")).toBe(catalog.list()[1]); expect(catalog.get("demo.search", "2.0.0")).toBeUndefined(); expect(catalog.get("missing")).toBeUndefined(); });
  it("publishes recursively immutable entries, records, descriptors, arrays, and nested objects", async () => { const f = await fixture(); const catalog = new InstalledCapabilityCatalog(f.layout, f.repo); await catalog.refresh(); const entry = catalog.list()[0]; expect([catalog.list(), entry, entry.record, entry.descriptor, entry.descriptor.manifest, entry.descriptor.tools, entry.descriptor.manifest.permissions]).toSatisfy(values => values.every(Object.isFrozen)); });
  it.each(["incompatible", "migration_pending", "invalid"] as const)("omits %s managed records without touching their files", async state => { const f = await fixture(); f.db.prepare("UPDATE managed_package_installations SET state = ?, active_version = CASE WHEN ? = 'migration_pending' THEN NULL ELSE active_version END WHERE package_name = ?").run(state, state, f.packageName); expect(f.repo.getByPackageName(f.packageName)?.state).toBe(state); const catalog = new InstalledCapabilityCatalog(f.layout, f.repo); await catalog.refresh(); expect(catalog.list()).toEqual([]); expect(await readFile(f.pointerPath, "utf8")).toContain(f.id); });
  for (const testCase of pointerCases) it(`rejects ${testCase.name} and preserves the exact prior snapshot`, async () => expectRejectedWithPrior(await fixture(), testCase.mutate));
  for (const testCase of pathCases) it(`rejects ${testCase.name} and preserves the exact prior snapshot`, async () => expectRejectedWithPrior(await fixture(), testCase.mutate));
  for (const testCase of filesystemCases) it(`rejects ${testCase.name} and preserves the exact prior snapshot`, async () => expectRejectedWithPrior(await fixture(), testCase.mutate));
  for (const testCase of descriptorCases) it(`rejects ${testCase.name} and preserves the exact prior snapshot`, async () => expectRejectedWithPrior(await fixture(), testCase.mutate));
  it("rejects an entry replacement between digest passes without publishing partial state", async () => { const f = await fixture(); let armed = false; const entry = join(f.packageRoot, "dist/index.js"); const catalog = new InstalledCapabilityCatalog(f.layout, f.repo, { afterFirstDigest: async () => { if (armed) { const old = `${entry}.old`; await rename(entry, old); await writeFile(entry, "replacement"); expect(await readFile(entry, "utf8")).toBe("replacement"); } } }); await catalog.refresh(); const previous = catalog.list(); const content = structuredClone(previous); armed = true; await expect(catalog.refresh()).rejects.toThrow("package_install_failed"); expect(catalog.list()).toBe(previous); expect(catalog.list()).toEqual(content); });
  it("serializes controlled concurrent refreshes so the newest invocation publishes last", async () => { const f = await fixture(); let release!: () => void; let reached!: () => void; const paused = new Promise<void>(resolve => { release = resolve; }); const firstReached = new Promise<void>(resolve => { reached = resolve; }); let calls = 0; const catalog = new InstalledCapabilityCatalog(f.layout, f.repo, { afterFirstDigest: async () => { if (calls++ === 0) { reached(); await paused; } } }); const older = catalog.refresh(); await firstReached; const newest = await f.install(f.id, "2.0.0", f.packageName); const newer = catalog.refresh(); release(); await expect(older).resolves.toBeUndefined(); await expect(newer).resolves.toBeUndefined(); expect(catalog.list().map(entry => entry.record.activeVersion)).toEqual([newest.version]); expect(catalog.get(f.id, "2.0.0")).toBeDefined(); expect(catalog.get(f.id, "1.0.0")).toBeUndefined(); });
});
