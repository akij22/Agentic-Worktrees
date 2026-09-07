import { z } from "zod";
import { packageCliCommandSchema, type PackageCliCommand } from "./arguments";

export const COMMAND_PROTOCOL_VERSION = 1 as const;
export const MAX_COMMAND_LINE_BYTES = 1024 * 1024;
const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const token = z.string().regex(/^[a-f0-9]{64}$/);
const base = {
  schemaVersion: z.literal(COMMAND_PROTOCOL_VERSION),
  requestId: id,
};
export const commandRequestSchema = z.strictObject({
  ...base,
  type: z.literal("request"),
  token,
  command: packageCliCommandSchema,
});
export const commandReviewSchema = z.strictObject({
  ...base,
  type: z.literal("review"),
  question: z.string().max(8192),
});
export const commandReviewResponseSchema = z.strictObject({
  ...base,
  type: z.literal("review-response"),
  accepted: z.boolean(),
});
export const commandProgressSchema = z.strictObject({
  ...base,
  type: z.literal("progress"),
  message: z.string().max(8192),
});
export const commandResultSchema = z.strictObject({
  ...base,
  type: z.literal("result"),
  exitCode: z.number().int().min(0).max(255),
});
export const commandErrorSchema = z.strictObject({
  ...base,
  type: z.literal("error"),
  code: z.enum([
    "invalid_request",
    "authentication_failed",
    "command_failed",
    "disconnected",
  ]),
});
export const commandFrameSchema = z.discriminatedUnion("type", [
  commandRequestSchema,
  commandReviewSchema,
  commandReviewResponseSchema,
  commandProgressSchema,
  commandResultSchema,
  commandErrorSchema,
]);
export type CommandFrame = z.infer<typeof commandFrameSchema>;
export type CommandRequest = z.infer<typeof commandRequestSchema>;

export function encodeCommandFrame(frame: CommandFrame): Buffer {
  return Buffer.from(
    `${JSON.stringify(commandFrameSchema.parse(frame))}\n`,
    "utf8",
  );
}

export class NdjsonFrameDecoder {
  private pending = Buffer.alloc(0);
  push(chunk: Buffer | string): CommandFrame[] {
    this.pending = Buffer.concat([
      this.pending,
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
    ]);
    if (
      this.pending.length > MAX_COMMAND_LINE_BYTES &&
      !this.pending.includes(10)
    )
      throw new Error("frame_too_large");
    const frames: CommandFrame[] = [];
    for (;;) {
      const newline = this.pending.indexOf(10);
      if (newline < 0) break;
      if (newline > MAX_COMMAND_LINE_BYTES) throw new Error("frame_too_large");
      const line = this.pending.subarray(0, newline);
      this.pending = this.pending.subarray(newline + 1);
      if (!line.length) throw new Error("malformed_frame");
      let value: unknown;
      try {
        value = JSON.parse(line.toString("utf8"));
      } catch {
        throw new Error("malformed_frame");
      }
      const parsed = commandFrameSchema.safeParse(value);
      if (!parsed.success) throw new Error("malformed_frame");
      frames.push(parsed.data);
    }
    return frames;
  }
  end(): void {
    if (this.pending.length) throw new Error("incomplete_frame");
  }
}

export interface ForwardingData {
  schemaVersion: 1;
  requestId: string;
  endpoint: string;
  token: string;
  command: PackageCliCommand;
}
export const forwardingDataSchema = z.strictObject({
  schemaVersion: z.literal(1),
  requestId: id,
  endpoint: z.string().min(1).max(4096),
  token,
  command: packageCliCommandSchema,
});
