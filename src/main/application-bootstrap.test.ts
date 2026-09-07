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

it("preserves UI initialization and stops services exactly once on shutdown", async () => {
  const calls: string[] = [];
  let beforeQuit: (() => Promise<void>) | undefined;
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
    onBeforeQuit: (listener) => {
      beforeQuit = listener;
      return () => undefined;
    },
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
  await beforeQuit?.();
  await beforeQuit?.();
  expect(services.stop).toHaveBeenCalledTimes(1);
});

it("handles endpoint creation failure safely", async () => {
  const quit = vi.fn();
  const terminal = {
    writeLine: vi.fn(),
    confirm: vi.fn(),
    setExitCode: vi.fn(),
  };
  const app: ElectronAppPort = {
    whenReady: vi.fn(),
    requestSingleInstanceLock: vi.fn(),
    onSecondInstance: () => () => undefined,
    getPath: () => "/tmp",
    quit,
  };
  const deps = {
    createServices: vi.fn(),
    createWindow: vi.fn(),
    initializeGitHub: vi.fn(),
    discoverAgents: vi.fn(),
    terminal: () => terminal,
    createEndpoint: async () => {
      throw new Error("listen");
    },
  } as unknown as BootstrapDependencies;
  await runApplicationBootstrap(["list"], app, deps);
  expect(terminal.writeLine).toHaveBeenCalledWith("Package operation failed.");
  expect(terminal.setExitCode).toHaveBeenCalledWith(1);
  expect(app.requestSingleInstanceLock).not.toHaveBeenCalled();
  expect(quit).toHaveBeenCalled();
});

it("handles secondary endpoint failure without initializing services or hanging", async () => {
  const close = vi.fn(async () => undefined);
  const quit = vi.fn();
  const app: ElectronAppPort = {
    whenReady: vi.fn(),
    requestSingleInstanceLock: () => false,
    onSecondInstance: () => () => undefined,
    getPath: () => "/tmp",
    quit,
  };
  const terminal = {
    writeLine: vi.fn(),
    confirm: vi.fn(),
    setExitCode: vi.fn(),
  };
  const deps = {
    createServices: vi.fn(),
    createWindow: vi.fn(),
    initializeGitHub: vi.fn(),
    discoverAgents: vi.fn(),
    terminal: () => terminal,
    createEndpoint: async () => ({
      data: {
        schemaVersion: 1,
        requestId: "request_1",
        endpoint: "/tmp/aw-deadbeef.sock",
        token: "a".repeat(64),
        command: { kind: "list" },
      },
      wait: async () => {
        throw new Error("connect");
      },
      close,
    }),
  } as unknown as BootstrapDependencies;
  await runApplicationBootstrap(["list"], app, deps);
  expect(terminal.writeLine).toHaveBeenCalledWith("Package operation failed.");
  expect(terminal.setExitCode).toHaveBeenCalledWith(1);
  expect(close).toHaveBeenCalled();
  expect(quit).toHaveBeenCalled();
  expect(deps.createServices).not.toHaveBeenCalled();
});

it("keeps a CLI primary endpoint alive while forwarding a secondary command", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "aw-bootstrap-pair-"));
  let secondInstance: ((data: unknown) => void) | undefined;
  let releaseLocal!: () => void;
  const localBlocked = new Promise<void>((resolve) => {
    releaseLocal = resolve;
  });
  let listCalls = 0;
  const distributionService = {
    subscribe: () => () => undefined,
    listMarketplaceCapabilities: vi.fn(async () => {
      listCalls++;
      if (listCalls === 1) await localBlocked;
      return [];
    }),
  };
  const stop = vi.fn(async () => undefined);
  const services = {
    capabilityService: {},
    distributionService,
    webSearchMigration: {},
    stop,
  };
  const primaryApp: ElectronAppPort = {
    whenReady: async () => undefined,
    requestSingleInstanceLock: () => true,
    onSecondInstance: (listener) => {
      secondInstance = listener;
      return () => {
        secondInstance = undefined;
      };
    },
    getPath: (name) => (name === "temp" ? temp : path.join(temp, "primary")),
    quit: vi.fn(),
  };
  const primaryDeps = {
    createServices: vi.fn(async () => services),
    createWindow: vi.fn(),
    initializeGitHub: vi.fn(),
    discoverAgents: vi.fn(),
    terminal: () => ({
      writeLine: vi.fn(),
      confirm: vi.fn(),
      setExitCode: vi.fn(),
    }),
  } as unknown as BootstrapDependencies;
  const primary = runApplicationBootstrap(["list"], primaryApp, primaryDeps);
  while (!secondInstance || listCalls === 0)
    await new Promise((resolve) => setTimeout(resolve, 1));
  const secondaryTerminal = {
    writeLine: vi.fn(),
    confirm: vi.fn(),
    setExitCode: vi.fn(),
  };
  let forwardedData!: () => void;
  const dataForwarded = new Promise<void>((resolve) => {
    forwardedData = resolve;
  });
  const secondaryApp: ElectronAppPort = {
    whenReady: vi.fn(),
    requestSingleInstanceLock: (data) => {
      secondInstance?.(data);
      forwardedData();
      return false;
    },
    onSecondInstance: () => () => undefined,
    getPath: (name) => (name === "temp" ? temp : path.join(temp, "secondary")),
    quit: vi.fn(),
  };
  const secondaryDeps = {
    ...primaryDeps,
    createServices: vi.fn(),
    terminal: () => secondaryTerminal,
  } as unknown as BootstrapDependencies;
  let primaryDone = false;
  let secondaryDone = false;
  const secondary = runApplicationBootstrap(
    ["list"],
    secondaryApp,
    secondaryDeps,
  ).finally(() => {
    secondaryDone = true;
  });
  await dataForwarded;
  releaseLocal();
  void primary.finally(() => {
    primaryDone = true;
  });
  await Promise.race([
    Promise.all([primary, secondary]),
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `pair timeout ${primaryDone}/${secondaryDone}/${listCalls}`,
            ),
          ),
        1000,
      ),
    ),
  ]);
  expect(listCalls).toBe(2);
  expect(secondaryTerminal.writeLine).toHaveBeenCalledWith(
    "No managed packages installed.",
  );
  expect(secondaryTerminal.setExitCode).toHaveBeenCalledWith(0);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(secondInstance).toBeUndefined();
  await rm(temp, { recursive: true, force: true });
});
