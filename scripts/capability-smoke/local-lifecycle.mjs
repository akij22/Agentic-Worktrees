import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Pack a workspace into an owned temporary directory. Nothing is published or retained. */
export async function withPackedWorkspace(workspace, callback) {
  const directory = await mkdtemp(join(tmpdir(), "aw-capability-smoke-"));
  try {
    const { stdout } = await execFileAsync(
      "npm",
      ["pack", "--json", "--ignore-scripts", "--workspace", workspace, "--pack-destination", directory],
      { maxBuffer: 10 * 1024 * 1024 },
    );
    const jsonStart = stdout.lastIndexOf("\n[");
    const result = JSON.parse(stdout.slice(jsonStart < 0 ? 0 : jsonStart + 1));
    if (!Array.isArray(result) || typeof result[0]?.filename !== "string") {
      throw new Error("npm pack did not return a tarball name.");
    }
    return await callback(join(directory, result[0].filename));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** Reject renderer/log output containing local paths, tokens, queries, or fetched content. */
export function assertSmokeOutputIsRedacted(output, forbidden) {
  for (const value of forbidden.filter((item) => typeof item === "string" && item.length > 0)) {
    if (output.includes(value)) throw new Error("Sensitive capability data escaped the smoke boundary.");
  }
}

/**
 * Deterministic lifecycle exercised through the same distribution seam used by the CLI.
 * The injected service is local: tests never contact npm, providers, or a catalog.
 */
export async function runLocalWebSearchLifecycle(service, fixtures) {
  const capabilityId = "agentic-worktrees.web-search";
  const initial = await service.list();
  if (initial.some((item) => item.id === capabilityId)) throw new Error("Web Search must not be preinstalled.");

  await service.install(fixtures.v010);
  await service.configure(capabilityId, fixtures.settings, fixtures.secretReferences);
  await service.restart();
  const restarted = await service.get(capabilityId);
  if (restarted?.version !== "0.1.0") throw new Error("Installed package did not survive restart.");

  for (const provider of ["codex", "opencode"]) {
    const discovery = await service.discover(provider);
    if (!discovery.includes("web_search")) throw new Error(`${provider} did not discover installed web_search.`);
  }

  await service.update(fixtures.v011);
  const updated = await service.get(capabilityId);
  if (updated?.version !== "0.1.1" || JSON.stringify(updated.settings) !== JSON.stringify(fixtures.settings)) {
    throw new Error("Update did not preserve settings.");
  }

  await service.expectUpdateFailure(fixtures.failedVerifier);
  if ((await service.get(capabilityId))?.version !== "0.1.1") throw new Error("Failed verification changed the active version.");

  await service.remove(capabilityId);
  if ((await service.picker()).some((item) => item.id === capabilityId)) throw new Error("Removed capability remained in picker.");
  if ((await service.activeTools()).includes("web_search")) throw new Error("Removed capability remained active.");

  await service.seedLegacyOffline();
  if ((await service.get(capabilityId))?.state !== "migration_pending") throw new Error("Offline migration was not pending.");
  await service.reconnect(fixtures.v010);
  if ((await service.get(capabilityId))?.state !== "installed") throw new Error("Migration did not recover after reconnect.");

  const output = `${await service.rendererPayload()}\n${await service.logs()}`;
  assertSmokeOutputIsRedacted(output, [
    fixtures.managedPath,
    fixtures.query,
    fixtures.fetchedContent,
    ...Object.values(fixtures.secretReferences),
  ]);
}

export async function readPackedManifest(tarballDirectory) {
  return JSON.parse(await readFile(join(tarballDirectory, "package.json"), "utf8"));
}
