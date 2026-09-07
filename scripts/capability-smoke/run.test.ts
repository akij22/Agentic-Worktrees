import { describe, expect, it, vi } from "vitest";
import { runCapabilitySmokes, runFromEnvironment } from "./run.mjs";

describe("smoke runner", () => {
  it("selects scenarios and always closes", async () => {
    const driver = {
      launch: vi.fn(),
      listConfiguredAgents: vi.fn().mockResolvedValue([{ kind: "codex", version: "0.150.1" }, { kind: "opencode", version: "1.18.23" }]),
      getFirstWorktreeId: vi.fn().mockResolvedValue("w"),
      readProcessLogs: vi.fn(() => ""),
      close: vi.fn(),
    };
    const one = { id: "web-search", run: vi.fn().mockResolvedValue([1]) };
    const two = { id: "url-fetch", run: vi.fn().mockResolvedValue([2]) };
    await expect(runCapabilitySmokes(driver as never, [one, two] as never, { selectedScenarioIds: ["url-fetch"] })).resolves.toEqual([2]);
    expect(one.run).not.toHaveBeenCalled();
    expect(driver.close).toHaveBeenCalledOnce();
  });

  it("reports exact supported provider floors", async () => {
    const driver = { launch: vi.fn(), listConfiguredAgents: vi.fn().mockResolvedValue([]), close: vi.fn() };
    await expect(runCapabilitySmokes(driver as never, [])).rejects.toThrow("Codex CLI 0.150.1 or newer is required.");
    expect(driver.close).toHaveBeenCalled();
  });

  it("skips real providers unless a packaged executable is explicitly supplied", async () => {
    await expect(runFromEnvironment({})).resolves.toEqual({
      skipped: true,
      reason: "AW_SMOKE_EXECUTABLE is not set; real-provider smoke skipped.",
    });
  });

  it("rejects logs containing the optional provider secret", async () => {
    const driver = {
      launch: vi.fn(),
      listConfiguredAgents: vi.fn().mockResolvedValue([{ kind: "codex", version: "0.150.1" }, { kind: "opencode", version: "1.18.23" }]),
      getFirstWorktreeId: vi.fn().mockResolvedValue("w"),
      readProcessLogs: vi.fn(() => "leaked-secret"),
      close: vi.fn(),
    };
    await expect(runCapabilitySmokes(driver as never, [], { apiKey: "leaked-secret" })).rejects.toThrow(/Sensitive/);
  });
});
