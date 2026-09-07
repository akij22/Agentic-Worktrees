import { z } from "zod";

export const packageCliCommandSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("install"),
    sourceSpec: z.string().min(1).max(4096),
  }),
  z.strictObject({ kind: z.literal("list") }),
  z.strictObject({
    kind: z.literal("update"),
    sourceSpec: z.string().min(1).max(4096).optional(),
  }),
  z.strictObject({
    kind: z.literal("remove"),
    sourceSpec: z.string().min(1).max(4096),
  }),
]);

export type PackageCliCommand =
  | { kind: "install"; sourceSpec: string }
  | { kind: "list" }
  | { kind: "update"; sourceSpec?: string }
  | { kind: "remove"; sourceSpec: string };

export type ParsedCliArguments =
  { mode: "ui" } | { mode: "cli"; command: PackageCliCommand };

export class CliUsageError extends Error {
  readonly exitCode = 2;
  constructor() {
    super(
      "Usage: agentic-worktrees install <npm-spec> | list | update [npm-spec] | remove <npm-spec>",
    );
    this.name = "CliUsageError";
  }
}

export function parseCliArguments(argv: readonly string[]): ParsedCliArguments {
  if (argv.length === 0) return { mode: "ui" };
  const [verb, value, ...extra] = argv;
  if (extra.length > 0) throw new CliUsageError();
  switch (verb) {
    case "install":
      if (!value) throw new CliUsageError();
      return { mode: "cli", command: { kind: "install", sourceSpec: value } };
    case "list":
      if (value) throw new CliUsageError();
      return { mode: "cli", command: { kind: "list" } };
    case "update":
      return {
        mode: "cli",
        command: value
          ? { kind: "update", sourceSpec: value }
          : { kind: "update" },
      };
    case "remove":
      if (!value) throw new CliUsageError();
      return { mode: "cli", command: { kind: "remove", sourceSpec: value } };
    default:
      throw new CliUsageError();
  }
}
