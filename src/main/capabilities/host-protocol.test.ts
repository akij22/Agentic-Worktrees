import { describe, expect, it } from "vitest";
import { mainToHostMessageSchema } from "./host-protocol";

const bundled = (index: number) => ({
  kind: "bundled" as const,
  capabilityId: `test.capability-${index}`,
  version: "1.0.0",
});
const base = {
  type: "host.initialize" as const,
  runId: "run",
  token: "x".repeat(32),
  settings: {},
};

describe("capability host protocol runtime descriptors", () => {
  it("accepts strict main-to-host runtime descriptors", () => {
    expect(
      mainToHostMessageSchema.parse({ ...base, capabilities: [bundled(1)] }),
    ).toMatchObject({ capabilities: [{ kind: "bundled" }] });
  });
  it("rejects unknown descriptor fields", () => {
    expect(() =>
      mainToHostMessageSchema.parse({
        ...base,
        capabilities: [{ ...bundled(1), entry: "/private/file" }],
      }),
    ).toThrow();
  });
  it("rejects more than one hundred descriptors", () => {
    expect(() =>
      mainToHostMessageSchema.parse({
        ...base,
        capabilities: Array.from({ length: 101 }, (_, index) => bundled(index)),
      }),
    ).toThrow();
  });
  it("rejects duplicate capability descriptors", () => {
    expect(() =>
      mainToHostMessageSchema.parse({
        ...base,
        capabilities: [bundled(1), bundled(1)],
      }),
    ).toThrow();
  });
});
