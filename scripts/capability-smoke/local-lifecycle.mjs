import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const capabilityId = "agentic-worktrees.web-search";

/** Pack a workspace into an owned temporary directory. Nothing is published or retained. */
export async function withPackedWorkspace(workspace, callback) {
  const directory = await mkdtemp(join(tmpdir(), "aw-capability-smoke-"));
  try {
    const { stdout } = await execFileAsync("npm", ["pack", "--json", "--ignore-scripts", "--workspace", workspace, "--pack-destination", directory], { maxBuffer: 10 * 1024 * 1024 });
    const jsonStart = stdout.lastIndexOf("\n[");
    const result = JSON.parse(stdout.slice(jsonStart < 0 ? 0 : jsonStart + 1));
    if (!Array.isArray(result) || typeof result[0]?.filename !== "string") throw new Error("npm pack did not return a tarball name.");
    return await callback(join(directory, result[0].filename));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function assertSmokeOutputIsRedacted(output, forbidden) {
  for (const value of forbidden.filter((item) => typeof item === "string" && item.length > 0)) {
    if (output.includes(value)) throw new Error("Sensitive capability data escaped the smoke boundary.");
  }
}

/** Stateful, disk-backed local distribution seam. Artifact metadata is independent of lifecycle expectations. */
export function createStatefulLocalDistributionService(directory, output = {}) {
  const statePath = join(directory, "state.json");
  let state = { record: undefined, activeSessions: [], logs: [] };
  const persist = () => writeFile(statePath, JSON.stringify(state));
  const artifact = async (path) => JSON.parse(await readFile(path, "utf8"));
  return {
    async list() { return state.record ? [structuredClone(state.record)] : []; },
    async install(path) { const item = await artifact(path); if (!item.verified) throw new Error("verification failed"); state.record = { id: item.id, version: item.version, state: "installed", settings: {}, secretReferences: {} }; await persist(); },
    async configure(id, settings, secretReferences) { if (state.record?.id !== id) throw new Error("not installed"); state.record.settings = structuredClone(settings); state.record.secretReferences = structuredClone(secretReferences); state.activeSessions = ["codex", "opencode"]; await persist(); },
    async restart() { state = JSON.parse(await readFile(statePath, "utf8")); },
    async get(id = capabilityId) { return state.record?.id === id ? structuredClone(state.record) : undefined; },
    async discover(provider) { return state.record?.state === "installed" && state.activeSessions.includes(provider) ? ["web_search"] : []; },
    async update(path) { const item = await artifact(path); if (!item.verified) throw new Error("verification failed"); state.record = { ...state.record, id: item.id, version: item.version }; await persist(); },
    async expectUpdateFailure(path) { try { await this.update(path); } catch { return; } throw new Error("Invalid artifact was accepted."); },
    async remove(id) { if (state.record?.id === id) state.record = undefined; state.activeSessions = []; await persist(); },
    async picker() { return state.record?.state === "installed" ? [{ id: state.record.id, state: state.record.state }] : []; },
    async activeTools() { return state.activeSessions.length ? ["web_search"] : []; },
    async seedLegacyOffline() { state.record = { id: capabilityId, version: "0.0.0", state: "migration_pending", settings: {}, secretReferences: {} }; state.activeSessions = []; await persist(); },
    async reconnect(path) { const item = await artifact(path); state.record = { ...state.record, version: item.version, state: "installed" }; await persist(); },
    async rendererPayload() {
      const safePayload = JSON.stringify({ id: state.record?.id, version: state.record?.version, state: state.record?.state });
      return output.rendererPayload ? output.rendererPayload(structuredClone(state)) : safePayload;
    },
    async logs() { return output.logs ? output.logs(structuredClone(state)) : state.logs.join("\n"); },
  };
}

export async function runLocalWebSearchLifecycle(service, fixtures) {
  const initial = await service.list();
  if (initial.some((item) => item.id === capabilityId)) throw new Error("Web Search must not be preinstalled.");
  await service.install(fixtures.v010);
  await service.configure(capabilityId, fixtures.settings, fixtures.secretReferences);
  await service.restart();
  const restarted = await service.get(capabilityId);
  if (restarted?.version !== "0.1.0") throw new Error("Installed package did not survive restart.");
  for (const provider of ["codex", "opencode"]) if (!(await service.discover(provider)).includes("web_search")) throw new Error(`${provider} did not discover installed web_search.`);
  await service.update(fixtures.v011);
  const updated = await service.get(capabilityId);
  if (updated?.version !== "0.1.1" || JSON.stringify(updated.settings) !== JSON.stringify(fixtures.settings)) throw new Error("Update did not preserve settings.");
  await service.expectUpdateFailure(fixtures.failedVerifier);
  if ((await service.get(capabilityId))?.version !== "0.1.1") throw new Error("Failed verification changed the active version.");
  await service.remove(capabilityId);
  if ((await service.picker()).some((item) => item.id === capabilityId)) throw new Error("Removed capability remained in picker.");
  if ((await service.activeTools()).includes("web_search")) throw new Error("Removed capability remained active.");
  await service.seedLegacyOffline();
  if ((await service.get(capabilityId))?.state !== "migration_pending") throw new Error("Offline migration was not pending.");
  await service.reconnect(fixtures.v010);
  if ((await service.get(capabilityId))?.state !== "installed") throw new Error("Migration did not recover after reconnect.");
  assertSmokeOutputIsRedacted(`${await service.rendererPayload()}\n${await service.logs()}`, [fixtures.managedPath, fixtures.query, fixtures.fetchedContent, ...Object.values(fixtures.secretReferences)]);
}

export async function runDeterministicLocalWebSearchSmoke() {
  const directory = await mkdtemp(join(tmpdir(), "aw-web-search-lifecycle-"));
  try {
    const makeArtifact = async (name, version, verified = true) => { const path = join(directory, name); await writeFile(path, JSON.stringify({ id: capabilityId, version, verified })); return path; };
    const fixtures = {
      v010: await makeArtifact("web-search-0.1.0.tgz", "0.1.0"),
      v011: await makeArtifact("web-search-0.1.1.tgz", "0.1.1"),
      failedVerifier: await makeArtifact("web-search-invalid.tgz", "9.9.9", false),
      settings: { providerMode: "auto", resultLimit: 5 }, secretReferences: { exaApiKey: "vault:smoke-secret" },
      managedPath: join(directory, "managed", basename("web-search")), query: "private smoke query", fetchedContent: "private fetched content",
    };
    await runLocalWebSearchLifecycle(createStatefulLocalDistributionService(directory), fixtures);
    return { passed: true };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
