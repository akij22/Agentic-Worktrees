import { randomBytes, randomUUID } from "node:crypto";
import {
  createServer,
  createConnection,
  type Server,
  type Socket,
} from "node:net";
import { unlink } from "node:fs/promises";
import path from "node:path";
import type { PackageCliCommand } from "./arguments";
import type { CliTerminal } from "./terminal-ui";
import {
  commandRequestSchema,
  encodeCommandFrame,
  forwardingDataSchema,
  NdjsonFrameDecoder,
  type CommandFrame,
  type ForwardingData,
} from "./command-protocol";

export type CommandExecutor = (
  command: PackageCliCommand,
  terminal: CliTerminal,
  signal: AbortSignal,
) => Promise<void>;
export interface NetAdapter {
  createServer(listener: (socket: Socket) => void): Server;
  connect(endpoint: string): Socket;
}
const nodeNet: NetAdapter = {
  createServer,
  connect: (endpoint) => createConnection(endpoint),
};
const safeUnlink = async (endpoint: string) => {
  if (process.platform !== "win32")
    await unlink(endpoint).catch(() => undefined);
};
const endpointFor = (temp: string, requestId: string) =>
  process.platform === "win32"
    ? `\\\\.\\pipe\\agentic-worktrees-${requestId}`
    : path.join(temp, `aw-${requestId.slice(0, 8)}.sock`);

export interface ReplyEndpoint {
  data: ForwardingData;
  wait(): Promise<number>;
  close(): Promise<void>;
}
export async function createReplyEndpoint(input: {
  tempPath: string;
  command: PackageCliCommand;
  terminal: CliTerminal;
  net?: NetAdapter;
  timeoutMs?: number;
}): Promise<ReplyEndpoint> {
  const net = input.net ?? nodeNet;
  const requestId = randomUUID().replaceAll("-", "");
  const data: ForwardingData = {
    schemaVersion: 1,
    requestId,
    endpoint: endpointFor(input.tempPath, requestId),
    token: randomBytes(32).toString("hex"),
    command: input.command,
  };
  let socket: Socket | undefined;
  let settled = false;
  let resolveResult!: (code: number) => void;
  const result = new Promise<number>((resolve) => {
    resolveResult = resolve;
  });
  const timeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    input.terminal.writeLine("Package operation failed.");
    input.terminal.setExitCode(1);
    resolveResult(1);
  }, input.timeoutMs ?? 30_000);
  timeout.unref?.();
  const server = net.createServer((candidate) => {
    if (socket) {
      candidate.destroy();
      return;
    }
    socket = candidate;
    const decoder = new NdjsonFrameDecoder();
    let authenticated = false;
    candidate.on("data", (chunk) => {
      try {
        for (const frame of decoder.push(chunk)) {
          if (!authenticated) {
            const request = commandRequestSchema.safeParse(frame);
            if (
              !request.success ||
              request.data.token !== data.token ||
              request.data.requestId !== data.requestId
            ) {
              candidate.destroy();
              continue;
            }
            authenticated = true;
            continue;
          }
          if (frame.requestId !== data.requestId) {
            candidate.destroy();
            continue;
          }
          if (frame.type === "progress")
            input.terminal.writeLine(frame.message);
          else if (frame.type === "review")
            void input.terminal.confirm(frame.question).then((accepted) =>
              candidate.write(
                encodeCommandFrame({
                  schemaVersion: 1,
                  requestId,
                  type: "review-response",
                  accepted,
                }),
              ),
            );
          else if (frame.type === "result") {
            input.terminal.setExitCode(frame.exitCode);
            settled = true;
            clearTimeout(timeout);
            resolveResult(frame.exitCode);
          } else if (frame.type === "error") {
            input.terminal.writeLine("Package operation failed.");
            input.terminal.setExitCode(1);
            settled = true;
            clearTimeout(timeout);
            resolveResult(1);
          }
        }
      } catch {
        candidate.destroy();
      }
    });
    candidate.on("close", () => {
      if (!settled) {
        input.terminal.writeLine("Package operation failed.");
        input.terminal.setExitCode(1);
        settled = true;
        clearTimeout(timeout);
        resolveResult(1);
      }
    });
  });
  await safeUnlink(data.endpoint);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(data.endpoint, resolve);
    });
  } catch {
    server.close();
    await safeUnlink(data.endpoint);
    throw new Error("reply_endpoint_unavailable");
  }
  const close = async () => {
    clearTimeout(timeout);
    socket?.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await safeUnlink(data.endpoint);
  };
  return { data, wait: () => result, close };
}

export function createCommandExecutionQueue(
  execute: CommandExecutor,
): CommandExecutor {
  let tail = Promise.resolve();
  return (command, terminal, signal) => {
    const task = tail.then(() => execute(command, terminal, signal));
    tail = task.catch(() => undefined);
    return task;
  };
}

export const isForwardingEndpointAllowed = (
  endpoint: string,
  tempPath: string,
  platform: NodeJS.Platform = process.platform,
): boolean => {
  if (platform === "win32")
    return (
      endpoint.startsWith("\\\\.\\pipe\\agentic-worktrees-") &&
      /^[a-f0-9]{32}$/.test(
        endpoint.slice("\\\\.\\pipe\\agentic-worktrees-".length),
      )
    );
  return (
    path.dirname(endpoint) === path.resolve(tempPath) &&
    /^aw-[a-f0-9]{8}\.sock$/.test(path.basename(endpoint))
  );
};

export async function executeForwardedCommand(
  raw: unknown,
  execute: CommandExecutor,
  tempPath: string,
  net: NetAdapter = nodeNet,
): Promise<boolean> {
  const parsed = forwardingDataSchema.safeParse(raw);
  if (
    !parsed.success ||
    !isForwardingEndpointAllowed(parsed.data.endpoint, tempPath)
  )
    return false;
  const data = parsed.data;
  const socket = net.connect(data.endpoint);
  const decoder = new NdjsonFrameDecoder();
  const abort = new AbortController();
  const send = (frame: CommandFrame) => socket.write(encodeCommandFrame(frame));
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });
  } catch {
    socket.destroy();
    return false;
  }
  send({
    schemaVersion: 1,
    requestId: data.requestId,
    type: "request",
    token: data.token,
    command: data.command,
  });
  const responses: Array<(accepted: boolean) => void> = [];
  socket.on("data", (chunk) => {
    try {
      for (const frame of decoder.push(chunk))
        if (
          frame.requestId === data.requestId &&
          frame.type === "review-response"
        )
          responses.shift()?.(frame.accepted);
    } catch {
      abort.abort();
      socket.destroy();
    }
  });
  socket.once("close", () => abort.abort());
  let exitCode = 0;
  const terminal: CliTerminal = {
    writeLine: (message) => {
      send({
        schemaVersion: 1,
        requestId: data.requestId,
        type: "progress",
        message: message.replace(/[\r\n]+/g, " "),
      });
    },
    confirm: (question) =>
      new Promise<boolean>((resolve) => {
        responses.push(resolve);
        send({
          schemaVersion: 1,
          requestId: data.requestId,
          type: "review",
          question,
        });
      }),
    setExitCode: (code) => {
      exitCode = code;
    },
  };
  try {
    await execute(data.command, terminal, abort.signal);
    if (!abort.signal.aborted)
      send({
        schemaVersion: 1,
        requestId: data.requestId,
        type: "result",
        exitCode,
      });
  } catch {
    if (!abort.signal.aborted)
      send({
        schemaVersion: 1,
        requestId: data.requestId,
        type: "error",
        code: "command_failed",
      });
  } finally {
    socket.end();
  }
  return true;
}
