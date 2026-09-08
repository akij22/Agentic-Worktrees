import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { digestPackageTree } from "../packages/content-digest";
import { getHostedCapability, listHostedCapabilityIds } from "./host-registry";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

async function managedFixture() {
  const root = await mkdtemp(join(tmpdir(), "aw-hosted-"));
  roots.push(root);
  const manifest = {
    id: "test.managed",
    name: "Managed",
    version: "1.0.0",
    sdkVersion: ">=0.1.0",
    description: "Managed fixture",
    category: "test",
    author: { name: "Test" },
    license: "MIT",
    compatibility: { codex: "supported", opencode: "supported" },
    permissions: { network: [], secrets: [] },
    settings: {},
  };
  const descriptor = {
    manifest,
    tools: [
      {
        name: "managed_echo",
        description: "Echo",
        inputSchema: { type: "object" },
      },
    ],
  };
  await writeFile(join(root, "capability.json"), JSON.stringify(descriptor));
  await writeFile(
    join(root, "entry.mjs"),
    `export default {manifest:${JSON.stringify(manifest)},tools:[{name:"managed_echo",description:"Echo",inputSchema:{type:"object"},execute:async()=>({content:[{type:"text",text:"ok"}]})}]};`,
  );
  const contentDigest = await digestPackageTree(root);
  const canonicalRoot = await realpath(root);
  return {
    root: canonicalRoot,
    runtime: {
      kind: "managed" as const,
      capabilityId: manifest.id,
      packageName: "@test/managed",
      version: manifest.version,
      packageRoot: canonicalRoot,
      manifest: "capability.json",
      entry: "entry.mjs",
      contentDigest,
    },
  };
}

describe("host registry", () => {
  it("exposes only frozen explicit bundled IDs", () => {
    const ids = listHostedCapabilityIds();
    expect(ids).toEqual([
      "agentic-worktrees.url-fetch",
      "agentic-worktrees.web-search",
    ]);
    expect(Object.isFrozen(ids)).toBe(true);
  });
  it("loads the bundled Web Search runtime and tool", async () => {
    const capability = await getHostedCapability({
      kind: "bundled",
      capabilityId: "agentic-worktrees.web-search",
      version: "0.1.0",
    });
    expect(capability?.tools.map((tool) => tool.name)).toEqual(["web_search"]);
  });
  it("returns undefined for unknown bundled capabilities", async () => {
    await expect(
      getHostedCapability({
        kind: "bundled",
        capabilityId: "unknown.capability",
        version: "1.0.0",
      }),
    ).resolves.toBeUndefined();
  });
  it("imports a validated managed capability and caches its definition", async () => {
    const fixture = await managedFixture();
    const first = await getHostedCapability(fixture.runtime);
    const second = await getHostedCapability(fixture.runtime);
    expect(first?.manifest.id).toBe("test.managed");
    expect(second).toBe(first);
  });
  it("rejects managed path escape before import", async () => {
    const fixture = await managedFixture();
    await expect(
      getHostedCapability({ ...fixture.runtime, entry: "../escape.mjs" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
  it("rejects package tampering against the main-derived digest", async () => {
    const fixture = await managedFixture();
    await writeFile(join(fixture.root, "extra.txt"), "tampered");
    await expect(getHostedCapability(fixture.runtime)).rejects.toMatchObject({
      code: "invalid_input",
    });
  });
  it("rejects runtime identity mismatch", async () => {
    const fixture = await managedFixture();
    await expect(
      getHostedCapability({ ...fixture.runtime, capabilityId: "test.other" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
});
