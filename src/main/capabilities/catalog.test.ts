import { describe, expect, it } from "vitest";
import { webSearchManifest } from "@agentic-worktrees/web-search-capability";
import {
  createCapabilityCatalog,
  getBundledCapability,
  listBundledCapabilities,
  toCapabilityDetailDto,
} from "./catalog";

describe("bundled capability catalog", () => {
  it("lists and safely projects immutable reviewed capabilities", () => {
    const listed = listBundledCapabilities();
    expect(Object.isFrozen(listed)).toBe(true);
    expect(listed.map((item) => item.manifest.id)).toEqual([
      "agentic-worktrees.url-fetch",
    ]);
    expect(
      getBundledCapability("agentic-worktrees.url-fetch").toolNames,
    ).toEqual(["fetch_url"]);
    const detail = toCapabilityDetailDto(
      getBundledCapability("agentic-worktrees.url-fetch"),
    );
    expect(detail.compatibility).toEqual({
      codex: "supported",
      opencode: "supported",
    });
    expect(JSON.stringify(detail)).not.toMatch(
      /bearerToken|endpoint|secretValue|execute/,
    );
    expect(detail.providedTools).toEqual(["fetch_url"]);
  });

  it("composes bundled and managed capabilities without exposing runtime paths", () => {
    const installed = {
      list: () => [
        {
          record: {
            itemId: webSearchManifest.id,
            packageName: "@agentic-worktrees/web-search",
            activeVersion: webSearchManifest.version,
            activeContentDigest: "digest",
            reviewStatus: "official-reviewed",
            trust: "official",
          },
          descriptor: {
            manifest: webSearchManifest,
            tools: [
              {
                name: "web_search",
                description: "Search",
                inputSchema: { type: "object" },
              },
            ],
          },
          packageRoot: "/private/managed/web-search",
          manifestRelativePath: "capability.json",
          entryRelativePath: "dist/index.js",
        },
      ],
      refresh: async () => undefined,
    };
    const catalog = createCapabilityCatalog(installed as never);
    expect(catalog.list().map((entry) => entry.manifest.id)).toEqual([
      "agentic-worktrees.url-fetch",
      "agentic-worktrees.web-search",
    ]);
    const dto = toCapabilityDetailDto(catalog.get(webSearchManifest.id));
    expect(JSON.stringify(dto)).not.toMatch(
      /packageRoot|manifestRelativePath|entryRelativePath|\/private\/managed|runtime/,
    );
    expect(dto.source).toBe("npm");
  });

  it.each([
    ["ID", "agentic-worktrees.url-fetch", "managed_tool"],
    ["tool", "test.managed", "fetch_url"],
  ])("rejects a managed %s collision", (_label, id, toolName) => {
    const bundled = getBundledCapability("agentic-worktrees.url-fetch");
    const catalog = createCapabilityCatalog({
      list: () => [
        {
          record: {
            itemId: id,
            packageName: "@test/managed",
            activeVersion: "1.0.0",
            activeContentDigest: "digest",
            reviewStatus: "unreviewed",
            trust: "community",
          },
          descriptor: {
            manifest: { ...bundled.manifest, id, version: "1.0.0" },
            tools: [
              {
                name: toolName,
                description: "Tool",
                inputSchema: { type: "object" },
              },
            ],
          },
          packageRoot: "/private/managed",
          manifestRelativePath: "capability.json",
          entryRelativePath: "entry.js",
        },
      ],
      refresh: async () => undefined,
    } as never);
    expect(() => catalog.list()).toThrow(/Duplicate capability/);
  });

  it("rejects unknown IDs without echoing them", () => {
    expect(() => getBundledCapability("secret-user-input")).toThrow(
      "Unknown capability.",
    );
  });
});
