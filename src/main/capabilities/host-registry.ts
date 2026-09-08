import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  CapabilityError,
  staticDescriptorFromDefinition,
  validateCapabilityDefinition,
  validateCapabilityStaticDescriptor,
  type CapabilityDefinition,
} from "@agentic-worktrees/capability-sdk";
// capability-kit:host-imports:start
import urlFetchCapability from "@agentic-worktrees/url-fetch-capability";
// capability-kit:host-imports:end
import { readContainedJson } from "../packages/bounded-file-reader";
import { digestPackageTree } from "../packages/content-digest";
import type { CapabilityRuntimeDescriptor } from "./catalog";

const hostedCapabilities = [
  // capability-kit:host-entries:start
  urlFetchCapability,
  // capability-kit:host-entries:end
] as const;
const bundled = new Map<string, CapabilityDefinition>(
  hostedCapabilities.map((capability) => [capability.manifest.id, capability]),
);
const cache = new Map<string, Promise<CapabilityDefinition>>();
const fail = () =>
  new CapabilityError("invalid_input", "Invalid managed capability.");
const contained = (root: string, candidate: string) => {
  const rel = relative(root, candidate);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
};

async function assertManagedDescriptor(
  descriptor: Extract<CapabilityRuntimeDescriptor, { kind: "managed" }>,
): Promise<void> {
  const root = await realpath(descriptor.packageRoot).catch(() => {
    throw fail();
  });
  const manifestPath = resolve(root, descriptor.manifest);
  const entryPath = resolve(root, descriptor.entry);
  if (
    root !== resolve(descriptor.packageRoot) ||
    !contained(root, manifestPath) ||
    !contained(root, entryPath) ||
    (await digestPackageTree(root)) !== descriptor.contentDigest
  )
    throw fail();
}

async function loadManaged(
  descriptor: Extract<CapabilityRuntimeDescriptor, { kind: "managed" }>,
): Promise<CapabilityDefinition> {
  const root = await realpath(descriptor.packageRoot).catch(() => {
    throw fail();
  });
  if (root !== resolve(descriptor.packageRoot)) throw fail();
  const manifestPath = resolve(root, descriptor.manifest);
  const entryPath = resolve(root, descriptor.entry);
  if (!contained(root, manifestPath) || !contained(root, entryPath))
    throw fail();
  const [manifestReal, entryReal] = await Promise.all([
    realpath(manifestPath),
    realpath(entryPath),
  ]).catch(() => {
    throw fail();
  });
  if (manifestReal !== manifestPath || entryReal !== entryPath) throw fail();
  if ((await digestPackageTree(root)) !== descriptor.contentDigest)
    throw fail();
  const staticDescriptor = validateCapabilityStaticDescriptor(
    await readContainedJson(root, manifestPath, 256 * 1024),
  );
  if (
    staticDescriptor.manifest.id !== descriptor.capabilityId ||
    staticDescriptor.manifest.version !== descriptor.version
  )
    throw fail();
  const imported = (await import(pathToFileURL(entryPath).href)) as {
    default?: CapabilityDefinition;
  };
  const definition = validateCapabilityDefinition(
    imported.default as CapabilityDefinition,
  );
  const runtimeStatic = staticDescriptorFromDefinition(definition);
  if (JSON.stringify(runtimeStatic) !== JSON.stringify(staticDescriptor))
    throw fail();
  if ((await digestPackageTree(root)) !== descriptor.contentDigest)
    throw fail();
  return definition;
}

export async function getHostedCapability(
  descriptor: CapabilityRuntimeDescriptor,
): Promise<CapabilityDefinition | undefined> {
  if (descriptor.kind === "bundled") {
    const found = bundled.get(descriptor.capabilityId);
    return found?.manifest.version === descriptor.version ? found : undefined;
  }
  await assertManagedDescriptor(descriptor);
  const key = `${descriptor.capabilityId}\0${descriptor.version}\0${descriptor.contentDigest}`;
  let loaded = cache.get(key);
  if (!loaded) {
    loaded = loadManaged(descriptor);
    cache.set(key, loaded);
    void loaded.catch(() => cache.delete(key));
  }
  return loaded;
}
export function listHostedCapabilityIds(): readonly string[] {
  return Object.freeze([...bundled.keys()]);
}
