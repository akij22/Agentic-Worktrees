import BetterSqlite3 from "better-sqlite3";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CapabilityManifest } from "@agentic-worktrees/capability-sdk";
import {
  packageInspectRequestSchema,
  capabilityPackageInspectionSchema,
  capabilityDistributionProgressSchema,
} from "../../shared/packages/schemas";
import { bootstrapSchemaSql } from "../database/bootstrap";
import { initDatabase } from "../database";
import * as databaseClient from "../database/client";
import { createManagedPackageLayout } from "../packages/storage-layout";
import { digestPackageTree } from "../packages/content-digest";
import { ManagedPackageRepository } from "../packages/package-repository";
import { PackageLock } from "../packages/package-lock";
import { CapabilityRepository } from "./capability-repository";
import { CapabilityService } from "./capability-service";
import { CapabilityPackageInstaller } from "./capability-package-installer";
import { CapabilityDistributionService } from "./capability-distribution-service";
import type { InspectedCapabilityPackage } from "./package-inspector";

const roots: string[] = [],
  databases: BetterSqlite3.Database[] = [];
afterEach(async () => {
  for (const db of databases.splice(0)) if (db.open) db.close();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
const packageName = "@example/search",
  capabilityId = "example.search";
const manifest = (
  version: string,
  settings: CapabilityManifest["settings"] = {},
) =>
  ({
    id: capabilityId,
    version,
    name: "Search",
    description: "Search",
    category: "test",
    sdkVersion: ">=0.1.0",
    author: { name: "Test" },
    license: "MIT",
    compatibility: { codex: "supported", opencode: "supported" },
    permissions: { network: [], secrets: [] },
    settings,
  }) as CapabilityManifest;
async function fixture(
  options: {
    nextVersion?: string;
    settings?: CapabilityManifest["settings"];
    active?: boolean;
    durable?: boolean;
  } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "update-lifecycle-"));
  roots.push(root);
  const layout = createManagedPackageLayout(root),
    db = new BetterSqlite3(options.durable ? join(root, "state.sqlite") : ":memory:");
  databases.push(db);
  db.exec(bootstrapSchemaSql);
  const repository = new ManagedPackageRepository(db),
    capabilities = new CapabilityRepository(db);
  const oldManifest = manifest("1.0.0", {
    token: { type: "secret", required: false },
    limit: { type: "integer", default: 5 },
  });
  const nextManifest = manifest(
    options.nextVersion ?? "2.0.0",
    options.settings ?? oldManifest.settings,
  );
  async function candidate(
    operationId: string,
    m: CapabilityManifest,
    requestedSpec = `${packageName}@${m.version}`,
  ): Promise<InspectedCapabilityPackage> {
    const packageRoot = join(
      layout.stagingOperationRoot(operationId),
      "package",
    );
    await mkdir(join(packageRoot, "dist"), { recursive: true });
    const descriptor = {
      manifest: m,
      entry: "./dist/index.js",
      tools: [
        {
          name: "search",
          description: "Search",
          inputSchema: { type: "object" },
        },
      ],
    };
    const packageMetadata = {
      kind: "capability" as const,
      manifest: "./capability.json",
      entry: "./dist/index.js",
    };
    await writeFile(
      join(packageRoot, "package.json"),
      JSON.stringify({
        name: packageName,
        version: m.version,
        agenticWorktrees: packageMetadata,
      }),
    );
    await writeFile(
      join(packageRoot, "capability.json"),
      JSON.stringify(descriptor),
    );
    await writeFile(
      join(packageRoot, "dist/index.js"),
      `export const version = '${m.version}';`,
    );
    return {
      staged: {
        operationId,
        packageRoot,
        packageName,
        packageJson: { name: packageName, version: m.version },
        requestedSpec,
        resolvedVersion: m.version,
        integrity: "sha512-review",
        releaseNotes: "Reviewed release notes",
        contentDigest: await digestPackageTree(packageRoot),
      },
      descriptor,
      packageMetadata,
      permissionDigest:
        m.version === "1.0.0" ? "old-permissions" : "new-permissions",
      trust: "community",
      reviewStatus: "unreviewed",
    };
  }
  const catalogRefresh = vi.fn().mockResolvedValue(undefined);
  const installer = new CapabilityPackageInstaller(
    layout,
    repository,
    capabilities,
    (work) => db.transaction(work)(),
    { refreshCatalog: catalogRefresh },
  );
  const old = await candidate("original", oldManifest);
  repository.beginOperation({
    operationId: "original",
    action: "install",
    stage: "installing",
    packageName,
    requestedSpec: old.staged.requestedSpec,
  });
  await installer.commitFresh(old, {
    capabilityId,
    version: oldManifest.version,
    contentDigest: old.staged.contentDigest,
    toolNames: ["search"],
  });
  capabilities.saveConfiguration(
    {
      capabilityId,
      version: "1.0.0",
      permissionDigest: "old-permissions",
      configured: true,
    },
    [
      { key: "token", secretRef: "opaque-ref" },
      { key: "limit", value: 7 },
    ],
  );
  if (options.active) {
    db.prepare(
      "INSERT INTO repositories (id,github_repo_id,owner_login,name,full_name,is_private,is_archived,clone_url,html_url,local_clone_status,created_at,updated_at) VALUES ('repo',1,'o','r','o/r',0,0,'','','ready',1,1)",
    ).run();
    db.prepare(
      "INSERT INTO worktrees (id,repository_id,name,path,branch_name,status,created_at,updated_at) VALUES ('wt','repo','wt','/test','main','ready',1,1)",
    ).run();
    for (const runId of ["run-1", "run-2"]) {
      db.prepare(
        "INSERT INTO runs (id,repository_id,worktree_id,title,prompt,status,created_at,updated_at) VALUES (?,'repo','wt','Run','','idle',1,1)",
      ).run(runId);
      capabilities.transitionSessionCapability({
        runId,
        capabilityId,
        version: "1.0.0",
        to: "pending_activation",
      });
      capabilities.transitionSessionCapability({
        runId,
        capabilityId,
        version: "1.0.0",
        to: "active",
      });
    }
  }
  const snapshot = () => capabilities.snapshotSessionCapabilities(capabilityId);
  const coordinator = {
    activeRunCount: () =>
      capabilities.listActiveRunsByCapabilityId(capabilityId).length,
    assertManagedCapability: () => undefined,
    finalizeDeactivation: vi.fn(),
    listActiveRuns: () =>
      capabilities.listActiveRunsByCapabilityId(capabilityId),
    assertRunsIdle: vi.fn().mockResolvedValue(undefined),
    reloadRuns: vi.fn(async (_id: string, version: string) =>
      capabilities.updateSessionCapabilityVersions(
        capabilityId,
        coordinator.listActiveRuns(),
        version,
      ),
    ),
    restoreRuns: vi.fn(async (_id: string, version: string) =>
      capabilities.updateSessionCapabilityVersions(
        capabilityId,
        coordinator.listActiveRuns(),
        version,
      ),
    ),
    deactivateRuns: vi.fn(async () => {
      for (const runId of coordinator.listActiveRuns()) {
        capabilities.transitionSessionCapability({
          runId,
          capabilityId,
          version: "1.0.0",
          to: "pending_deactivation",
        });
        capabilities.transitionSessionCapability({
          runId,
          capabilityId,
          version: "1.0.0",
          to: "inactive",
        });
      }
    }),
    reactivateRuns: vi.fn().mockResolvedValue(undefined),
  };
  let inspected: InspectedCapabilityPackage;
  const verifier = {
    verify: vi.fn(async (value: InspectedCapabilityPackage) => ({
      capabilityId,
      version: value.staged.resolvedVersion,
      contentDigest: value.staged.contentDigest,
      toolNames: ["search"],
    })),
  };
  const credentials = { removeSecret: vi.fn().mockResolvedValue(undefined) };
  const lock = new PackageLock(join(root, ".lock"));
  const lockSpy = vi.spyOn(lock, "runExclusive");
  const acquire = vi.fn(async (operationId: string, requestedSpec: string) => {
    inspected = await candidate(operationId, nextManifest, requestedSpec);
    return inspected.staged;
  });
  const service = new CapabilityDistributionService({
    layout,
    repository,
    capabilityRepository: capabilities,
    installer,
    verifier: verifier as never,
    packageLock: lock,
    sessionCoordinator: coordinator,
    credentials,
    installedCatalog: {
      refresh: catalogRefresh,
      get: () => ({ descriptor: { manifest: oldManifest } }),
    } as never,
    acquirer: {
      acquire,
      discard: async (operationId: string) =>
        rm(layout.stagingOperationRoot(operationId), {
          recursive: true,
          force: true,
        }),
    } as never,
    inspector: { inspect: async () => inspected } as never,
  });
  const inspect = () =>
    service.inspect({
      sourceSpec: `${packageName}@${nextManifest.version}`,
      intent: "update",
    });
  const accept = (dto: Awaited<ReturnType<typeof inspect>>) => ({
    inspectionId: dto.inspectionId,
    packageName,
    acceptedPackageName: dto.packageName,
    acceptedVersion: dto.resolvedVersion,
    acceptedIntegrity: dto.integrity,
    acceptedPermissionDigest: dto.permissionDigest,
    acceptedDowngrade: false,
    acceptedActiveRunCount: options.active ? 2 : 0,
  });
  return {
    service,
    db,
    candidate,
    nextManifest,
    inspect,
    accept,
    repository,
    capabilities,
    installer,
    coordinator,
    credentials,
    verifier,
    catalogRefresh,
    root,
    layout,
    snapshot,
    lockSpy,
    acquire,
  };
}

describe("explicit capability updates", () => {
  it("normalizes omitted intent to install and retains explicit update", () => {
    expect(
      packageInspectRequestSchema.parse({ sourceSpec: packageName }).intent,
    ).toBe("install");
    expect(
      packageInspectRequestSchema.parse({
        sourceSpec: packageName,
        intent: "update",
      }).intent,
    ).toBe("update");
  });
  it("keeps fresh-install collision refusal", async () => {
    const f = await fixture();
    await expect(
      f.service.inspect({ sourceSpec: `${packageName}@2.0.0` }),
    ).rejects.toThrow("package_blocked");
    expect(f.verifier.verify).not.toHaveBeenCalled();
  });
  it("publishes exact static review information through the held lease", async () => {
    const f = await fixture();
    const dto = await f.inspect();
    expect(dto.releaseNotes).toBe("Reviewed release notes");
    expect(dto.update).toMatchObject({
      releaseNotes: "Reviewed release notes",
      permissionChanged: true,
      requiresSetup: false,
      requiresReview: false,
      currentVersion: "1.0.0",
    });
    expect(capabilityPackageInspectionSchema.parse(dto)).toEqual(dto);
    expect(Object.isFrozen(dto.update)).toBe(true);
    expect(f.verifier.verify).not.toHaveBeenCalled();
    await f.service.cancel(dto.inspectionId);
  });
  it("rejects an update payload omitting packageName before consuming its lease", async () => {
    const f = await fixture();
    const dto = await f.inspect();
    const payload: Partial<ReturnType<typeof f.accept>> = f.accept(dto);
    delete payload.packageName;
    await expect(f.service.update(payload as never)).rejects.toMatchObject({ code: "package_permission_denied" });
    expect(f.verifier.verify).not.toHaveBeenCalled();
    expect(f.repository.getByPackageName(packageName)?.activeVersion).toBe("1.0.0");
    await f.service.cancel(dto.inspectionId);
  });
  it("rejects using install acceptance to consume an update lease", async () => {
    const f = await fixture();
    const dto = await f.inspect();
    await expect(f.service.install({
      inspectionId: dto.inspectionId, acceptedPackageName: dto.packageName,
      acceptedVersion: dto.resolvedVersion, acceptedIntegrity: dto.integrity,
      acceptedPermissionDigest: dto.permissionDigest,
    })).rejects.toThrow("package_permission_denied");
    expect(f.verifier.verify).not.toHaveBeenCalled();
  });
  it.each([
    "acceptedPackageName",
    "acceptedVersion",
    "acceptedIntegrity",
    "acceptedPermissionDigest",
  ] as const)("binds consent to %s", async (key) => {
    const f = await fixture();
    const dto = await f.inspect();
    await expect(
      f.service.update({ ...f.accept(dto), [key]: "changed" }),
    ).rejects.toThrow("package_permission_denied");
    expect(f.repository.getByPackageName(packageName)?.activeVersion).toBe(
      "1.0.0",
    );
  });
  it("rejects an exact downgrade without explicit acceptance", async () => {
    const f = await fixture({ nextVersion: "0.9.0" });
    const dto = await f.inspect();
    expect(dto.update?.downgrade).toBe(true);
    await expect(f.service.update(f.accept(dto))).rejects.toThrow(
      "package_permission_denied",
    );
  });
  it("allows an explicitly accepted exact downgrade", async () => {
    const f = await fixture({ nextVersion: "0.9.0" });
    const dto = await f.inspect();
    await f.service.update({ ...f.accept(dto), acceptedDowngrade: true });
    expect(f.repository.getByPackageName(packageName)?.activeVersion).toBe(
      "0.9.0",
    );
  });
  it("rejects changed active-run consent before pointer swap", async () => {
    const f = await fixture({ active: true });
    const dto = await f.inspect();
    await expect(
      f.service.update({ ...f.accept(dto), acceptedActiveRunCount: 1 }),
    ).rejects.toThrow("package_permission_denied");
    expect(f.coordinator.reloadRuns).not.toHaveBeenCalled();
    expect(f.repository.getByPackageName(packageName)?.activeVersion).toBe(
      "1.0.0",
    );
  });
  it("requires all runs idle before changing persistent state", async () => {
    const f = await fixture({ active: true });
    const dto = await f.inspect();
    f.coordinator.assertRunsIdle.mockRejectedValue(
      new Error("private busy run"),
    );
    await expect(f.service.update(f.accept(dto))).rejects.toThrow();
    expect(f.repository.getByPackageName(packageName)?.activeVersion).toBe(
      "1.0.0",
    );
  });
  it("preserves settings and reloads active sessions without activating new chats", async () => {
    const f = await fixture({ active: true });
    const dto = await f.inspect();
    await f.service.update(f.accept(dto));
    expect(f.capabilities.getSettings(capabilityId)).toEqual([
      { key: "limit", value: 7 },
      { key: "token", secretRef: "opaque-ref" },
    ]);
    expect(f.snapshot().records).toHaveLength(2);
    expect(f.snapshot().records.every((row) => row.version === "2.0.0")).toBe(
      true,
    );
    expect(f.coordinator.reloadRuns).toHaveBeenCalledWith(
      capabilityId,
      "2.0.0",
    );
    expect(f.coordinator.reactivateRuns).not.toHaveBeenCalled();
    await expect(
      access(f.layout.packageVersionRoot(capabilityId, "1.0.0")),
    ).resolves.toBeUndefined();
    expect(f.lockSpy).toHaveBeenCalledTimes(1);
  });
  it("deactivates for missing required settings and never automatically reactivates", async () => {
    const f = await fixture({
      active: true,
      settings: { requiredKey: { type: "secret", required: true } },
    });
    const dto = await f.inspect();
    expect(dto.update?.requiresSetup).toBe(true);
    const result = await f.service.update(f.accept(dto));
    expect(result.state).toBe("needs_setup");
    expect(f.coordinator.deactivateRuns).toHaveBeenCalledOnce();
    expect(f.coordinator.reloadRuns).not.toHaveBeenCalled();
    expect(f.coordinator.reactivateRuns).not.toHaveBeenCalled();
    expect(f.snapshot().records).toHaveLength(2);
    expect(f.snapshot().records.every((row) => row.status === "inactive")).toBe(
      true,
    );
    expect(f.credentials.removeSecret).toHaveBeenCalledWith("opaque-ref");
  });
  it("restores pointer, configuration and all runs after a second-run reload failure", async () => {
    const f = await fixture({ active: true });
    const dto = await f.inspect();
    const before = f.repository.getByPackageName(packageName),
      config = f.capabilities.snapshotInstalledConfiguration(capabilityId);
    const pointer = await readFile(
      `${f.layout.activePointerPath(capabilityId)}.json`,
    );
    const runs = f.snapshot();
    f.coordinator.reloadRuns.mockImplementation(async () => {
      throw new Error("second provider failed");
    });
    await expect(f.service.update(f.accept(dto))).rejects.toThrow(
      "package_update_failed",
    );
    expect(f.repository.getByPackageName(packageName)).toEqual(before);
    expect(f.capabilities.snapshotInstalledConfiguration(capabilityId)).toEqual(
      config,
    );
    expect(
      await readFile(`${f.layout.activePointerPath(capabilityId)}.json`),
    ).toEqual(pointer);
    expect(
      f.snapshot().records.map((row) => [row.id, row.status, row.version]),
    ).toEqual(runs.records.map((row) => [row.id, row.status, row.version]));
    expect(f.coordinator.restoreRuns).toHaveBeenCalledWith(
      capabilityId,
      "1.0.0",
    );
    expect(f.credentials.removeSecret).not.toHaveBeenCalled();
  });
  it("preserves external configuration changed while provider reload is pending", async () => {
    const f = await fixture({ active: true });
    const dto = await f.inspect();
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.coordinator.reloadRuns.mockImplementation(async () => {
      entered();
      await waiting;
      throw new Error("provider failed");
    });
    const updating = f.service.update(f.accept(dto));
    await started;
    f.capabilities.replaceSettings(capabilityId, [
      { key: "external", value: true },
    ]);
    const external =
      f.capabilities.snapshotInstalledConfiguration(capabilityId);
    release();
    await expect(updating).rejects.toThrow("package_update_failed");
    expect(f.capabilities.snapshotInstalledConfiguration(capabilityId)).toEqual(
      external,
    );
    expect(f.coordinator.restoreRuns).not.toHaveBeenCalled();
  });

  it("does not clean obsolete secret references until provider work has completed", async () => {
    const f = await fixture({
      active: true,
      settings: { limit: { type: "integer", default: 5 } },
    });
    const dto = await f.inspect();
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.coordinator.reloadRuns.mockImplementation(async () => {
      entered();
      await waiting;
    });
    const updating = f.service.update(f.accept(dto));
    await started;
    expect(f.credentials.removeSecret).not.toHaveBeenCalled();
    await expect(
      access(f.layout.packageVersionRoot(capabilityId, "1.0.0")),
    ).resolves.toBeUndefined();
    release();
    await updating;
    expect(f.credentials.removeSecret).toHaveBeenCalledWith("opaque-ref");
  });

  it("serializes another update inspection behind pending provider work on the same global lock", async () => {
    const f = await fixture({ active: true });
    const dto = await f.inspect();
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.coordinator.reloadRuns.mockImplementation(async () => {
      entered();
      await waiting;
    });
    const updating = f.service.update(f.accept(dto));
    await started;
    const second = f.inspect();
    const rejected = expect(second).rejects.toThrow("package_update_failed");
    expect(f.lockSpy).toHaveBeenCalledTimes(2);
    expect(f.acquire).toHaveBeenCalledTimes(1);
    release();
    await updating;
    await rejected;
    expect(f.acquire).toHaveBeenCalledTimes(2);
  });

  it("quarantines a committed-but-unfinalized update on real SQLite restart before activation", async () => {
    const f = await fixture({ active: true, durable: true });
    const candidate = await f.candidate("interrupted", f.nextManifest);
    f.repository.beginOperation({ operationId: "interrupted", action: "update", stage: "installing", packageName, requestedSpec: candidate.staged.requestedSpec });
    await f.installer.commitUpdate(candidate, { capabilityId, version: "2.0.0", contentDigest: candidate.staged.contentDigest, toolNames: ["search"] }, { configured: true, settings: f.capabilities.getSettings(capabilityId), obsoleteSecretRefs: [] });
    f.db.close(); // Crash boundary: no finalize, no provider restore, no journal deletion.
    const reopened = new BetterSqlite3(join(f.root, "state.sqlite"));
    databases.push(reopened);
    const getSqlite = vi.spyOn(databaseClient, "getSqlite").mockReturnValue(reopened);
    try { initDatabase(); } finally { getSqlite.mockRestore(); }
    const repository = new ManagedPackageRepository(reopened);
    expect(repository.getByPackageName(packageName)).toMatchObject({ state: "blocked", errorCode: "package_update_failed" });
    const journal = repository.listUpdateRecoveries()[0];
    expect(journal.stage).toBe("conflict");
    const staleCatalogService = new CapabilityService({
      repository: new CapabilityRepository(reopened), credentials: {} as never, hosts: {} as never, activator: {} as never,
      catalog: { get: () => ({ manifest: manifest("2.0.0"), source: "npm", packageName, trust: "community", reviewStatus: "unreviewed" }) } as never,
      getAgentKind: async () => "codex",
    });
    await expect(staleCatalogService.activateCapability("run-1", capabilityId)).rejects.toMatchObject({ code: "permission_denied" });
    expect(journal.configuration.settings).toContainEqual({ key: "token", secretRef: "opaque-ref" });
    expect(journal.sessions.map((row) => row.runId)).toEqual(["run-1", "run-2"]);
    await expect(access(f.layout.packageVersionRoot(capabilityId, "1.0.0"))).resolves.toBeUndefined();
    await expect(access(f.layout.packageVersionRoot(capabilityId, "2.0.0"))).resolves.toBeUndefined();
    expect(f.coordinator.reloadRuns).not.toHaveBeenCalled();
    expect(f.coordinator.reactivateRuns).not.toHaveBeenCalled();
  });
  it("preserves externally changed session associations when they change inside the publication idle check", async () => {
    const f = await fixture({ active: true });
    const dto = await f.inspect();
    f.coordinator.assertRunsIdle.mockResolvedValueOnce(undefined).mockImplementationOnce(async () => {
      f.capabilities.transitionSessionCapability({ runId: "run-1", capabilityId, version: "1.0.0", to: "pending_deactivation" });
    });
    await expect(f.service.update(f.accept(dto))).rejects.toThrow("package_update_failed");
    expect(f.capabilities.getSessionCapability("run-1", capabilityId)?.status).toBe("pending_deactivation");
    expect(f.repository.listUpdateRecoveries()[0].stage).toBe("conflict");
    expect(f.coordinator.reloadRuns).not.toHaveBeenCalled();
  });
  it("rechecks idle state at pointer publication and restores state when a turn starts during preparation", async () => {
    const f = await fixture({ active: true });
    const dto = await f.inspect();
    f.coordinator.assertRunsIdle.mockResolvedValueOnce(undefined).mockRejectedValue(new Error("turn started"));
    const before = f.repository.getByPackageName(packageName);
    const pointer = await readFile(`${f.layout.activePointerPath(capabilityId)}.json`);
    await expect(f.service.update(f.accept(dto))).rejects.toThrow("package_update_failed");
    expect(f.repository.getByPackageName(packageName)).toEqual(before);
    expect(await readFile(`${f.layout.activePointerPath(capabilityId)}.json`)).toEqual(pointer);
    expect(f.coordinator.reloadRuns).not.toHaveBeenCalled();
  });
  it("retains a durable conflict snapshot and blocks activation after failed provider rollback", async () => {
    const f = await fixture({ active: true });
    const dto = await f.inspect();
    f.coordinator.reloadRuns.mockRejectedValue(new Error("reload failed"));
    f.coordinator.restoreRuns.mockRejectedValue(new Error("restore failed"));
    await expect(f.service.update(f.accept(dto))).rejects.toThrow("package_update_failed");
    expect(f.repository.getByPackageName(packageName)?.state).toBe("blocked");
    const journal = f.repository.listUpdateRecoveries()[0];
    expect(journal).toMatchObject({ stage: "conflict", errorCode: "package_update_failed" });
    expect(journal.configuration.settings).toContainEqual({ key: "token", secretRef: "opaque-ref" });
    expect(journal.sessions.map((row) => row.runId)).toEqual(["run-1", "run-2"]);
    expect(JSON.stringify(journal)).not.toContain(f.root);
    await f.service.reconcileInterruptedOperations();
    expect(f.repository.listUpdateRecoveries()).toHaveLength(1);
    await expect(access(f.layout.packageVersionRoot(capabilityId, "1.0.0"))).resolves.toBeUndefined();
    await expect(access(f.layout.packageVersionRoot(capabilityId, "2.0.0"))).resolves.toBeUndefined();
  });
  it("allows an explicit update to recover a quarantined package without discarding its earlier journal prematurely", async () => {
    const f = await fixture({ active: true });
    const first = await f.inspect();
    f.coordinator.reloadRuns.mockRejectedValueOnce(new Error("reload failed"));
    f.coordinator.restoreRuns.mockRejectedValueOnce(new Error("rollback failed"));
    await expect(f.service.update(f.accept(first))).rejects.toThrow("package_update_failed");
    expect(f.repository.listUpdateRecoveries()).toHaveLength(1);
    const second = await f.inspect();
    expect(f.repository.listUpdateRecoveries()).toHaveLength(1);
    await f.service.update(f.accept(second));
    expect(f.repository.getByPackageName(packageName)).toMatchObject({ state: "installed", activeVersion: "2.0.0" });
    expect(f.repository.listUpdateRecoveries()).toEqual([]);
    expect(f.credentials.removeSecret).not.toHaveBeenCalled();
    expect(f.snapshot().records).toHaveLength(2);
  });
  it("uses the real coordinator to restore the first successful provider after the second provider fails", async () => {
    const f = await fixture({ active: true, settings: { token: { type: "secret", required: false }, limit: { type: "integer", default: 5 }, newFlag: { type: "boolean", default: true } } });
    let catalogVersion = "1.0.0";
    f.catalogRefresh.mockImplementation(async () => {
      catalogVersion = JSON.parse(await readFile(`${f.layout.activePointerPath(capabilityId)}.json`, "utf8")).version;
    });
    const versions = new Map([["run-1", "1.0.0"], ["run-2", "1.0.0"]]);
    const history: [string, string][] = [];
    const hostConfigurations = new Map<string, Record<string, Record<string, unknown>>>();
    let failed = false;
    const real = new CapabilityService({
      repository: f.capabilities, credentials: {} as never,
      catalog: { get: () => ({ manifest: manifest(catalogVersion), source: "npm", packageName, trust: "community", reviewStatus: "unreviewed" }) } as never,
      hosts: { setActiveCapabilities: async (runId: string, _ids: string[], settings: Record<string, Record<string, unknown>>) => {
        hostConfigurations.set(runId, settings);
        versions.set(runId, catalogVersion); history.push([runId, catalogVersion]); return [catalogVersion];
      } } as never,
      activator: { isAgentIdle: async () => true, apply: async (runId: string) => {
        if (runId === "run-2" && catalogVersion === "2.0.0" && !failed) { failed = true; throw new Error("second provider failure"); }
        return "reloaded";
      } } as never,
      getAgentKind: async () => "codex",
    });
    f.coordinator.reloadRuns.mockImplementation((id, version) => real.reloadRuns(id, version));
    f.coordinator.restoreRuns.mockImplementation((id, version) => real.restoreRuns(id, version));
    const dto = await f.inspect();
    const before = f.repository.getByPackageName(packageName);
    const settings = f.capabilities.snapshotInstalledConfiguration(capabilityId);
    const pointer = await readFile(`${f.layout.activePointerPath(capabilityId)}.json`);
    await expect(f.service.update(f.accept(dto))).rejects.toThrow("package_update_failed");
    expect(history.slice(0, 2)).toEqual([["run-1", "2.0.0"], ["run-2", "2.0.0"]]);
    expect([...versions.values()]).toEqual(["1.0.0", "1.0.0"]);
    expect([...hostConfigurations.values()]).toEqual([{ [capabilityId]: { limit: 7 } }, { [capabilityId]: { limit: 7 } }]);
    expect(history).toContainEqual(["run-1", "1.0.0"]);
    expect(catalogVersion).toBe("1.0.0");
    expect(f.repository.getByPackageName(packageName)).toEqual(before);
    expect(f.capabilities.snapshotInstalledConfiguration(capabilityId)).toEqual(settings);
    expect(await readFile(`${f.layout.activePointerPath(capabilityId)}.json`)).toEqual(pointer);
    expect(f.snapshot().records.map((row) => [row.runId, row.status, row.version])).toEqual([["run-1", "active", "1.0.0"], ["run-2", "active", "1.0.0"]]);
    await expect(access(f.layout.packageVersionRoot(capabilityId, "1.0.0"))).resolves.toBeUndefined();
    expect(f.repository.listUpdateRecoveries()).toEqual([]);
  });
  it("persists failed encrypted-reference cleanup and retries without activating sessions", async () => {
    const f = await fixture({ settings: { limit: { type: "integer", default: 5 } } });
    const dto = await f.inspect();
    f.credentials.removeSecret.mockRejectedValueOnce(new Error("private cleanup detail"));
    await expect(f.service.update(f.accept(dto))).rejects.toThrow("package_update_failed");
    expect(f.repository.listUpdateRecoveries()[0]).toMatchObject({ stage: "cleanup_pending", obsoleteSecretRefs: ["opaque-ref"] });
    expect(f.repository.getByPackageName(packageName)?.state).toBe("blocked");
    await f.service.reconcileInterruptedOperations();
    expect(f.repository.listUpdateRecoveries()).toEqual([]);
    expect(f.coordinator.reactivateRuns).not.toHaveBeenCalled();
    expect(f.credentials.removeSecret).toHaveBeenCalledTimes(2);
    expect(f.repository.getByPackageName(packageName)).toMatchObject({ state: "installed", activeVersion: "2.0.0" });
    expect(f.repository.getByPackageName(packageName)?.errorCode).toBeUndefined();
    expect(f.capabilities.isPackageActivationBlocked(capabilityId)).toBe(false);
  });
  it("returns immutable path-free coded update failures without raw stacks", async () => {
    const f = await fixture();
    const dto = await f.inspect();
    const failure = await f.service.update({ ...f.accept(dto), acceptedVersion: "wrong" }).catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: "package_permission_denied", message: "package_permission_denied" });
    expect(Object.isFrozen(failure)).toBe(true);
    expect(failure).not.toHaveProperty("stack", expect.any(String));
    expect(JSON.stringify(failure)).not.toContain(f.root);
  });
  it("retains the recovery journal when a precommit failure leaves a foreign pointer", async () => {
    const f = await fixture();
    const dto = await f.inspect();
    vi.spyOn(f.installer, "commitUpdate").mockImplementation(async () => {
      await writeFile(`${f.layout.activePointerPath(capabilityId)}.json`, '{"foreign":"pointer"}');
      throw new Error("package_update_failed");
    });
    await expect(f.service.update(f.accept(dto))).rejects.toThrow("package_update_failed");
    expect(f.repository.listUpdateRecoveries()).toHaveLength(1);
    expect(f.repository.getByPackageName(packageName)?.state).toBe("blocked");
    expect(await readFile(`${f.layout.activePointerPath(capabilityId)}.json`, "utf8")).toBe('{"foreign":"pointer"}');
  });
  it("emits frozen schema-valid update events without paths", async () => {
    const f = await fixture();
    const events: unknown[] = [];
    f.service.subscribe((event) => events.push(event));
    const dto = await f.inspect();
    await f.service.update(f.accept(dto));
    for (const event of events) {
      expect(capabilityDistributionProgressSchema.parse(event).action).toBe(
        "update",
      );
      expect(Object.isFrozen(event)).toBe(true);
    }
    expect(JSON.stringify(events)).not.toContain(f.root);
  });
});
