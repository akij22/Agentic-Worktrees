import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import {
  runApplicationBootstrap,
  type BootstrapDependencies,
  type ElectronAppPort,
} from "./application-bootstrap";

vi.mock("./ipc", () => ({
  configureMarketplaceIpc: vi.fn(),
  registerIpcHandlers: vi.fn(),
}));

it("keeps CLI bootstrap headless and skips UI-only initialization", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "aw-bootstrap-"));
  const quit = vi.fn();
  const window = vi.fn();
  const github = vi.fn();
  const discover = vi.fn();
  const stop = vi.fn(async () => undefined);
  const distributionService = {
    subscribe: () => () => undefined,
    listMarketplaceCapabilities: vi.fn(async () => []),
  };
  const createServices = vi.fn(async () => ({
    capabilityService: {},
    distributionService,
    webSearchMigration: {},
    stop,
  }));
  const app: ElectronAppPort = {
    whenReady: vi.fn(async () => undefined),
    requestSingleInstanceLock: vi.fn(() => true),
    onSecondInstance: vi.fn(() => () => undefined),
    getPath: (name) => (name === "temp" ? temp : path.join(temp, "user")),
    quit,
  };
  const terminal = {
    writeLine: vi.fn(),
    confirm: vi.fn(async () => false),
    setExitCode: vi.fn(),
  };
  const dependencies = {
    createServices,
    createWindow: window,
    initializeGitHub: github,
    discoverAgents: discover,
    terminal: () => terminal,
  } as unknown as BootstrapDependencies;
  try {
    await runApplicationBootstrap(["list"], app, dependencies);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  expect(createServices).toHaveBeenCalledWith({
    userDataPath: path.join(temp, "user"),
    mode: "cli",
  });
  expect(window).not.toHaveBeenCalled();
  expect(github).not.toHaveBeenCalled();
  expect(discover).not.toHaveBeenCalled();
  expect(stop).toHaveBeenCalled();
  expect(quit).toHaveBeenCalled();
});

it("preserves UI initialization after readiness", async () => {
  const calls: string[] = [];
  const services = {
    capabilityService: {
      reconcileCapabilities: vi.fn(async () => calls.push("capabilities")),
    },
    distributionService: {},
    webSearchMigration: {},
    skillService: { reconcileSkills: vi.fn(async () => calls.push("skills")) },
    stop: vi.fn(),
  };
  const app: ElectronAppPort = {
    whenReady: async () => {
      calls.push("ready");
    },
    requestSingleInstanceLock: () => true,
    onSecondInstance: () => () => undefined,
    getPath: () => "/tmp/test",
    quit: vi.fn(),
  };
  const deps = {
    createServices: vi.fn(async () => services),
    createWindow: vi.fn(() => calls.push("window")),
    initializeGitHub: vi.fn(async () => calls.push("github")),
    discoverAgents: vi.fn(() => calls.push("agents")),
    terminal: vi.fn(),
  } as unknown as BootstrapDependencies;
  await runApplicationBootstrap([], app, deps);
  expect(calls[0]).toBe("ready");
  expect(calls).toContain("github");
  expect(calls.at(-1)).toBe("window");
});
