import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";

const execFileAsync = promisify(execFile);
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

  it("runs local lifecycle then skips real providers unless a packaged executable is explicitly supplied", async () => {
    await expect(runFromEnvironment({}, ["--scenario", "web-search"])).resolves.toEqual({
      skipped: true,
      reason: "Deterministic local smoke passed; AW_SMOKE_EXECUTABLE is not set, so real-provider smoke was skipped.",
    });
  });

  it("rejects missing and unknown scenarios before provider skip", async () => {
    await expect(runFromEnvironment({}, ["--scenario"])).rejects.toThrow("requires a scenario id");
    await expect(runFromEnvironment({}, ["--scenario", "missing"])).rejects.toThrow("Unknown capability smoke scenario: missing");
  });

  it("wires the deterministic lifecycle into the npm Web Search smoke command", async () => {
    const { stdout } = await execFileAsync("npm", ["run", "smoke:capabilities:web-search"], { maxBuffer: 10 * 1024 * 1024 });
    expect(stdout).toContain("Deterministic local smoke passed");
  }, 30_000);

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
