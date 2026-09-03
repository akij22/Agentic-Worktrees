import { createHash } from "node:crypto";
import { open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import semver from "semver";
import { validateCapabilityStaticDescriptor, type CapabilityStaticDescriptor } from "@agentic-worktrees/capability-sdk";
import type { StagedNpmPackage } from "../packages/npm-acquirer";
import type { OfficialCatalogEntry } from "../packages/catalog/official-catalog";
import type { PackageReviewStatus, PackageTrust } from "../../shared/packages/schemas";
import { listBundledCapabilities } from "./catalog";

const MAX_METADATA_BYTES = 256 * 1024;
const LIFECYCLE_SCRIPTS = ["preinstall", "install", "postinstall", "prepare"];

export interface InspectedCapabilityPackage {
  staged: StagedNpmPackage;
  packageMetadata: { kind: "capability"; manifest: string; entry: string };
  descriptor: CapabilityStaticDescriptor;
  permissionDigest: string;
  trust: PackageTrust;
  reviewStatus: PackageReviewStatus;
}
export interface CapabilityPackageInspectionOptions { trust: PackageTrust; reviewStatus: PackageReviewStatus; officialEntry?: OfficialCatalogEntry }
export interface CapabilityPackageInspectorOptions { sdkVersion?: string; appVersion?: string; reservedCapabilityIds?: readonly string[] }

function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function safeRelativePath(value: unknown, label: string): string {
  if (typeof value !== "string" || !value || isAbsolute(value) || value.includes("\0")) throw new Error(`Invalid capability ${label} path`);
  const normalized = value.replace(/\\/g, "/");
  if (normalized.split("/").includes("..")) throw new Error(`Invalid capability ${label} path`);
  return normalized.startsWith("./") ? normalized : `./${normalized}`;
}
async function readBoundedJson(root: string, relativePath: string): Promise<unknown> {
  const rootReal = await realpath(root); const path = resolve(rootReal, relativePath); const rel = relative(rootReal, path);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("Capability metadata path escapes package root");
  const handle = await open(path, "r").catch(() => { throw new Error("Capability metadata is missing"); });
  try { const stat = await handle.stat(); if (!stat.isFile() || stat.nlink !== 1 || stat.size > MAX_METADATA_BYTES) throw new Error("Capability metadata is invalid or too large"); return JSON.parse((await handle.readFile()).toString("utf8")); }
  finally { await handle.close(); }
}
function digest(descriptor: CapabilityStaticDescriptor): string { return createHash("sha256").update(JSON.stringify({ permissions: descriptor.manifest.permissions, version: descriptor.manifest.version })).digest("hex"); }

export class CapabilityPackageInspector {
  private readonly sdkVersion: string; private readonly appVersion: string; private readonly reservedIds: Set<string>;
  constructor(options: CapabilityPackageInspectorOptions = {}) { this.sdkVersion = options.sdkVersion ?? "0.1.0"; this.appVersion = options.appVersion ?? "1.0.0"; this.reservedIds = new Set(options.reservedCapabilityIds ?? listBundledCapabilities().map(item => item.manifest.id)); }
  async inspect(staged: StagedNpmPackage, options: CapabilityPackageInspectionOptions): Promise<InspectedCapabilityPackage> {
    const pkg = staged.packageJson;
    if (!object(pkg) || pkg.name !== staged.packageName || pkg.version !== staged.resolvedVersion || !object(pkg.agenticWorktrees) || pkg.agenticWorktrees.kind !== "capability") throw new Error("Invalid capability package metadata");
    const manifest = safeRelativePath(pkg.agenticWorktrees.manifest, "manifest"), entry = safeRelativePath(pkg.agenticWorktrees.entry, "entry");
    const scripts = pkg.scripts;
    if (object(scripts) && LIFECYCLE_SCRIPTS.some(name => typeof scripts[name] === "string")) throw new Error("Capability package lifecycle scripts are not allowed");
    const descriptor = validateCapabilityStaticDescriptor(await readBoundedJson(staged.packageRoot, manifest));
    if (descriptor.manifest.version !== staged.resolvedVersion) throw new Error("Capability version does not match package version");
    if (this.reservedIds.has(descriptor.manifest.id)) throw new Error("Capability ID collides with a bundled capability");
    if (!semver.validRange(descriptor.manifest.sdkVersion) || !semver.satisfies(this.sdkVersion, descriptor.manifest.sdkVersion)) throw new Error("Unsupported Capability SDK version");
    if (options.trust === "official") {
      const official = options.officialEntry;
      if (!official || options.reviewStatus !== "official-reviewed" || official.packageName !== staged.packageName || official.releaseSpec !== staged.resolvedVersion || official.capabilityId !== descriptor.manifest.id || !semver.satisfies(this.appVersion, `>=${official.minimumAppVersion}`) || !isDeepStrictEqual(official.descriptor, descriptor)) throw new Error("Official package identity mismatch");
    } else if (options.reviewStatus !== "unreviewed" || options.officialEntry) throw new Error("Package trust metadata mismatch");
    return { staged, packageMetadata: { kind: "capability", manifest, entry }, descriptor, permissionDigest: digest(descriptor), trust: options.trust, reviewStatus: options.reviewStatus };
  }
}
