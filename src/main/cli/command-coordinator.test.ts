import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createReplyEndpoint,
  executeForwardedCommand,
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
    );
    await expect(endpoint.wait()).resolves.toBe(0);
    await expect(handled).resolves.toBe(true);
    expect(output.writeLine).toHaveBeenCalledWith("working");
    await endpoint.close();
  });
  it("rejects malformed forwarding data before connecting", async () => {
    await expect(
      executeForwardedCommand({ token: "bad" }, vi.fn()),
    ).resolves.toBe(false);
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
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    await endpoint.close();
    await handled;
    expect(observed?.aborted).toBe(true);
  });
});
