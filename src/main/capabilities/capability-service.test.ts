import BetterSqlite3 from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapSchemaSql } from "../database/bootstrap";
import { CapabilityRepository } from "./capability-repository";
import { CapabilityService } from "./capability-service";
import {
  createBundledCapability,
  getBundledCapability,
  listBundledCapabilities,
  permissionDigest,
} from "./catalog";
import { webSearchManifest } from "@agentic-worktrees/web-search-capability";

const webEntry = createBundledCapability(webSearchManifest, ["web_search"]);
const managedWebEntry = {
  ...webEntry,
  source: "npm" as const,
  trust: "community" as const,
  reviewStatus: "unreviewed" as const,
  packageName: "@agentic-worktrees/web-search",
  runtime: {
    kind: "managed" as const,
    capabilityId: webEntry.manifest.id,
    packageName: "@agentic-worktrees/web-search",
    version: webEntry.manifest.version,
    packageRoot: "/managed/web-search",
    manifest: "capability.json",
    entry: "dist/index.js",
    contentDigest: "digest",
  },
};
const managedCatalog = {
  list: () => [managedWebEntry],
  get: (id: string) => {
    if (id !== managedWebEntry.manifest.id) throw new Error("unknown");
    return managedWebEntry;
  },
  refresh: async () => undefined,
};
const testCatalog = {
  list: () => [...listBundledCapabilities(), webEntry],
  get: (id: string) =>
    id === webEntry.manifest.id ? webEntry : getBundledCapability(id),
  refresh: async () => undefined,
};

describe("CapabilityService", () => {
  let sqlite: BetterSqlite3.Database;
  beforeEach(() => {
    sqlite = new BetterSqlite3(":memory:");
    sqlite.pragma("foreign_keys=ON");
    sqlite.exec(bootstrapSchemaSql);
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO repositories (id,github_repo_id,owner_login,name,full_name,is_private,is_archived,clone_url,html_url,local_clone_status,created_at,updated_at) VALUES ('r',1,'o','r','o/r',0,0,'','','ready',?,?)`,
      )
      .run(now, now);
    sqlite
      .prepare(
        `INSERT INTO worktrees (id,repository_id,name,path,branch_name,status,created_at,updated_at) VALUES ('w','r','w','/tmp/w','main','ready',?,?)`,
      )
      .run(now, now);
    sqlite
      .prepare(
        `INSERT INTO runs (id,repository_id,worktree_id,title,prompt,status,created_at,updated_at) VALUES ('run-1','r','w','Run','','idle',?,?)`,
      )
      .run(now, now);
  });
  afterEach(() => sqlite.close());
  it("keeps blocked managed packages visible but refuses activation before provider work", async () => {
    const entry = { ...managedWebEntry, blocked: true };
    const hosts = { setActiveCapabilities: vi.fn() };
    const service = new CapabilityService({
      repository: new CapabilityRepository(sqlite),
      catalog: {
        list: () => [entry],
        get: () => entry,
        refresh: async () => undefined,
      },
      credentials: {} as never,
      hosts: hosts as never,
      activator: {} as never,
      getAgentKind: vi.fn().mockResolvedValue("codex"),
    });
    expect(service.listCapabilities()[0].installationState).toBe("blocked");
    await expect(
      service.activateCapability("run-1", entry.manifest.id),
    ).rejects.toThrow("blocked");
    expect(hosts.setActiveCapabilities).not.toHaveBeenCalled();
  });

  it("configures keyless search and activates with ordered reload events", async () => {
    const repository = new CapabilityRepository(sqlite);
    const events: string[] = [];
    const stopHost = vi.fn();
    const service = new CapabilityService({
      catalog: testCatalog,
      repository,
      credentials: {
        setSecret: vi.fn(),
        getSecret: vi.fn(),
        removeSecret: vi.fn(),
      } as never,
      hosts: {
        setActiveCapabilities: vi.fn().mockResolvedValue(["web_search"]),
        stopHost,
        stopAll: vi.fn(),
      } as never,
      activator: {
        prepareSession: vi.fn(),
        apply: vi.fn().mockResolvedValue("reloaded"),
        remove: vi.fn(),
        isAgentIdle: vi.fn().mockResolvedValue(true),
      },
      getAgentKind: vi.fn().mockResolvedValue("opencode"),
    });
    service.subscribeToCapabilityEvents((event) => {
      if (event.scope === "session") events.push(event.state);
    });
    const id = "agentic-worktrees.web-search";
    const configured = await service.configureCapability({
      capabilityId: id,
      acceptedPermissionDigest: permissionDigest(webEntry.manifest),
      settings: { providerMode: "auto", resultLimit: 5 },
      secrets: {},
    });
    expect(configured).toMatchObject({
      state: "ready",
      secretConfigured: false,
    });
    await expect(
      service.activateCapability("run-1", id),
    ).resolves.toMatchObject({ state: "active" });
    await expect(
      service.deactivateCapability("run-1", id),
    ).resolves.toMatchObject({ state: "inactive" });
    expect(stopHost).toHaveBeenCalledWith("run-1");
    expect(events).toEqual([
      "pending_activation",
      "reloading",
      "active",
      "pending_deactivation",
      "reloading",
      "inactive",
    ]);
  });

  it("restores provider and host configuration when activation verification fails", async () => {
    const repository = new CapabilityRepository(sqlite);
    const id = "agentic-worktrees.web-search";
    const stopHost = vi.fn();
    const remove = vi.fn().mockResolvedValue("refreshed");
    const setActiveCapabilities = vi
      .fn()
      .mockResolvedValueOnce(["web_search"])
      .mockResolvedValueOnce([]);
    const service = new CapabilityService({
      catalog: testCatalog,
      repository,
      credentials: {
        setSecret: vi.fn(),
        getSecret: vi.fn(),
        removeSecret: vi.fn(),
      } as never,
      hosts: { setActiveCapabilities, stopHost, stopAll: vi.fn() } as never,
      activator: {
        prepareSession: vi.fn(),
        apply: vi.fn().mockRejectedValue(new Error("verification failed")),
        remove,
        isAgentIdle: vi.fn().mockResolvedValue(true),
      },
      getAgentKind: vi.fn().mockResolvedValue("codex"),
    });
    await service.configureCapability({
      capabilityId: id,
      acceptedPermissionDigest: permissionDigest(webEntry.manifest),
      settings: { providerMode: "auto", resultLimit: 5 },
      secrets: {},
    });
    await expect(service.activateCapability("run-1", id)).rejects.toMatchObject(
      { code: "activation_failed" },
    );
    expect(setActiveCapabilities).toHaveBeenLastCalledWith("run-1", [], {});
    expect(remove).toHaveBeenCalledWith("run-1");
    expect(stopHost).toHaveBeenCalledWith("run-1");
  });

  it("configures and activates a settings-free capability without credentials", async () => {
    const repository = new CapabilityRepository(sqlite);
    const id = "agentic-worktrees.url-fetch";
    const credentials = {
      setSecret: vi.fn(),
      getSecret: vi.fn(),
      removeSecret: vi.fn(),
    };
    const setActiveCapabilities = vi.fn().mockResolvedValue(["fetch_url"]);
    const service = new CapabilityService({
      catalog: testCatalog,
      repository,
      credentials: credentials as never,
      hosts: {
        setActiveCapabilities,
        stopHost: vi.fn(),
        stopAll: vi.fn(),
      } as never,
      activator: {
        prepareSession: vi.fn(),
        apply: vi.fn(),
        remove: vi.fn(),
        isAgentIdle: vi.fn().mockResolvedValue(true),
      },
      getAgentKind: vi.fn().mockResolvedValue("codex"),
    });
    await expect(
      service.configureCapability({
        capabilityId: id,
        acceptedPermissionDigest: permissionDigest(
          getBundledCapability(id).manifest,
        ),
        settings: {},
        secrets: {},
      }),
    ).resolves.toMatchObject({ state: "ready" });
    await expect(
      service.activateCapability("run-1", id),
    ).resolves.toMatchObject({ state: "active" });
    expect(setActiveCapabilities).toHaveBeenCalledWith("run-1", [id], {
      [id]: {},
    });
    expect(credentials.setSecret).not.toHaveBeenCalled();
    await expect(
      service.deactivateCapability("run-1", id),
    ).resolves.toMatchObject({ state: "inactive" });
  });

  it("clears an existing optional key when explicitly configured keyless", async () => {
    const repository = new CapabilityRepository(sqlite);
    const removeSecret = vi.fn().mockResolvedValue(undefined);
    const id = "agentic-worktrees.web-search";
    repository.saveConfiguration(
      {
        capabilityId: id,
        version: "0.1.0",
        permissionDigest: permissionDigest(webEntry.manifest),
        configured: true,
      },
      [{ key: "exaApiKey", secretRef: "old-secret" }],
    );
    const service = new CapabilityService({
      catalog: testCatalog,
      repository,
      credentials: {
        setSecret: vi.fn(),
        getSecret: vi.fn(),
        removeSecret,
      } as never,
      hosts: {
        setActiveCapabilities: vi.fn(),
        stopHost: vi.fn(),
        stopAll: vi.fn(),
      } as never,
      activator: {
        prepareSession: vi.fn(),
        apply: vi.fn(),
        remove: vi.fn(),
        isAgentIdle: vi.fn(),
      },
      getAgentKind: vi.fn(),
    });
    await service.configureCapability({
      capabilityId: id,
      acceptedPermissionDigest: permissionDigest(webEntry.manifest),
      settings: { providerMode: "auto", resultLimit: 5 },
      secrets: { exaApiKey: null },
    });
    expect(
      repository.getSettings(id).some((setting) => setting.key === "exaApiKey"),
    ).toBe(false);
    expect(removeSecret).toHaveBeenCalledWith("old-secret");
  });

  it("enumerates active runs, enforces idle, and rejects bundled package coordination", async () => {
    const repository = new CapabilityRepository(sqlite);
    repository.transitionSessionCapability({
      runId: "run-1",
      capabilityId: webEntry.manifest.id,
      version: webEntry.manifest.version,
      to: "pending_activation",
    });
    repository.transitionSessionCapability({
      runId: "run-1",
      capabilityId: webEntry.manifest.id,
      version: webEntry.manifest.version,
      to: "active",
    });
    const idle = vi.fn().mockResolvedValue(false);
    const service = new CapabilityService({
      catalog: managedCatalog,
      repository,
      credentials: {} as never,
      hosts: {} as never,
      activator: { isAgentIdle: idle } as never,
      getAgentKind: vi.fn(),
    });
    expect(service.listActiveRuns(webEntry.manifest.id)).toEqual(["run-1"]);
    expect(service.activeRunCount(webEntry.manifest.id)).toBe(1);
    await expect(service.assertRunsIdle(["run-1"])).rejects.toMatchObject({
      code: "activation_failed",
    });
    await expect(
      service.deactivateRuns(webEntry.manifest.id),
    ).rejects.toMatchObject({
      code: "activation_failed",
    });
    await expect(
      service.reactivateRuns(webEntry.manifest.id, webEntry.manifest.version),
    ).rejects.toThrow("No package session deactivation is pending");
    const bundledService = new CapabilityService({
      catalog: testCatalog,
      repository,
      credentials: {} as never,
      hosts: {} as never,
      activator: { isAgentIdle: idle } as never,
      getAgentKind: vi.fn(),
    });
    expect(() =>
      bundledService.assertManagedCapability("agentic-worktrees.url-fetch"),
    ).toThrow("Bundled capabilities cannot be managed");
  });

  it("transactionally deactivates and reactivates managed runs without losing associations", async () => {
    const repository = new CapabilityRepository(sqlite);
    repository.upsertInstallation({
      capabilityId: webEntry.manifest.id,
      version: webEntry.manifest.version,
      permissionDigest: permissionDigest(webEntry.manifest),
      configured: true,
    });
    repository.transitionSessionCapability({
      runId: "run-1",
      capabilityId: webEntry.manifest.id,
      version: webEntry.manifest.version,
      to: "pending_activation",
    });
    repository.transitionSessionCapability({
      runId: "run-1",
      capabilityId: webEntry.manifest.id,
      version: webEntry.manifest.version,
      to: "active",
    });
    const service = new CapabilityService({
      catalog: managedCatalog,
      repository,
      credentials: {} as never,
      hosts: {
        setActiveCapabilities: vi.fn().mockResolvedValue(["web_search"]),
        stopHost: vi.fn(),
      } as never,
      activator: {
        isAgentIdle: vi.fn().mockResolvedValue(true),
        prepareSession: vi.fn(),
        apply: vi.fn(),
        remove: vi.fn(),
      } as never,
      getAgentKind: vi.fn().mockResolvedValue("codex"),
    });
    await service.deactivateRuns(webEntry.manifest.id);
    expect(service.activeRunCount(webEntry.manifest.id)).toBe(0);
    expect(
      repository.getSessionCapability("run-1", webEntry.manifest.id)?.status,
    ).toBe("inactive");
    expect(
      repository.listSessionCapabilitiesByCapabilityId(webEntry.manifest.id),
    ).toHaveLength(1);
    await service.reactivateRuns(
      webEntry.manifest.id,
      webEntry.manifest.version,
    );
    expect(service.activeRunCount(webEntry.manifest.id)).toBe(1);
    expect(
      repository.getSessionCapability("run-1", webEntry.manifest.id),
    ).toMatchObject({ status: "active", version: webEntry.manifest.version });
  });

  it.each([false, true])(
    "preserves external state during deactivation (rollback work: %s)",
    async (duringRollback) => {
      const repository = new CapabilityRepository(sqlite);
      repository.transitionSessionCapability({
        runId: "run-1",
        capabilityId: webEntry.manifest.id,
        version: webEntry.manifest.version,
        to: "pending_activation",
      });
      repository.transitionSessionCapability({
        runId: "run-1",
        capabilityId: webEntry.manifest.id,
        version: webEntry.manifest.version,
        to: "active",
      });
      let enteredHost!: () => void;
      const hostEntered = new Promise<void>((resolve) => {
        enteredHost = resolve;
      });
      let rejectHost!: (error: Error) => void;
      const hostWork = new Promise<string[]>((_resolve, reject) => {
        rejectHost = reject;
      });
      const logError = vi.fn();
      let hostCalls = 0;
      const service = new CapabilityService({
        catalog: managedCatalog,
        repository,
        credentials: {} as never,
        hosts: {
          setActiveCapabilities: vi.fn(async () => {
            if (duringRollback && ++hostCalls === 1)
              throw new Error("host failure");
            enteredHost();
            return hostWork;
          }),
          stopHost: vi.fn(),
        } as never,
        activator: {
          isAgentIdle: vi.fn().mockResolvedValue(true),
          apply: vi.fn(),
          remove: vi.fn(),
        } as never,
        getAgentKind: vi.fn().mockResolvedValue("codex"),
        logError,
      });
      const deactivation = service.deactivateRuns(webEntry.manifest.id);
      await hostEntered;
      repository.updateSessionCapabilityVersions(
        webEntry.manifest.id,
        ["run-1"],
        "8.8.8",
      );
      const external = repository.snapshotSessionCapabilities(
        webEntry.manifest.id,
      );
      rejectHost(new Error("host failed"));
      await expect(deactivation).rejects.toThrow("rollback conflicted");
      expect(
        repository.getSessionCapability("run-1", webEntry.manifest.id)?.version,
      ).toBe("8.8.8");
      expect(
        repository.snapshotSessionCapabilities(webEntry.manifest.id),
      ).toEqual(external);
      await expect(
        service.deactivateRuns(webEntry.manifest.id),
      ).rejects.toThrow("already pending");
      expect(logError).toHaveBeenCalledWith(
        "capability.package.rollback.conflict",
        "activation_failed",
      );
    },
  );

  it.each([false, true])(
    "preserves external state during reactivation work (failure: %s)",
    async (fail) => {
      const repository = new CapabilityRepository(sqlite);
      repository.upsertInstallation({
        capabilityId: webEntry.manifest.id,
        version: webEntry.manifest.version,
        permissionDigest: permissionDigest(webEntry.manifest),
        configured: true,
      });
      repository.transitionSessionCapability({
        runId: "run-1",
        capabilityId: webEntry.manifest.id,
        version: webEntry.manifest.version,
        to: "pending_activation",
      });
      repository.transitionSessionCapability({
        runId: "run-1",
        capabilityId: webEntry.manifest.id,
        version: webEntry.manifest.version,
        to: "active",
      });
      const setActiveCapabilities = vi.fn().mockResolvedValue(["web_search"]);
      let releaseApply!: () => void;
      const applying = new Promise<void>((resolve) => {
        releaseApply = resolve;
      });
      let enteredApply!: () => void;
      const applyEntered = new Promise<void>((resolve) => {
        enteredApply = resolve;
      });
      const apply = vi.fn(async () => {
        enteredApply();
        await applying;
        if (fail) throw new Error("provider failed");
      });
      const service = new CapabilityService({
        catalog: managedCatalog,
        repository,
        credentials: {} as never,
        hosts: { setActiveCapabilities, stopHost: vi.fn() } as never,
        activator: {
          isAgentIdle: vi.fn().mockResolvedValue(true),
          prepareSession: vi.fn(),
          apply,
          remove: vi.fn(),
        } as never,
        getAgentKind: vi.fn().mockResolvedValue("codex"),
      });
      await service.deactivateRuns(webEntry.manifest.id);
      const reactivation = service.reactivateRuns(
        webEntry.manifest.id,
        webEntry.manifest.version,
      );
      await applyEntered;
      repository.updateSessionCapabilityVersions(
        webEntry.manifest.id,
        ["run-1"],
        "9.9.9",
      );
      const external = repository.snapshotSessionCapabilities(
        webEntry.manifest.id,
      );
      releaseApply();
      await expect(reactivation).rejects.toThrow("rollback conflicted");
      expect(
        repository.getSessionCapability("run-1", webEntry.manifest.id),
      ).toMatchObject({ version: "9.9.9" });
      expect(
        repository.snapshotSessionCapabilities(webEntry.manifest.id),
      ).toEqual(external);
      expect(setActiveCapabilities).toHaveBeenCalled();
      expect(apply).toHaveBeenCalled();
      await expect(
        service.deactivateRuns(webEntry.manifest.id),
      ).rejects.toThrow("already pending");
    },
  );

  it("rejects a stale deactivation snapshot after external session state changes", async () => {
    const repository = new CapabilityRepository(sqlite);
    repository.upsertInstallation({
      capabilityId: webEntry.manifest.id,
      version: webEntry.manifest.version,
      permissionDigest: permissionDigest(webEntry.manifest),
      configured: true,
    });
    repository.transitionSessionCapability({
      runId: "run-1",
      capabilityId: webEntry.manifest.id,
      version: webEntry.manifest.version,
      to: "pending_activation",
    });
    repository.transitionSessionCapability({
      runId: "run-1",
      capabilityId: webEntry.manifest.id,
      version: webEntry.manifest.version,
      to: "active",
    });
    const setActiveCapabilities = vi.fn().mockResolvedValue(["web_search"]);
    const apply = vi.fn();
    const service = new CapabilityService({
      catalog: managedCatalog,
      repository,
      credentials: {} as never,
      hosts: { setActiveCapabilities, stopHost: vi.fn() } as never,
      activator: {
        isAgentIdle: vi.fn().mockResolvedValue(true),
        prepareSession: vi.fn(),
        apply,
        remove: vi.fn(),
      } as never,
      getAgentKind: vi.fn().mockResolvedValue("codex"),
    });
    await service.deactivateRuns(webEntry.manifest.id);
    const hostCallsAfterDeactivation = setActiveCapabilities.mock.calls.length;
    repository.updateSessionCapabilityVersions(
      webEntry.manifest.id,
      ["run-1"],
      "9.9.9",
    );
    await expect(
      service.reactivateRuns(webEntry.manifest.id, webEntry.manifest.version),
    ).rejects.toThrow("state changed after deactivation");
    expect(
      repository.getSessionCapability("run-1", webEntry.manifest.id),
    ).toMatchObject({ status: "inactive", version: "9.9.9" });
    expect(setActiveCapabilities).toHaveBeenCalledTimes(
      hostCallsAfterDeactivation,
    );
    expect(apply).not.toHaveBeenCalled();
  });

  it("serializes concurrent package coordination before snapshot mutation", async () => {
    const repository = new CapabilityRepository(sqlite);
    repository.transitionSessionCapability({
      runId: "run-1",
      capabilityId: webEntry.manifest.id,
      version: webEntry.manifest.version,
      to: "pending_activation",
    });
    repository.transitionSessionCapability({
      runId: "run-1",
      capabilityId: webEntry.manifest.id,
      version: webEntry.manifest.version,
      to: "active",
    });
    let releaseIdle!: () => void;
    const waiting = new Promise<void>((resolve) => {
      releaseIdle = resolve;
    });
    const service = new CapabilityService({
      catalog: managedCatalog,
      repository,
      credentials: {} as never,
      hosts: {
        setActiveCapabilities: vi.fn().mockResolvedValue([]),
        stopHost: vi.fn(),
      } as never,
      activator: {
        isAgentIdle: vi.fn(async () => {
          await waiting;
          return true;
        }),
        remove: vi.fn(),
      } as never,
      getAgentKind: vi.fn().mockResolvedValue("codex"),
    });
    const first = service.deactivateRuns(webEntry.manifest.id);
    await Promise.resolve();
    await expect(service.deactivateRuns(webEntry.manifest.id)).rejects.toThrow(
      "already in progress",
    );
    await expect(
      service.reactivateRuns(webEntry.manifest.id, webEntry.manifest.version),
    ).rejects.toThrow("already in progress");
    releaseIdle();
    await first;
    expect(
      repository.listSessionCapabilitiesByCapabilityId(webEntry.manifest.id),
    ).toHaveLength(1);
  });

  it("rolls back already reactivated hosts and providers when the second run fails", async () => {
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO runs (id, repository_id, worktree_id, title, prompt, status, created_at, updated_at) VALUES ('run-2', 'r', 'w', 'Run 2', '', 'idle', ?, ?)`,
      )
      .run(now, now);
    const repository = new CapabilityRepository(sqlite);
    repository.upsertInstallation({
      capabilityId: webEntry.manifest.id,
      version: webEntry.manifest.version,
      permissionDigest: permissionDigest(webEntry.manifest),
      configured: true,
    });
    for (const runId of ["run-1", "run-2"]) {
      repository.transitionSessionCapability({
        runId,
        capabilityId: webEntry.manifest.id,
        version: webEntry.manifest.version,
        to: "pending_activation",
      });
      repository.transitionSessionCapability({
        runId,
        capabilityId: webEntry.manifest.id,
        version: webEntry.manifest.version,
        to: "active",
      });
    }
    const hosts = {
      setActiveCapabilities: vi.fn().mockResolvedValue(["web_search"]),
      stopHost: vi.fn(),
    };
    const remove = vi.fn().mockResolvedValue("reloaded");
    const apply = vi
      .fn()
      .mockResolvedValueOnce("reloaded")
      .mockRejectedValueOnce(new Error("second provider failed"))
      .mockResolvedValue("reloaded");
    const service = new CapabilityService({
      catalog: managedCatalog,
      repository,
      credentials: {} as never,
      hosts: hosts as never,
      activator: {
        isAgentIdle: vi.fn().mockResolvedValue(true),
        prepareSession: vi.fn(),
        apply,
        remove,
      } as never,
      getAgentKind: vi.fn().mockResolvedValue("codex"),
    });
    await service.deactivateRuns(webEntry.manifest.id);
    await expect(
      service.reactivateRuns(webEntry.manifest.id, webEntry.manifest.version),
    ).rejects.toBeDefined();
    expect(
      repository
        .listSessionCapabilitiesByCapabilityId(webEntry.manifest.id)
        .map((record) => [record.runId, record.status]),
    ).toEqual([
      ["run-1", "inactive"],
      ["run-2", "inactive"],
    ]);
    expect(remove).toHaveBeenCalledTimes(4);
    expect(remove).toHaveBeenLastCalledWith("run-1");
    expect(
      hosts.setActiveCapabilities.mock.calls.some(
        ([runId]) => runId === "run-1",
      ),
    ).toBe(true);
  });

  it("restores run versions and already reloaded providers when a later reload fails", async () => {
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO runs (id, repository_id, worktree_id, title, prompt, status, created_at, updated_at) VALUES ('run-2', 'r', 'w', 'Run 2', '', 'idle', ?, ?)`,
      )
      .run(now, now);
    const repository = new CapabilityRepository(sqlite);
    for (const runId of ["run-1", "run-2"]) {
      repository.transitionSessionCapability({
        runId,
        capabilityId: webEntry.manifest.id,
        version: webEntry.manifest.version,
        to: "pending_activation",
      });
      repository.transitionSessionCapability({
        runId,
        capabilityId: webEntry.manifest.id,
        version: webEntry.manifest.version,
        to: "active",
      });
    }
    const setActiveCapabilities = vi
      .fn()
      .mockResolvedValueOnce(["web_search"])
      .mockRejectedValueOnce(new Error("second reload failed"))
      .mockResolvedValueOnce(["web_search"]);
    const apply = vi.fn().mockResolvedValue("reloaded");
    const service = new CapabilityService({
      catalog: managedCatalog,
      repository,
      credentials: {} as never,
      hosts: { setActiveCapabilities } as never,
      activator: {
        isAgentIdle: vi.fn().mockResolvedValue(true),
        apply,
      } as never,
      getAgentKind: vi.fn(),
    });
    await expect(
      service.reloadRuns(webEntry.manifest.id, webEntry.manifest.version),
    ).rejects.toMatchObject({ code: "agent_reload_failed" });
    expect(setActiveCapabilities).toHaveBeenCalledTimes(3);
    expect(
      repository
        .listSessionCapabilitiesByCapabilityId(webEntry.manifest.id)
        .map((record) => [record.runId, record.version, record.status]),
    ).toEqual([
      ["run-1", webEntry.manifest.version, "active"],
      ["run-2", webEntry.manifest.version, "active"],
    ]);
  });
});
