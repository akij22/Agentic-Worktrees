import AjvConstructor from "ajv";
import { CapabilityError } from "./errors";
import type {
  CapabilityDefinition,
  CapabilityManifest,
  CapabilitySetting,
  CapabilityStaticDescriptor,
  CapabilityStaticTool,
  CapabilityTool,
} from "./types";

const CAPABILITY_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const TOOL_NAME = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
export const PUBLIC_WEB_NETWORK_PERMISSION = "public-web" as const;
const NETWORK_HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const ajv = new AjvConstructor({ strict: true, allErrors: true });

function invalid(message: string): never {
  throw new CapabilityError("invalid_input", message);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid(`Invalid ${label}.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid(`Invalid ${label}.`);
  return value as Record<string, unknown>;
}

function assertJsonValue(value: unknown, label: string, ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) invalid(`Invalid ${label}: expected a finite JSON number.`);
    return;
  }
  if (typeof value !== "object") invalid(`Invalid ${label}: expected JSON data.`);
  if (ancestors.has(value)) invalid(`Invalid ${label}: cyclic JSON data is not allowed.`);

  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) invalid(`Invalid ${label}: expected a plain JSON object.`);

  ancestors.add(value);
  for (const child of Array.isArray(value) ? value : Object.values(value)) assertJsonValue(child, label, ancestors);
  ancestors.delete(value);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) invalid(`Unknown ${label} property.`);
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) invalid(`Invalid ${label}.`);
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function validateSetting(value: unknown, label: string): CapabilitySetting {
  const setting = record(value, label);
  const type = setting.type;
  if (type === "secret") {
    exactKeys(setting, ["type", "required"], label);
    if (typeof setting.required !== "boolean") invalid(`Invalid ${label}.required.`);
  } else if (type === "string") {
    exactKeys(setting, ["type", "enum", "default", "required"], label);
    if (setting.enum !== undefined && (!Array.isArray(setting.enum) || setting.enum.some((item) => typeof item !== "string"))) invalid(`Invalid ${label}.enum.`);
    if (setting.default !== undefined && typeof setting.default !== "string") invalid(`Invalid ${label}.default.`);
    if (setting.required !== undefined && typeof setting.required !== "boolean") invalid(`Invalid ${label}.required.`);
  } else if (type === "integer") {
    exactKeys(setting, ["type", "default", "min", "max", "required"], label);
    for (const key of ["default", "min", "max"] as const) if (setting[key] !== undefined && !Number.isInteger(setting[key])) invalid(`Invalid ${label}.${key}.`);
    if (setting.required !== undefined && typeof setting.required !== "boolean") invalid(`Invalid ${label}.required.`);
  } else if (type === "boolean") {
    exactKeys(setting, ["type", "default", "required"], label);
    if (setting.default !== undefined && typeof setting.default !== "boolean") invalid(`Invalid ${label}.default.`);
    if (setting.required !== undefined && typeof setting.required !== "boolean") invalid(`Invalid ${label}.required.`);
  } else invalid(`Invalid ${label}.type.`);
  return setting as unknown as CapabilitySetting;
}

export function validateCapabilityManifest(value: unknown): CapabilityManifest {
  const manifest = record(value, "capability manifest");
  exactKeys(manifest, ["id", "name", "version", "sdkVersion", "description", "category", "author", "license", "compatibility", "provenance", "permissions", "settings"], "manifest");
  if (!CAPABILITY_ID.test(string(manifest.id, "manifest.id"))) invalid("Invalid manifest.id.");
  for (const key of ["name", "version", "sdkVersion", "description", "category", "license"] as const) string(manifest[key], `manifest.${key}`);

  const author = record(manifest.author, "manifest.author");
  exactKeys(author, ["name", "url"], "manifest.author");
  string(author.name, "manifest.author.name");
  if (author.url !== undefined) string(author.url, "manifest.author.url");

  const compatibility = record(manifest.compatibility, "manifest.compatibility");
  exactKeys(compatibility, ["codex", "opencode"], "manifest.compatibility");
  for (const kind of ["codex", "opencode"] as const) if (compatibility[kind] !== "supported" && compatibility[kind] !== "unsupported") invalid(`Invalid manifest.compatibility.${kind}.`);

  if (manifest.provenance !== undefined) {
    const provenance = record(manifest.provenance, "manifest.provenance");
    exactKeys(provenance, ["kind", "source", "package", "sourceVersion", "repository"], "manifest.provenance");
    for (const key of ["kind", "source", "package", "sourceVersion", "repository"] as const) string(provenance[key], `manifest.provenance.${key}`);
  }

  const permissions = record(manifest.permissions, "manifest.permissions");
  exactKeys(permissions, ["network", "secrets"], "manifest.permissions");
  if (!Array.isArray(permissions.network) || !Array.isArray(permissions.secrets) || permissions.secrets.some((item) => typeof item !== "string")) invalid("Invalid manifest.permissions.");
  const networkPermissions = new Set<string>();
  for (const permission of permissions.network) {
    if (typeof permission !== "string" || (permission !== PUBLIC_WEB_NETWORK_PERMISSION && !NETWORK_HOST.test(permission)) || networkPermissions.has(permission)) invalid("Invalid or duplicate network permission.");
    networkPermissions.add(permission);
  }
  if (new Set(permissions.secrets).size !== permissions.secrets.length) invalid("Invalid or duplicate secret permission.");

  const settings = record(manifest.settings, "manifest.settings");
  const secretSettings = Object.entries(settings).filter(([, setting]) => validateSetting(setting, "manifest setting").type === "secret").map(([key]) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`));
  if (secretSettings.some((secret) => !(permissions.secrets as string[]).includes(secret))) throw new CapabilityError("permission_denied", "A secret setting is not declared in permissions.");
  return deepFreeze(structuredClone(manifest)) as unknown as CapabilityManifest;
}

function validateStaticTool(value: unknown): CapabilityStaticTool {
  const tool = record(value, "tool");
  exactKeys(tool, ["name", "description", "inputSchema"], "tool");
  if (!TOOL_NAME.test(string(tool.name, "tool name"))) invalid("Invalid tool name.");
  string(tool.description, "tool description");
  assertJsonValue(tool.inputSchema, "tool input JSON Schema");
  const schema = record(tool.inputSchema, "tool input JSON Schema");
  try { ajv.compile(schema); } catch { invalid("Invalid tool input JSON Schema."); }
  return tool as unknown as CapabilityStaticTool;
}

export function validateCapabilityStaticDescriptor(value: unknown): CapabilityStaticDescriptor {
  const descriptor = record(value, "capability descriptor");
  exactKeys(descriptor, ["manifest", "tools"], "descriptor");
  const manifest = validateCapabilityManifest(descriptor.manifest);
  if (!Array.isArray(descriptor.tools) || descriptor.tools.length > 100) invalid("Invalid capability tools.");
  const tools = descriptor.tools.map(validateStaticTool);
  const names = new Set<string>();
  for (const tool of tools) {
    if (names.has(tool.name)) invalid("Duplicate tool name.");
    names.add(tool.name);
  }
  return deepFreeze(structuredClone({ manifest, tools }));
}

export function staticDescriptorFromDefinition(definition: CapabilityDefinition): CapabilityStaticDescriptor {
  return validateCapabilityStaticDescriptor({
    manifest: definition.manifest,
    tools: definition.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
  });
}

export function defineTool<Input>(tool: CapabilityTool<Input>): CapabilityTool<Input> { return Object.freeze(tool); }

export function defineCapability(definition: { manifest: CapabilityDefinition["manifest"]; tools: readonly CapabilityTool<unknown>[] }): CapabilityDefinition {
  return Object.freeze({ manifest: Object.freeze(definition.manifest), tools: Object.freeze([...definition.tools]) });
}

export function validateCapabilityDefinition(definition: CapabilityDefinition): CapabilityDefinition {
  staticDescriptorFromDefinition(definition);
  return definition;
}
