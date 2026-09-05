import BetterSqlite3 from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bootstrapSchemaSql } from "../database/bootstrap";
import { CapabilityRepository } from "./capability-repository";

describe("CapabilityRepository", () => {
  let sqlite: BetterSqlite3.Database;
  let repository: CapabilityRepository;
  beforeEach(() => {
    sqlite = new BetterSqlite3(":memory:");
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec(bootstrapSchemaSql);
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO repositories (id, github_repo_id, owner_login, name, full_name, is_private, is_archived, clone_url, html_url, local_clone_status, created_at, updated_at) VALUES ('repo', 1, 'o', 'r', 'o/r', 0, 0, '', '', 'ready', ?, ?)`,
      )
      .run(now, now);
    sqlite
      .prepare(
        `INSERT INTO worktrees (id, repository_id, name, path, branch_name, status, created_at, updated_at) VALUES ('wt', 'repo', 'wt', '/tmp/wt', 'main', 'ready', ?, ?)`,
      )
      .run(now, now);
    sqlite
      .prepare(
        `INSERT INTO runs (id, repository_id, worktree_id, title, prompt, status, created_at, updated_at) VALUES ('run-1', 'repo', 'wt', 'Run', '', 'idle', ?, ?)`,
      )
      .run(now, now);
    repository = new CapabilityRepository(sqlite);
  });
  afterEach(() => sqlite.close());

  it("compares the complete association set before transactional restore and version updates", () => {
    const capabilityId = "agentic-worktrees.web-search";
    repository.transitionSessionCapability({
      runId: "run-1",
      capabilityId,
      version: "1.0.0",
      to: "inactive",
    });
    const original = repository.snapshotSessionCapabilities(capabilityId);
    repository.updateSessionCapabilityVersions(
      capabilityId,
      ["run-1"],
      "2.0.0",
    );
    const external = repository.snapshotSessionCapabilities(capabilityId);
    expect(
      repository.restoreSessionCapabilitiesIfMatches(
        original.records,
        original,
      ),
    ).toBe(false);
    expect(
      repository.updateSessionCapabilityVersionsIfMatches(
        capabilityId,
        original.records,
        ["run-1"],
        "3.0.0",
      ),
    ).toBe(false);
    expect(repository.snapshotSessionCapabilities(capabilityId)).toEqual(
      external,
    );
    expect(
      repository.restoreSessionCapabilitiesIfMatches(
        external.records,
        original,
      ),
    ).toBe(true);
    expect(repository.snapshotSessionCapabilities(capabilityId)).toEqual(
      original,
    );
  });

  it("initializes defaults and marks required configuration accurately", () => {
    const ready = repository.initializeInstalledConfiguration(
      {
        id: "agentic-worktrees.web-search",
        version: "0.1.0",
        settings: {
          resultLimit: { type: "integer", required: true, default: 5 },
          apiKey: { type: "secret", required: false },
        },
      },
      "digest",
    );
    expect(ready.configured).toBe(true);
    expect(repository.getSettings(ready.capabilityId)).toEqual([
      { key: "apiKey" },
      { key: "resultLimit", value: 5 },
    ]);
    const setup = repository.initializeInstalledConfiguration(
      {
        id: "agentic-worktrees.other",
        version: "1.0.0",
        settings: { token: { type: "secret", required: true } },
      },
      "other-digest",
    );
    expect(setup.configured).toBe(false);
  });

  it("persists installation and settings in one transaction", () => {
    const installation = {
      capabilityId: "agentic-worktrees.web-search",
      version: "0.1.0",
      permissionDigest: "digest",
      configured: true,
    };
    repository.saveConfiguration(installation, [
      { key: "resultLimit", value: 5 },
      { key: "exaApiKey", secretRef: "opaque" },
    ]);
    expect(repository.getSettings(installation.capabilityId)).toEqual([
      { key: "exaApiKey", secretRef: "opaque" },
      { key: "resultLimit", value: 5 },
    ]);
    expect(repository.getInstallation(installation.capabilityId)).toMatchObject(
      { configured: true },
    );
  });

  it("rolls back the installation when replacing settings fails", () => {
    const capabilityId = "agentic-worktrees.web-search";
    repository.saveConfiguration(
      {
        capabilityId,
        version: "0.1.0",
        permissionDigest: "old",
        configured: false,
      },
      [{ key: "providerMode", value: "auto" }],
    );
    sqlite.exec(
      `CREATE TRIGGER reject_result_limit BEFORE INSERT ON capability_settings WHEN NEW.key = 'resultLimit' BEGIN SELECT RAISE(ABORT, 'rejected'); END;`,
    );
    expect(() =>
      repository.saveConfiguration(
        {
          capabilityId,
          version: "0.2.0",
          permissionDigest: "new",
          configured: true,
        },
        [{ key: "resultLimit", value: 5 }],
      ),
    ).toThrow();
    expect(repository.getInstallation(capabilityId)).toMatchObject({
      version: "0.1.0",
      permissionDigest: "old",
      configured: false,
    });
    expect(repository.getSettings(capabilityId)).toEqual([
      { key: "providerMode", value: "auto" },
    ]);
  });

  it("rejects corrupt stored setting JSON with a safe error", () => {
    repository.upsertInstallation({
      capabilityId: "agentic-worktrees.web-search",
      version: "0.1.0",
      permissionDigest: "digest",
      configured: true,
    });
    sqlite
      .prepare(
        "INSERT INTO capability_settings (id, capability_id, key, value_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        "bad-setting",
        "agentic-worktrees.web-search",
        "resultLimit",
        "{sensitive-corrupt-value",
        Date.now(),
        Date.now(),
      );
    expect(() =>
      repository.getSettings("agentic-worktrees.web-search"),
    ).toThrow("Stored capability settings are invalid.");
    try {
      repository.getSettings("agentic-worktrees.web-search");
    } catch (error) {
      expect(String(error)).not.toContain("sensitive-corrupt-value");
    }
  });

  it("rejects stored setting JSON with a non-scalar value", () => {
    repository.upsertInstallation({
      capabilityId: "agentic-worktrees.web-search",
      version: "0.1.0",
      permissionDigest: "digest",
      configured: true,
    });
    sqlite
      .prepare(
        "INSERT INTO capability_settings (id, capability_id, key, value_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        "object-setting",
        "agentic-worktrees.web-search",
        "resultLimit",
        "{}",
        Date.now(),
        Date.now(),
      );
    expect(() =>
      repository.getSettings("agentic-worktrees.web-search"),
    ).toThrow("Stored capability settings are invalid.");
  });

  it("guards session transitions and lists interrupted records", () => {
    const pending = repository.transitionSessionCapability({
      runId: "run-1",
      capabilityId: "agentic-worktrees.web-search",
      version: "0.1.0",
      to: "pending_activation",
    });
    expect(pending.status).toBe("pending_activation");
    expect(repository.listInterruptedSessionCapabilities()).toHaveLength(1);
    const active = repository.transitionSessionCapability({
      runId: "run-1",
      capabilityId: "agentic-worktrees.web-search",
      version: "0.1.0",
      to: "active",
    });
    expect(active.activatedAt).toBeInstanceOf(Date);
    expect(repository.listActiveSessionCapabilities()).toHaveLength(1);
    expect(() =>
      repository.transitionSessionCapability({
        runId: "run-1",
        capabilityId: "agentic-worktrees.web-search",
        version: "0.1.0",
        to: "inactive",
      }),
    ).toThrow("active -> inactive");
  });

  it("enumerates active runs by capability ID without losing inactive associations", () => {
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO runs (id, repository_id, worktree_id, title, prompt, status, created_at, updated_at) VALUES ('run-2', 'repo', 'wt', 'Run 2', '', 'idle', ?, ?)`,
      )
      .run(now, now);
    for (const runId of ["run-1", "run-2"]) {
      repository.transitionSessionCapability({
        runId,
        capabilityId: "agentic-worktrees.web-search",
        version: "0.1.0",
        to: "pending_activation",
      });
      if (runId === "run-1")
        repository.transitionSessionCapability({
          runId,
          capabilityId: "agentic-worktrees.web-search",
          version: "0.1.0",
          to: "active",
        });
    }
    expect(
      repository.listActiveRunsByCapabilityId("agentic-worktrees.web-search"),
    ).toEqual(["run-1"]);
    expect(
      repository
        .listSessionCapabilitiesByCapabilityId("agentic-worktrees.web-search")
        .map((record) => [record.runId, record.status]),
    ).toEqual([
      ["run-1", "active"],
      ["run-2", "pending_activation"],
    ]);
  });

  it("restores an exact session snapshot after transactional version changes", () => {
    repository.transitionSessionCapability({
      runId: "run-1",
      capabilityId: "agentic-worktrees.web-search",
      version: "0.1.0",
      to: "pending_activation",
    });
    repository.transitionSessionCapability({
      runId: "run-1",
      capabilityId: "agentic-worktrees.web-search",
      version: "0.1.0",
      to: "active",
    });
    const snapshot = repository.snapshotSessionCapabilities(
      "agentic-worktrees.web-search",
    );
    repository.updateSessionCapabilityVersions(
      "agentic-worktrees.web-search",
      ["run-1"],
      "0.2.0",
    );
    expect(
      repository.getSessionCapability("run-1", "agentic-worktrees.web-search")
        ?.version,
    ).toBe("0.2.0");
    repository.restoreSessionCapabilities(snapshot);
    const restored = repository.getSessionCapability(
      "run-1",
      "agentic-worktrees.web-search",
    );
    expect(restored).toMatchObject({
      runId: snapshot.records[0].runId,
      version: snapshot.records[0].version,
      status: snapshot.records[0].status,
    });
    expect(restored?.createdAt.getTime()).toBe(snapshot.records[0].createdAt);
    expect(Object.isFrozen(snapshot.records)).toBe(true);
    expect(Object.isFrozen(snapshot.records[0])).toBe(true);
    expect(() => {
      (snapshot.records[0] as { createdAt: number }).createdAt = 0;
    }).toThrow();
    expect(snapshot.records[0].createdAt).not.toBe(0);
  });

  it("rolls back all session versions when one requested association is missing", () => {
    repository.transitionSessionCapability({
      runId: "run-1",
      capabilityId: "agentic-worktrees.web-search",
      version: "0.1.0",
      to: "pending_activation",
    });
    expect(() =>
      repository.updateSessionCapabilityVersions(
        "agentic-worktrees.web-search",
        ["run-1", "missing-run"],
        "0.2.0",
      ),
    ).toThrow("Capability session could not be updated");
    expect(
      repository.getSessionCapability("run-1", "agentic-worktrees.web-search")
        ?.version,
    ).toBe("0.1.0");
  });

  it("cascades session capability rows with runs", () => {
    repository.transitionSessionCapability({
      runId: "run-1",
      capabilityId: "agentic-worktrees.web-search",
      version: "0.1.0",
      to: "pending_activation",
    });
    sqlite.prepare("DELETE FROM runs WHERE id = 'run-1'").run();
    expect(repository.listSessionCapabilities("run-1")).toEqual([]);
  });
});
