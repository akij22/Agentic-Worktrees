import { describe, expect, it } from "vitest";
import type { CapabilityManifest } from "@agentic-worktrees/capability-sdk";
import { planCapabilityUpdateConfiguration } from "./capability-update-configuration";
const manifest = (settings: CapabilityManifest["settings"]) =>
  ({ id: "example.search", version: "2.0.0", settings }) as CapabilityManifest;
describe("update configuration planning", () => {
  it("preserves compatible values rather than replacing them with defaults", () => {
    const old = manifest({ limit: { type: "integer", default: 5 } });
    const next = manifest({ limit: { type: "integer", default: 10 } });
    expect(
      planCapabilityUpdateConfiguration(old, next, [{ key: "limit", value: 7 }])
        .settings,
    ).toEqual([{ key: "limit", value: 7 }]);
  });
  it("applies defaults to new keys", () => {
    expect(
      planCapabilityUpdateConfiguration(
        manifest({}),
        manifest({ enabled: { type: "boolean", default: true } }),
        [],
      ).settings,
    ).toEqual([{ key: "enabled", value: true }]);
  });
  it("does not carry values across setting type changes", () => {
    expect(
      planCapabilityUpdateConfiguration(
        manifest({ limit: { type: "integer" } }),
        manifest({ limit: { type: "string", default: "auto" } }),
        [{ key: "limit", value: 7 }],
      ).settings,
    ).toEqual([{ key: "limit", value: "auto" }]);
  });
  it("preserves compatible encrypted references without decrypting", () => {
    const schema = manifest({ key: { type: "secret", required: true } });
    expect(
      planCapabilityUpdateConfiguration(schema, schema, [
        { key: "key", secretRef: "opaque" },
      ]),
    ).toMatchObject({
      configured: true,
      settings: [{ key: "key", secretRef: "opaque" }],
      obsoleteSecretRefs: [],
    });
  });
  it("defers obsolete reference deletion to successful finalization", () => {
    const result = planCapabilityUpdateConfiguration(
      manifest({ key: { type: "secret", required: false } }),
      manifest({}),
      [{ key: "key", secretRef: "opaque" }],
    );
    expect(result.settings).toEqual([]);
    expect(result.obsoleteSecretRefs).toEqual(["opaque"]);
  });
  it("marks a new required secret as needs_setup", () => {
    expect(
      planCapabilityUpdateConfiguration(
        manifest({}),
        manifest({ key: { type: "secret", required: true } }),
        [],
      ).configured,
    ).toBe(false);
  });
  it("marks a new required value without default as needs_setup", () => {
    expect(
      planCapabilityUpdateConfiguration(
        manifest({}),
        manifest({ endpoint: { type: "string", required: true } }),
        [],
      ).configured,
    ).toBe(false);
  });
  it("revalidates narrowed constraints and falls back to new defaults", () => {
    const old = manifest({ limit: { type: "integer" } });
    const next = manifest({
      limit: { type: "integer", min: 1, max: 3, default: 2 },
    });
    expect(
      planCapabilityUpdateConfiguration(old, next, [{ key: "limit", value: 9 }])
        .settings,
    ).toEqual([{ key: "limit", value: 2 }]);
  });
});
