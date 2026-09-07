import { describe, expect, it } from "vitest";
import {
  encodeCommandFrame,
  MAX_COMMAND_LINE_BYTES,
  NdjsonFrameDecoder,
} from "./command-protocol";

const request = {
  schemaVersion: 1 as const,
  requestId: "request_1",
  type: "request" as const,
  token: "a".repeat(64),
  command: { kind: "list" as const },
};
describe("command protocol", () => {
  it("decodes fragmented strict NDJSON", () => {
    const encoded = encodeCommandFrame(request);
    const decoder = new NdjsonFrameDecoder();
    expect(decoder.push(encoded.subarray(0, 5))).toEqual([]);
    expect(decoder.push(encoded.subarray(5))).toEqual([request]);
  });
  it("rejects malformed and unknown fields", () => {
    expect(() => new NdjsonFrameDecoder().push("not-json\n")).toThrow(
      "malformed_frame",
    );
    expect(() =>
      new NdjsonFrameDecoder().push(
        `${JSON.stringify({ ...request, extra: true })}\n`,
      ),
    ).toThrow("malformed_frame");
  });
  it("enforces the one MiB line bound", () => {
    expect(() =>
      new NdjsonFrameDecoder().push(
        Buffer.alloc(MAX_COMMAND_LINE_BYTES + 1, 97),
      ),
    ).toThrow("frame_too_large");
  });
  it("rejects incomplete final frames", () => {
    const decoder = new NdjsonFrameDecoder();
    decoder.push("{}");
    expect(() => decoder.end()).toThrow("incomplete_frame");
  });
});
