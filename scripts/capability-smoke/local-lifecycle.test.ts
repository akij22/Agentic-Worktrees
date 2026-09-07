import { access } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { assertSmokeOutputIsRedacted, runLocalWebSearchLifecycle, withPackedWorkspace } from "./local-lifecycle.mjs";

type RecordState = { id: string; version: string; state: string; settings?: object };

function createDistributionService() {
  let record: RecordState | undefined;
  let active = false;
  const calls: string[] = [];
  return {
    calls,
    list: vi.fn(async () => record ? [record] : []),
    install: vi.fn(async (tarball: string) => { calls.push(`install:${tarball}`); record = { id: "agentic-worktrees.web-search", version: "0.1.0", state: "installed" }; }),
    configure: vi.fn(async (_id: string, settings: object) => { calls.push("configure"); record = { ...record!, settings }; active = true; }),
    restart: vi.fn(async () => { calls.push("restart"); }),
    get: vi.fn(async () => record),
    discover: vi.fn(async (provider: string) => { calls.push(`discover:${provider}`); return record?.state === "installed" ? ["web_search"] : []; }),
    update: vi.fn(async (tarball: string) => { calls.push(`update:${tarball}`); record = { ...record!, version: "0.1.1" }; }),
    expectUpdateFailure: vi.fn(async (tarball: string) => { calls.push(`verify-failed:${tarball}`); }),
    remove: vi.fn(async () => { calls.push("remove"); record = undefined; active = false; }),
    picker: vi.fn(async () => record ? [record] : []),
    activeTools: vi.fn(async () => active ? ["web_search"] : []),
    seedLegacyOffline: vi.fn(async () => { calls.push("offline"); record = { id: "agentic-worktrees.web-search", version: "0.0.0", state: "migration_pending" }; }),
    reconnect: vi.fn(async (tarball: string) => { calls.push(`reconnect:${tarball}`); record = { ...record!, version: "0.1.0", state: "installed" }; }),
    rendererPayload: vi.fn(async () => JSON.stringify({ id: record?.id, state: record?.state })),
    logs: vi.fn(async () => "capability lifecycle completed"),
  };
}

const fixtures = {
  v010: "/owned-temp/web-search-0.1.0.tgz",
  v011: "/owned-temp/web-search-0.1.1.tgz",
  failedVerifier: "/owned-temp/web-search-invalid.tgz",
  settings: { providerMode: "auto", resultLimit: 5 },
  secretReferences: { exaApiKey: "vault:smoke-secret" },
  managedPath: "/private/user-data/capabilities/web-search",
  query: "private smoke query",
  fetchedContent: "private fetched content",
};

describe("local Web Search package lifecycle", () => {
  it("packs into an owned temporary directory and removes the tarball afterward", async () => {
    let tarball = "";
    await withPackedWorkspace("@agentic-worktrees/web-search", async (path: string) => {
      tarball = path;
      await expect(access(path)).resolves.toBeUndefined();
      expect(path).toMatch(/agentic-worktrees-web-search-0\.1\.0\.tgz$/);
    });
    await expect(access(tarball)).rejects.toThrow();
  }, 30_000);

  it("uses local tarballs through the distribution seam for install, restart, update, rollback, removal, and migration recovery", async () => {
    const service = createDistributionService();

    await runLocalWebSearchLifecycle(service, fixtures);

    expect(service.calls).toEqual([
      `install:${fixtures.v010}`,
      "configure",
      "restart",
      "discover:codex",
      "discover:opencode",
      `update:${fixtures.v011}`,
      `verify-failed:${fixtures.failedVerifier}`,
      "remove",
      "offline",
      `reconnect:${fixtures.v010}`,
    ]);
    expect(await service.get()).toMatchObject({ version: "0.1.0", state: "installed" });
  });

  it("fails if picker or logs expose managed paths, secrets, queries, or fetched content", () => {
    expect(() => assertSmokeOutputIsRedacted("log vault:smoke-secret", [fixtures.secretReferences.exaApiKey])).toThrow(/Sensitive/);
    expect(() => assertSmokeOutputIsRedacted("safe lifecycle status", Object.values(fixtures))).not.toThrow();
  });
});
