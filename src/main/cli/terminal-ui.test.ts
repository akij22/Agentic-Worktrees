import { PassThrough, Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { formatPackageProgress, NodeCliTerminal } from "./terminal-ui";

describe("NodeCliTerminal", () => {
  it.each([["\n", false], ["", false], ["yes\n", true], ["Y\n", true], ["no\n", false]])("confirms %j safely", async (input, expected) => {
    const output = new PassThrough();
    const terminal = new NodeCliTerminal(Readable.from([input]), output);
    await expect(terminal.confirm("Proceed? (y/N)")).resolves.toBe(expected);
  });
  it("writes one safe line and delegates exit code", () => {
    const output = new PassThrough(); const setCode = vi.fn(); let text = "";
    output.on("data", (chunk) => { text += chunk.toString(); });
    const terminal = new NodeCliTerminal(Readable.from([]), output, setCode);
    terminal.writeLine("safe\nline"); terminal.setExitCode(2);
    expect(text).toBe("safe line\n"); expect(setCode).toHaveBeenCalledWith(2);
  });
  it.each(["resolving", "downloading", "verifying", "installing", "removing"] as const)("formats %s progress", (stage) => {
    expect(formatPackageProgress({ operationId: "op", action: "install", stage, status: "in_progress", updatedAt: new Date().toISOString() })).not.toContain("undefined");
  });
});
