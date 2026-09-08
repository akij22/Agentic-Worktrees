import { access, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createStatefulLocalDistributionService, runDeterministicLocalWebSearchSmoke, runLocalWebSearchLifecycle, withPackedWorkspace } from "./local-lifecycle.mjs";

async function fixture(directory: string, name: string, version: string, verified = true) {
  const path = join(directory, name);
  await writeFile(path, JSON.stringify({ id: "agentic-worktrees.web-search", version, verified }));
  return path;
}

async function createHarness() {
  const directory = await mkdtemp(join(tmpdir(), "aw-lifecycle-test-"));
  return {
    service: createStatefulLocalDistributionService(directory),
    fixtures: {
      v010: await fixture(directory, "v010.tgz", "0.1.0"),
      v011: await fixture(directory, "v011.tgz", "0.1.1"),
      failedVerifier: await fixture(directory, "invalid.tgz", "9.9.9", false),
      settings: { providerMode: "auto", resultLimit: 5 },
      secretReferences: { exaApiKey: "vault:smoke-secret" },
      managedPath: "/private/managed/path", query: "private query", fetchedContent: "private result",
    },
  };
}

describe("local Web Search package lifecycle", () => {
  it("packs into an owned temporary directory and removes the tarball afterward", async () => {
    let tarball = "";
    await withPackedWorkspace("@agentic-worktrees/web-search", async (path: string) => { tarball = path; await expect(access(path)).resolves.toBeUndefined(); });
    await expect(access(tarball)).rejects.toThrow();
  }, 30_000);

  it("executes the complete lifecycle against independent disk-backed state", async () => {
    const { service, fixtures } = await createHarness();
    await runLocalWebSearchLifecycle(service, fixtures);
    await expect(service.get()).resolves.toMatchObject({ version: "0.1.0", state: "installed" });
  });

  it("fails when update is a no-op instead of trusting a pre-coded outcome", async () => {
    const { service, fixtures } = await createHarness();
    service.update = async () => {};
    await expect(runLocalWebSearchLifecycle(service, fixtures)).rejects.toThrow("Update did not preserve settings");
  });

  it("fails when a broken verifier artifact mutates installed state", async () => {
    const { service, fixtures } = await createHarness();
    service.expectUpdateFailure = async (path: string) => {
      await writeFile(path, JSON.stringify({ id: "agentic-worktrees.web-search", version: "9.9.9", verified: true }));
      await service.update(path);
    };
    await expect(runLocalWebSearchLifecycle(service, fixtures)).rejects.toThrow("Failed verification changed");
  });

  it("runs as a standalone deterministic smoke", async () => {
    await expect(runDeterministicLocalWebSearchSmoke()).resolves.toEqual({ passed: true });
  });
});
