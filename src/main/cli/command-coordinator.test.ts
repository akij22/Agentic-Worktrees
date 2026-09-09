import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createReplyEndpoint,
  executeForwardedCommand,
  createCommandExecutionQueue,
  isForwardingEndpointAllowed,
} from "./command-coordinator";

const dirs: string[] = [];
afterEach(async () =>
  Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  ),
);
const terminal = () => ({
  writeLine: vi.fn(),
  confirm: vi.fn(async () => true),
  setExitCode: vi.fn(),
});
describe("command coordinator", () => {
  it("authenticates and forwards progress, review, and result", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "aw-cli-"));
    dirs.push(dir);
    const output = terminal();
    const endpoint = await createReplyEndpoint({
      tempPath: dir,
      command: { kind: "list" },
      terminal: output,
    });
    const handled = executeForwardedCommand(
      endpoint.data,
      async (command, remote) => {
        expect(command).toEqual({ kind: "list" });
        remote.writeLine("working");
        expect(await remote.confirm("Continue?")).toBe(true);
        remote.setExitCode(0);
      },
      dir,
    );
    await expect(endpoint.wait()).resolves.toBe(0);
    await expect(handled).resolves.toBe(true);
    expect(output.writeLine).toHaveBeenCalledWith("working");
    await endpoint.close();
  });
  it("rejects malformed forwarding data and endpoints outside temp before connecting", async () => {
    await expect(
      executeForwardedCommand({ token: "bad" }, vi.fn(), "/tmp"),
    ).resolves.toBe(false);
    const net = { connect: vi.fn(), createServer: vi.fn() };
    const raw = {
      schemaVersion: 1,
      requestId: "request_1",
      endpoint: "/tmp/../attacker.sock",
      token: "a".repeat(64),
      command: { kind: "list" },
    };
    await expect(
      executeForwardedCommand(raw, vi.fn(), "/tmp", net as never),
    ).resolves.toBe(false);
    expect(net.connect).not.toHaveBeenCalled();
  });
  it("accepts only the exact Windows reply pipe shape", () => {
    expect(
      isForwardingEndpointAllowed(
        "\\\\.\\pipe\\agentic-worktrees-0123456789abcdef0123456789abcdef",
        "C:\\Temp",
        "win32",
      ),
    ).toBe(true);
    expect(
      isForwardingEndpointAllowed(
        "\\\\.\\pipe\\other-0123456789abcdef0123456789abcdef",
        "C:\\Temp",
        "win32",
      ),
    ).toBe(false);
    expect(
      isForwardingEndpointAllowed(
        "\\\\.\\pipe\\agentic-worktrees-../../attack",
        "C:\\Temp",
        "win32",
      ),
    ).toBe(false);
  });
  it("returns a safe failure when an allowed endpoint cannot be connected", async () => {
    const raw = {
      schemaVersion: 1,
      requestId: "request_1",
      endpoint: "/tmp/aw-deadbeef.sock",
      token: "a".repeat(64),
      command: { kind: "list" },
    };
    await expect(executeForwardedCommand(raw, vi.fn(), "/tmp")).resolves.toBe(
      false,
    );
  });
  it("serializes commands and continues after a failure", async () => {
    let active = 0;
    let maximum = 0;
    const order: string[] = [];
    const queued = createCommandExecutionQueue(async (command) => {
      active++;
      maximum = Math.max(maximum, active);
      order.push(command.kind);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      if (command.kind === "list") throw new Error("failure");
    });
    const abort = new AbortController().signal;
    const first = queued({ kind: "list" }, terminal(), abort).catch(
      () => undefined,
    );
    const second = queued({ kind: "update" }, terminal(), abort);
    await Promise.all([first, second]);
    expect(maximum).toBe(1);
    expect(order).toEqual(["list", "update"]);
  });
  it("cancels execution when the reply client disconnects", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "aw-cli-"));
    dirs.push(dir);
    const endpoint = await createReplyEndpoint({
      tempPath: dir,
      command: { kind: "list" },
      terminal: terminal(),
    });
    let observed: AbortSignal | undefined;
    const handled = executeForwardedCommand(
      endpoint.data,
      async (_command, _terminal, signal) => {
        observed = signal;
        await new Promise<void>((resolve) =>
          signal.addEventListener("abort", () => resolve(), { once: true }),
        );
      },
      dir,
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    await endpoint.close();
    await handled;
    expect(observed?.aborted).toBe(true);
  });
});
