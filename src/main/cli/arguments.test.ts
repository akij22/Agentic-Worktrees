import { describe, expect, it } from "vitest";
import { parseCliArguments } from "./arguments";

describe("parseCliArguments", () => {
  it("returns UI mode only for no arguments", () => expect(parseCliArguments([])).toEqual({ mode: "ui" }));
  it.each([
    [["install", "@agentic-worktrees/web-search@0.1.0"], { kind: "install", sourceSpec: "@agentic-worktrees/web-search@0.1.0" }],
    [["list"], { kind: "list" }], [["update"], { kind: "update" }],
    [["update", "pkg@2.0.0"], { kind: "update", sourceSpec: "pkg@2.0.0" }],
    [["remove", "pkg"], { kind: "remove", sourceSpec: "pkg" }],
  ])("parses %j", (argv, command) => expect(parseCliArguments(argv as string[])).toEqual({ mode: "cli", command }));
  const invalid: string[][] = [["install"], ["remove"], ["list", "x"], ["install", "x", "y"], ["wat"]];
  it.each(invalid)("rejects invalid grammar %j", (...argv) => {
    expect(() => parseCliArguments(argv)).toThrow(/Usage:/);
  });
});
