import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { CapabilityDistributionProgress } from "../../shared/packages/schemas";

export interface CliTerminal {
  writeLine(value: string): void;
  confirm(question: string): Promise<boolean>;
  setExitCode(code: number): void;
}

export class NodeCliTerminal implements CliTerminal {
  constructor(
    private readonly input: Readable = process.stdin,
    private readonly output: Writable = process.stdout,
    private readonly setCode: (code: number) => void = (code) => { process.exitCode = code; },
  ) {}

  writeLine(value: string): void { this.output.write(`${value.replace(/[\r\n]+/g, " ")}\n`); }

  async confirm(question: string): Promise<boolean> {
    this.output.write(`${question} `);
    const reader = createInterface({ input: this.input, terminal: false });
    return new Promise((resolve) => {
      let settled = false;
      const finish = (answer: boolean) => {
        if (settled) return;
        settled = true;
        reader.close();
        resolve(answer);
      };
      reader.once("line", (line) => finish(/^y(?:es)?$/i.test(line.trim())));
      reader.once("close", () => finish(false));
    });
  }

  setExitCode(code: number): void { this.setCode(code); }
}

const progressLabels: Record<CapabilityDistributionProgress["stage"], string> = {
  resolving: "Resolving package…",
  downloading: "Downloading package…",
  verifying: "Verifying package…",
  installing: "Installing package…",
  removing: "Removing package…",
};

export function formatPackageProgress(event: CapabilityDistributionProgress): string {
  return `${progressLabels[event.stage]} ${event.status.replaceAll("_", " ")}`;
}
