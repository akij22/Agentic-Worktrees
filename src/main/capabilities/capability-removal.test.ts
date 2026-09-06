import BetterSqlite3 from "better-sqlite3";
import { mkdtemp, mkdir, writeFile, readFile, access, rm, rename } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapSchemaSql } from "../database/bootstrap";
import { ManagedPackageRepository } from "../packages/package-repository";
import { createManagedPackageLayout } from "../packages/storage-layout";
import { digestPackageTree } from "../packages/content-digest";
import { PackageLock } from "../packages/package-lock";
import { CapabilityRepository } from "./capability-repository";
import { CapabilityDistributionService } from "./capability-distribution-service";
import { CapabilityRemovalInstaller } from "./capability-removal-installer";
import { capabilityRemovalInspectionSchema, capabilityDistributionProgressSchema } from "../../shared/packages/schemas";

const packageName = "@example/search", capabilityId = "example.search";
const roots: string[] = [], databases: BetterSqlite3.Database[] = [];
afterEach(async () => { for (const db of databases.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture(active = false) {
  const root = await mkdtemp(join(tmpdir(), "cap-remove-")); roots.push(root);
  const layout = createManagedPackageLayout(root), db = new BetterSqlite3(":memory:"); databases.push(db); db.exec(bootstrapSchemaSql);
  const repository = new ManagedPackageRepository(db), capabilities = new CapabilityRepository(db);
  for (const version of ["1.0.0", "2.0.0", "3.0.0"]) {
    const directory = layout.packageVersionRoot(capabilityId, version); await mkdir(directory, { recursive: true }); await writeFile(join(directory, "index.js"), `exports.version = '${version}';`);
  }
  const pointer = { packageName, capabilityId, version: "2.0.0", integrity: "sha512-integrity", contentDigest: await digestPackageTree(layout.packageVersionRoot(capabilityId, "2.0.0")), manifestPath: "./capability.json", entryPath: "./index.js" };
  await mkdir(layout.activeRoot, { recursive: true }); await writeFile(`${layout.activePointerPath(capabilityId)}.json`, JSON.stringify(pointer));
  repository.beginOperation({ operationId: "initial", action: "install", stage: "installing", packageName, requestedSpec: `${packageName}@2.0.0` });
  repository.commitInstallation("initial", { packageName, itemKind: "capability", itemId: capabilityId, requestedSpec: `${packageName}@2.0.0`, activeVersion: "2.0.0", activeIntegrity: pointer.integrity, activeContentDigest: pointer.contentDigest, permissionDigest: "permissions", trust: "community", reviewStatus: "unreviewed", state: "installed" });
  capabilities.saveConfiguration({ capabilityId, version: "2.0.0", permissionDigest: "permissions", configured: true }, [{ key: "token", secretRef: "opaque-ref" }, { key: "limit", value: 7 }]);
  if (active) {
    db.exec("INSERT INTO repositories (id,github_repo_id,owner_login,name,full_name,is_private,is_archived,clone_url,html_url,local_clone_status,created_at,updated_at) VALUES ('repo',1,'o','r','o/r',0,0,'','','ready',1,1); INSERT INTO worktrees (id,repository_id,name,path,branch_name,status,created_at,updated_at) VALUES ('wt','repo','wt','/test','main','ready',1,1)");
    for (const runId of ["run-1", "run-2"]) {
      db.prepare("INSERT INTO runs (id,repository_id,worktree_id,title,prompt,status,created_at,updated_at) VALUES (?,'repo','wt','Run','','idle',1,1)").run(runId);
      capabilities.transitionSessionCapability({ runId, capabilityId, version: "2.0.0", to: "pending_activation" });
      capabilities.transitionSessionCapability({ runId, capabilityId, version: "2.0.0", to: "active" });
    }
  }
  const sessions = capabilities.snapshotSessionCapabilities(capabilityId);
  const coordinator = {
    assertManagedCapability: vi.fn(), activeRunCount: () => capabilities.listActiveRunsByCapabilityId(capabilityId).length,
    listActiveRuns: () => capabilities.listActiveRunsByCapabilityId(capabilityId), assertRunsIdle: vi.fn().mockResolvedValue(undefined),
    deactivateRuns: vi.fn(async () => { for (const runId of coordinator.listActiveRuns()) { capabilities.transitionSessionCapability({ runId, capabilityId, version: "2.0.0", to: "pending_deactivation" }); capabilities.transitionSessionCapability({ runId, capabilityId, version: "2.0.0", to: "inactive" }); } }),
    reactivateRuns: vi.fn(async () => capabilities.restoreSessionCapabilities(sessions)), finalizeDeactivation: vi.fn(), reloadRuns: vi.fn(), restoreRuns: vi.fn(),
  };
  const refresh = vi.fn().mockResolvedValue(undefined), catalog = { refresh, get: vi.fn(() => repository.getByPackageName(packageName) ? { descriptor: { manifest: { id: capabilityId, version: "2.0.0" } } } : undefined) };
  const fs = { rename: vi.fn(rename), rm: vi.fn(rm) };
  const installer = new CapabilityRemovalInstaller(layout, repository, capabilities, (work) => db.transaction(work)(), { refreshCatalog: refresh, fs });
  const credentials = { removeSecret: vi.fn().mockResolvedValue(undefined) }, verifier = { verify: vi.fn() }, acquirer = { acquire: vi.fn(), discard: vi.fn() };
  const lock = new PackageLock(join(root, ".lock"));
  const service = new CapabilityDistributionService({ layout, repository, capabilityRepository: capabilities, installedCatalog: catalog as never, sessionCoordinator: coordinator, removalInstaller: installer, credentials, verifier: verifier as never, acquirer: acquirer as never, packageLock: lock });
  const inspect = () => service.inspectRemoval({ packageName });
  const accept = (dto: Awaited<ReturnType<typeof inspect>>) => ({ inspectionId: dto.inspectionId, packageName, acceptedActiveVersion: dto.activeVersion, acceptedActiveRunCount: active ? 2 : 0 });
  const before = { installation: repository.getByPackageName(packageName), configuration: capabilities.snapshotInstalledConfiguration(capabilityId), sessions, pointer: await readFile(`${layout.activePointerPath(capabilityId)}.json`) };
  const restored = async () => { expect(repository.getByPackageName(packageName)).toEqual(before.installation); expect(capabilities.snapshotInstalledConfiguration(capabilityId)).toEqual(before.configuration); expect(await readFile(`${layout.activePointerPath(capabilityId)}.json`)).toEqual(before.pointer); expect(capabilities.snapshotSessionCapabilities(capabilityId)).toEqual(before.sessions); };
  return { root, layout, db, repository, capabilities, coordinator, refresh, catalog, fs, installer, credentials, verifier, acquirer, service, inspect, accept, before, restored };
}

describe("managed capability removal", () => {
  it("reviews immutable exact identity and count without acquire, verification or filesystem mutation", async () => {
    const f = await fixture(true); const dto = await f.inspect();
    expect(capabilityRemovalInspectionSchema.parse(dto)).toEqual(dto); expect(dto).toMatchObject({ packageName, capabilityId, activeVersion: "2.0.0", activeRunCount: 2 });
    expect(Object.isFrozen(dto)).toBe(true); expect(JSON.stringify(dto)).not.toContain(f.root);
    expect(f.acquirer.acquire).not.toHaveBeenCalled(); expect(f.verifier.verify).not.toHaveBeenCalled(); expect(f.fs.rename).not.toHaveBeenCalled();
    await f.service.cancel(dto.inspectionId);
  });
  it("removes pointer and configuration while retaining the previous stable executable", async () => {
    const f = await fixture(); const dto = await f.inspect(); await f.service.remove(f.accept(dto));
    expect(f.repository.getByPackageName(packageName)).toBeUndefined(); expect(f.capabilities.getInstallation(capabilityId)).toBeUndefined();
    await expect(access(`${f.layout.activePointerPath(capabilityId)}.json`)).rejects.toThrow();
    await expect(access(f.layout.packageVersionRoot(capabilityId, "2.0.0"))).resolves.toBeUndefined();
    await expect(access(f.layout.packageVersionRoot(capabilityId, "1.0.0"))).rejects.toThrow();
    expect(f.credentials.removeSecret).toHaveBeenCalledWith("opaque-ref"); expect(f.coordinator.reactivateRuns).not.toHaveBeenCalled();
  });
  it("fails closed for bundled URL Fetch without touching installers or activation", async () => {
    const f = await fixture(); await expect(f.service.inspectRemoval({ packageName: "@agentic-worktrees/url-fetch" })).rejects.toThrow("package_not_found");
    expect(f.fs.rename).not.toHaveBeenCalled(); expect(f.coordinator.deactivateRuns).not.toHaveBeenCalled();
  });
  it("rejects a changed accepted active-run count", async () => {
    const f = await fixture(true); const dto = await f.inspect(); await expect(f.service.remove({ ...f.accept(dto), acceptedActiveRunCount: 1 })).rejects.toThrow("package_permission_denied"); expect(f.coordinator.deactivateRuns).not.toHaveBeenCalled();
  });
  it("rejects a changed accepted active version", async () => {
    const f = await fixture(); const dto = await f.inspect(); await expect(f.service.remove({ ...f.accept(dto), acceptedActiveVersion: "1.0.0" })).rejects.toThrow("package_permission_denied"); expect(f.fs.rename).not.toHaveBeenCalled();
  });
  it("rejects non-idle active runs before persistent mutation", async () => {
    const f = await fixture(true); f.coordinator.assertRunsIdle.mockRejectedValueOnce(new Error("busy")); const dto = await f.inspect(); await expect(f.service.remove(f.accept(dto))).rejects.toThrow("package_install_failed"); await f.restored();
  });
  it("deactivates every active run and never auto-reactivates after success", async () => {
    const f = await fixture(true); const dto = await f.inspect(); await f.service.remove(f.accept(dto)); expect(f.coordinator.deactivateRuns).toHaveBeenCalledOnce(); expect(f.coordinator.finalizeDeactivation).toHaveBeenCalledOnce(); expect(f.coordinator.reactivateRuns).not.toHaveBeenCalled();
  });
  it("restores the exact snapshot when pointer detachment fails", async () => {
    const f = await fixture(true); f.fs.rename.mockRejectedValueOnce(new Error("pointer")); const dto = await f.inspect(); await expect(f.service.remove(f.accept(dto))).rejects.toThrow("package_remove_failed"); await f.restored(); expect(f.coordinator.reactivateRuns).toHaveBeenCalledOnce();
  });
  it("restores pointer, database, catalog and sessions when catalog publication fails", async () => {
    const f = await fixture(true); f.refresh.mockRejectedValueOnce(new Error("catalog")); const dto = await f.inspect(); await expect(f.service.remove(f.accept(dto))).rejects.toThrow("package_remove_failed"); await f.restored(); expect(f.refresh).toHaveBeenCalledTimes(2);
  });
  it("restores garbage-collected directories when a later GC rename fails", async () => {
    const f = await fixture(); f.fs.rename.mockImplementationOnce(rename).mockImplementationOnce(rename).mockRejectedValueOnce(new Error("gc")); const dto = await f.inspect(); await expect(f.service.remove(f.accept(dto))).rejects.toThrow("package_remove_failed"); await f.restored(); await expect(access(f.layout.packageVersionRoot(capabilityId, "1.0.0"))).resolves.toBeUndefined();
  });
  it("quarantines durable recovery when runtime reactivation fails", async () => {
    const f = await fixture(true); f.refresh.mockRejectedValueOnce(new Error("catalog")); f.coordinator.reactivateRuns.mockRejectedValueOnce(new Error("provider")); const dto = await f.inspect(); await expect(f.service.remove(f.accept(dto))).rejects.toThrow("package_remove_failed"); expect(f.repository.listRemovalRecoveries()).toHaveLength(1); expect(f.repository.getByPackageName(packageName)?.state).toBe("blocked");
  });
  it("preserves session-associated active versions during garbage collection", async () => {
    const f = await fixture(true); const dto = await f.inspect(); await f.service.remove(f.accept(dto)); await expect(access(f.layout.packageVersionRoot(capabilityId, "2.0.0"))).resolves.toBeUndefined();
  });
  it("retains exact session associations until removal commits", async () => {
    const f = await fixture(true); const dto = await f.inspect(); expect(f.capabilities.snapshotSessionCapabilities(capabilityId)).toEqual(f.before.sessions); await f.service.cancel(dto.inspectionId); expect(f.capabilities.snapshotSessionCapabilities(capabilityId)).toEqual(f.before.sessions);
  });
  it("journals cleanup failure for reconciliation retry", async () => {
    const f = await fixture(); f.fs.rm.mockRejectedValueOnce(new Error("cleanup")); const dto = await f.inspect(); await expect(f.service.remove(f.accept(dto))).rejects.toThrow("package_remove_failed"); expect(f.repository.listRemovalRecoveries()[0]?.stage).toBe("cleanup_pending");
  });
  it("reconciles cleanup-pending removal without activation", async () => {
    const f = await fixture(); f.fs.rm.mockRejectedValueOnce(new Error("cleanup")); const dto = await f.inspect(); await expect(f.service.remove(f.accept(dto))).rejects.toThrow(); await f.service.reconcileInterruptedOperations(); expect(f.repository.listRemovalRecoveries()).toHaveLength(0); expect(f.coordinator.reactivateRuns).not.toHaveBeenCalled();
  });
  it("serializes a second removal inspection behind the consent lease", async () => {
    const f = await fixture(); const first = await f.inspect(); let settled = false; const second = f.inspect().finally(() => { settled = true; }); await Promise.resolve(); expect(settled).toBe(false); await f.service.cancel(first.inspectionId); await expect(second).resolves.toMatchObject({ packageName });
  });
  it("emits path-free frozen schema-valid removal progress", async () => {
    const f = await fixture(); const events: unknown[] = []; const unsubscribe = f.service.subscribe((event) => events.push(event)); const dto = await f.inspect(); await f.service.remove(f.accept(dto)); unsubscribe(); expect(events.length).toBeGreaterThan(1); for (const event of events) { expect(capabilityDistributionProgressSchema.parse(event)).toEqual(event); expect(Object.isFrozen(event)).toBe(true); expect(JSON.stringify(event)).not.toContain(f.root); }
  });
  it("returns immutable path-free terminal errors", async () => {
    const f = await fixture(); f.fs.rename.mockRejectedValueOnce(new Error(`${f.root}/secret`)); const dto = await f.inspect(); const error = await f.service.remove(f.accept(dto)).catch((value: unknown) => value); expect(error).toMatchObject({ message: "package_remove_failed", stack: undefined }); expect(Object.isFrozen(error)).toBe(true); expect(JSON.stringify(error)).not.toContain(f.root);
  });
  it("cleans the recovery journal and staging directory exactly once after success", async () => {
    const f = await fixture(); const dto = await f.inspect(); await f.service.remove(f.accept(dto)); expect(f.repository.listRemovalRecoveries()).toHaveLength(0); expect(f.fs.rm).toHaveBeenCalledOnce();
  });
});
