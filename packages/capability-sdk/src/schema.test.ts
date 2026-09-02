import { describe, expect, it } from "vitest";
import { CapabilityError, defineCapability, defineTool, staticDescriptorFromDefinition, validateCapabilityDefinition, validateCapabilityStaticDescriptor } from "./index";

const manifest = {
  id: "example.echo",
  name: "Echo",
  version: "0.1.0",
  sdkVersion: "^0.1.0",
  description: "Echo text",
  category: "utility",
  author: { name: "Test" },
  license: "MIT",
  compatibility: { codex: "supported", opencode: "supported" } as const,
  permissions: { network: [], secrets: [] },
  settings: {},
};

describe("capability schema", () => {
  it("validates stable manifests and JSON Schema tools", () => {
    const definition = defineCapability({ manifest, tools: [defineTool<{ text: string }>({
      name: "echo_text", description: "Echo", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false },
      execute: async ({ text }) => ({ content: [{ type: "text", text }] }),
    })] });
    expect(validateCapabilityDefinition(definition)).toBe(definition);
    expect(() => validateCapabilityDefinition({ ...definition, manifest: { ...manifest, id: "Invalid ID" } })).toThrow("manifest.id");
  });

  it("accepts exact hosts and public-web while rejecting malformed or duplicate network permissions", () => {
    for (const permission of ["public-web", "api.example.com"]) {
      expect(() => validateCapabilityDefinition(defineCapability({ manifest: { ...manifest, permissions: { network: [permission], secrets: [] } }, tools: [] }))).not.toThrow();
    }
    for (const permission of ["https://example.com", "*.example.com", "Example.com", "example.com/path", "public-*", ""]) {
      expect(() => validateCapabilityDefinition(defineCapability({ manifest: { ...manifest, permissions: { network: [permission], secrets: [] } }, tools: [] }))).toThrow("network permission");
    }
    expect(() => validateCapabilityDefinition(defineCapability({ manifest: { ...manifest, permissions: { network: ["example.com", "example.com"], secrets: [] } }, tools: [] }))).toThrow("network permission");
  });

  it("validates and freezes unknown static descriptors", () => {
    const descriptor = {
      manifest,
      tools: [{ name: "echo_text", description: "Echo", inputSchema: { type: "object", properties: {}, additionalProperties: false } }],
    };
    const validated = validateCapabilityStaticDescriptor(descriptor);
    expect(validated).toMatchObject({ manifest: { id: "example.echo" }, tools: [{ name: "echo_text" }] });
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(validated.tools[0]?.inputSchema)).toBe(true);
    expect(() => validateCapabilityStaticDescriptor({ manifest: null, tools: [] })).toThrow(CapabilityError);
    expect(() => validateCapabilityStaticDescriptor({ ...descriptor, extra: true })).toThrow("Unknown descriptor");
    expect(() => validateCapabilityStaticDescriptor({ ...descriptor, tools: [{ ...descriptor.tools[0], name: "Bad Tool" }] })).toThrow("Invalid tool name");
    expect(() => validateCapabilityStaticDescriptor({ ...descriptor, tools: [descriptor.tools[0], descriptor.tools[0]] })).toThrow("Duplicate tool");
    expect(() => validateCapabilityStaticDescriptor({ ...descriptor, tools: Array.from({ length: 101 }, (_, index) => ({ ...descriptor.tools[0], name: `tool_${index}` })) })).toThrow("Invalid capability tools");
  });

  it("projects executable definitions through the static validator", () => {
    const definition = defineCapability({ manifest, tools: [defineTool({ name: "echo_text", description: "Echo", inputSchema: { type: "object" }, execute: async () => ({ content: [] }) })] });
    expect(staticDescriptorFromDefinition(definition)).toEqual({ manifest, tools: [{ name: "echo_text", description: "Echo", inputSchema: { type: "object" } }] });
  });

  it("rejects duplicate names, invalid schemas, compatibility, and undeclared secrets", () => {
    const tool = defineTool({ name: "echo_text", description: "Echo", inputSchema: { type: "object" }, execute: async () => ({ content: [] }) });
    expect(() => validateCapabilityDefinition(defineCapability({ manifest, tools: [tool, tool] }))).toThrow("Duplicate");
    expect(() => validateCapabilityDefinition(defineCapability({ manifest, tools: [{ ...tool, inputSchema: { type: "unknown" } }] }))).toThrow("JSON Schema");
    expect(() => validateCapabilityDefinition(defineCapability({ manifest: { ...manifest, compatibility: { codex: "maybe", opencode: "supported" } } as never, tools: [] }))).toThrow("compatibility.codex");
    expect(() => validateCapabilityDefinition(defineCapability({ manifest: { ...manifest, settings: { token: { type: "secret", required: false } } }, tools: [] }))).toThrow("not declared");
  });
});
