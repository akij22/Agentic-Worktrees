import { app } from "electron";
import started from "electron-squirrel-startup";
import {
  runApplicationBootstrap,
  type ElectronAppPort,
} from "./main/application-bootstrap";
import { workspaceTerminalService } from "./main/workspace/workspace-terminal-service";
import { stopCodingAgents } from "./main/coding-agents/coding-agent-service";

if (started) app.quit();

const beforeQuitTasks = new Set<() => Promise<void>>();
const electronApp: ElectronAppPort = {
  whenReady: () => app.whenReady(),
  requestSingleInstanceLock: (additionalData) =>
    app.requestSingleInstanceLock(additionalData),
  onSecondInstance: (listener) => {
    const wrapped = (
      _event: Electron.Event,
      _argv: string[],
      _cwd: string,
      additionalData: unknown,
    ) => listener(additionalData);
    app.on("second-instance", wrapped);
    return () => app.removeListener("second-instance", wrapped);
  },
  getPath: (name) => app.getPath(name),
  quit: () => app.quit(),
  onActivate: (listener) => {
    app.on("activate", listener);
    return () => app.removeListener("activate", listener);
  },
  onBeforeQuit: (listener) => {
    beforeQuitTasks.add(listener);
    return () => beforeQuitTasks.delete(listener);
  },
};

void runApplicationBootstrap(
  process.argv.slice(app.isPackaged ? 1 : 2),
  electronApp,
).catch(() => {
  console.error("capability_startup_unavailable");
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
let stopping = false;
app.on("before-quit", (event) => {
  if (stopping) return;
  event.preventDefault();
  stopping = true;
  void Promise.allSettled([
    ...[...beforeQuitTasks].map((task) => task()),
    Promise.resolve(workspaceTerminalService.disposeAll()),
    stopCodingAgents(),
  ]).finally(() => app.quit());
});
