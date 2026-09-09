import { staticDescriptorFromDefinition, validateCapabilityStaticDescriptor } from "@agentic-worktrees/capability-sdk";
import { describe, expect, it, vi } from "vitest";
import descriptorJson from "../capability.json";
import webSearchCapability, { createWebSearchCapability } from "./index";

describe("web search capability", () => {
  it("keeps packaged static metadata identical to runtime metadata", () => {
    const descriptor = validateCapabilityStaticDescriptor(descriptorJson);
    expect(staticDescriptorFromDefinition(webSearchCapability)).toEqual(descriptor);
    expect(descriptor.manifest.id).toBe("agentic-worktrees.web-search");
    expect(descriptor.tools.map(({ name }) => name)).toEqual(["web_search"]);
  });

  it("resolves the optional key at execution and returns attributed output", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                title: "Electron",
                url: "https://exa.example/electron",
                text: "Desktop",
              },
            ],
          }),
        ),
      );
    const capability = createWebSearchCapability({ fetchImpl: fetchMock });
    const getOptional = vi.fn().mockResolvedValue("key");
    const result = await capability.tools[0].execute(
      { query: "electron" },
      {
        signal: new AbortController().signal,
        settings: { resultLimit: 5 },
        secrets: { get: vi.fn(), getOptional },
        logger: { info: vi.fn(), error: vi.fn() },
      },
    );
    expect(getOptional).toHaveBeenCalledWith("exaApiKey");
    expect(result.content[0]?.text).toContain("https://exa.example/electron");
  });
});
