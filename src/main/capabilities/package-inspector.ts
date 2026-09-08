import { isAbsolute, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import semver from "semver";
import { validateCapabilityStaticDescriptor, type CapabilityStaticDescriptor } from "@agentic-worktrees/capability-sdk";
import type { StagedNpmPackage } from "../packages/npm-acquirer";
import type { OfficialCatalogEntry } from "../packages/catalog/official-catalog";
import type { PackageReviewStatus, PackageTrust } from "../../shared/packages/schemas";
import { listBundledCapabilities, permissionDigest } from "./catalog";
import { readContainedJson } from "../packages/bounded-file-reader";

export const MAX_CAPABILITY_METADATA_BYTES = 256 * 1024;
const LIFECYCLE_SCRIPTS = ["preinstall", "install", "postinstall", "prepare"] as const;
const INVALID_METADATA = "Invalid capability package metadata";

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

function fail(message = INVALID_METADATA): never { throw new Error(message); }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function safeRelativePath(value: unknown, label: string): string {
  if (typeof value !== "string" || !value || isAbsolute(value) || value.includes("\0")) fail(`Invalid capability ${label} path`);
  const normalized = value.replace(/\\/g, "/");
  if (normalized.split("/").includes("..")) fail(`Invalid capability ${label} path`);
  return normalized.startsWith("./") ? normalized : `./${normalized}`;
}
async function readBoundedJson(root: string, relativePath: string): Promise<unknown> {
  try { return await readContainedJson(root, resolve(root, relativePath), MAX_CAPABILITY_METADATA_BYTES); } catch { return fail(); }
}

export class CapabilityPackageInspector {
  private readonly sdkVersion: string; private readonly appVersion: string; private readonly reservedIds: Set<string>;
  constructor(options: CapabilityPackageInspectorOptions = {}) { this.sdkVersion = options.sdkVersion ?? "0.1.0"; this.appVersion = options.appVersion ?? "1.0.0"; this.reservedIds = new Set(options.reservedCapabilityIds ?? listBundledCapabilities().map(item => item.manifest.id)); }
  async inspect(staged: StagedNpmPackage, options: CapabilityPackageInspectionOptions): Promise<InspectedCapabilityPackage> {
    const pkg = await readBoundedJson(staged.packageRoot, "./package.json");
    if (!object(pkg) || pkg.name !== staged.packageName || pkg.version !== staged.resolvedVersion || !object(pkg.agenticWorktrees) || pkg.agenticWorktrees.kind !== "capability") fail();
    const manifest = safeRelativePath(pkg.agenticWorktrees.manifest, "manifest"), entry = safeRelativePath(pkg.agenticWorktrees.entry, "entry");
    const scripts = pkg.scripts;
    if (object(scripts) && LIFECYCLE_SCRIPTS.some(name => name in scripts)) fail("Capability package lifecycle scripts are not allowed");
    let descriptor: CapabilityStaticDescriptor;
    try { descriptor = validateCapabilityStaticDescriptor(await readBoundedJson(staged.packageRoot, manifest)); } catch { return fail("Invalid capability descriptor"); }
    if (descriptor.manifest.version !== staged.resolvedVersion) fail("Capability version does not match package version");
    if (this.reservedIds.has(descriptor.manifest.id)) fail("Capability ID collides with a bundled capability");
    if (!semver.validRange(descriptor.manifest.sdkVersion) || !semver.satisfies(this.sdkVersion, descriptor.manifest.sdkVersion)) fail("Unsupported Capability SDK version");
    if (options.trust === "official") {
      const official = options.officialEntry;
      if (!official || options.reviewStatus !== "official-reviewed" || official.packageName !== staged.packageName || official.releaseSpec !== staged.resolvedVersion || official.capabilityId !== descriptor.manifest.id || !semver.satisfies(this.appVersion, `>=${official.minimumAppVersion}`) || !isDeepStrictEqual(official.descriptor, descriptor)) fail("Official package identity mismatch");
    } else if (options.reviewStatus !== "unreviewed" || options.officialEntry) fail("Package trust metadata mismatch");
    return { staged, packageMetadata: { kind: "capability", manifest, entry }, descriptor, permissionDigest: permissionDigest(descriptor.manifest), trust: options.trust, reviewStatus: options.reviewStatus };
  }
}
