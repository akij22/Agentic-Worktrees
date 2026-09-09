import { describe, expect, it, vi } from "vitest";
import { webSearchScenario } from "./web-search-scenario.mjs";

describe("Web Search real-provider scenario", () => {
  it("discovers the installed runtime in Codex and OpenCode and removes it after deactivation", async () => {
    let marker = "";
    const callsByRun = new Map<string, number>();
    const driver = {
      configureCapability: vi.fn(),
      createSession: vi.fn(async (kind: string) => `run-${kind}`),
      sendMessage: vi.fn(async (runId: string, content: string) => {
        if (content.includes("preserve")) marker = content;
        if (content.includes("official Electron")) callsByRun.set(runId, 1);
      }),
      waitForIdle: vi.fn(),
      activateCapability: vi.fn(),
      deactivateCapability: vi.fn(async (runId: string) => callsByRun.set(runId, 1)),
      getSnapshot: vi.fn(async (runId: string) => {
        const deactivated = driver.deactivateCapability.mock.calls.some(([id]) => id === runId);
        return deactivated
          ? { messages: [{ content: "capability unavailable.", tools: [{ tool: "web_search" }] }] }
          : { messages: [{ content: `${marker} https://electronjs.org`, tools: [{ tool: "web_search" }] }] };
      }),
    };

    await expect(webSearchScenario.run(driver as never, {
      agents: [{ kind: "codex", version: "0.150.1" }, { kind: "opencode", version: "1.18.23" }],
      worktreeId: "worktree",
      timeoutMs: 1,
    } as never)).resolves.toHaveLength(2);

    expect(driver.createSession.mock.calls.map(([kind]) => kind)).toEqual(["codex", "opencode"]);
    expect(driver.configureCapability).toHaveBeenCalledWith("agentic-worktrees.web-search", { providerMode: "auto", resultLimit: 5 }, {});
    expect(driver.activateCapability).toHaveBeenCalledTimes(2);
    expect(driver.deactivateCapability).toHaveBeenCalledTimes(2);
  });
});
