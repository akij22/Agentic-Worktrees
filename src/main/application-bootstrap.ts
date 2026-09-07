import { BrowserWindow } from "electron";
import path from "node:path";
import { parseCliArguments, CliUsageError } from "./cli/arguments";
import { NodeCliTerminal } from "./cli/terminal-ui";
import { runPackageCommand } from "./cli/run-command";
import {
  createReplyEndpoint,
  executeForwardedCommand,
} from "./cli/command-coordinator";
import type { ApplicationServices } from "./application-services";

export interface ElectronAppPort {
  whenReady(): Promise<void>;
  requestSingleInstanceLock(additionalData?: Record<string, unknown>): boolean;
  onSecondInstance(listener: (additionalData: unknown) => void): () => void;
  getPath(name: "userData" | "temp"): string;
  quit(): void;
  onActivate?(listener: () => void): () => void;
}
export interface BootstrapDependencies {
  createServices(input: {
    userDataPath: string;
    mode: "ui" | "cli";
  }): Promise<ApplicationServices>;
  createWindow(): void;
  initializeGitHub(): Promise<void>;
  discoverAgents(): void;
  terminal(): NodeCliTerminal;
}
const createWindow = (): void => {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    title: "",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    window.webContents.openDevTools();
  } else
    void window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
};
const defaults: BootstrapDependencies = {
  createServices: async (input) =>
    (await import("./application-services")).createApplicationServices(input),
  createWindow,
  initializeGitHub: async () => {
    try {
      await (
        await import("./github/auth-service")
      ).githubAuthService.getStatus();
    } catch {
      console.error("Failed to initialize GitHub authentication");
    }
  },
  discoverAgents: () => {
    void import("./coding-agents/coding-agent-service").then(
      ({ autoDiscoverAgent, getAgentInstallationStatus }) => {
        for (const installation of getAgentInstallationStatus().installations)
          if (!installation.configured)
            void autoDiscoverAgent(installation.kind).catch(() =>
              console.error("Failed to discover coding agent"),
            );
      },
    );
  },
  terminal: () => new NodeCliTerminal(),
};

export async function runApplicationBootstrap(
  argv: readonly string[],
  electronApp: ElectronAppPort,
  dependencies: BootstrapDependencies = defaults,
): Promise<void> {
  let parsed;
  try {
    parsed = parseCliArguments(argv);
  } catch (error) {
    const terminal = dependencies.terminal();
    terminal.writeLine(
      error instanceof CliUsageError ? error.message : "Invalid command.",
    );
    terminal.setExitCode(2);
    electronApp.quit();
    return;
  }
  if (parsed.mode === "cli") {
    const terminal = dependencies.terminal();
    const endpoint = await createReplyEndpoint({
      tempPath: electronApp.getPath("temp"),
      command: parsed.command,
      terminal,
    });
    const primary = electronApp.requestSingleInstanceLock({ ...endpoint.data });
    if (!primary) {
      try {
        await endpoint.wait();
      } finally {
        await endpoint.close();
        electronApp.quit();
      }
      return;
    }
    await endpoint.close();
    await electronApp.whenReady();
    const services = await dependencies.createServices({
      userDataPath: electronApp.getPath("userData"),
      mode: "cli",
    });
    try {
      await runPackageCommand(parsed.command, services, terminal);
    } finally {
      await services.stop();
      electronApp.quit();
    }
    return;
  }
  if (!electronApp.requestSingleInstanceLock()) {
    electronApp.quit();
    return;
  }
  let services: ApplicationServices | undefined;
  const pending: unknown[] = [];
  const removeSecondInstance = electronApp.onSecondInstance((data) => {
    if (!services) {
      pending.push(data);
      return;
    }
    void executeForwardedCommand(data, (command, terminal, signal) =>
      signal.aborted
        ? Promise.resolve()
        : runPackageCommand(command, services!, terminal),
    );
  });
  await electronApp.whenReady();
  services = await dependencies.createServices({
    userDataPath: electronApp.getPath("userData"),
    mode: "ui",
  });
  for (const data of pending.splice(0))
    void executeForwardedCommand(data, (command, terminal, signal) =>
      signal.aborted
        ? Promise.resolve()
        : runPackageCommand(command, services!, terminal),
    );
  const { configureMarketplaceIpc, registerIpcHandlers } =
    await import("./ipc");
  configureMarketplaceIpc(services.distributionService);
  registerIpcHandlers();
  const reconciliation = Promise.all([
    services.skillService
      ?.reconcileSkills()
      .catch(() => console.error("Skill reconciliation failed")),
    services.capabilityService
      .reconcileCapabilities()
      .catch(() => console.error("Capability reconciliation failed")),
  ]);
  await dependencies.initializeGitHub();
  await reconciliation;
  dependencies.discoverAgents();
  dependencies.createWindow();
  electronApp.onActivate?.(() => {
    if (BrowserWindow.getAllWindows().length === 0) dependencies.createWindow();
  });
  void removeSecondInstance;
}
