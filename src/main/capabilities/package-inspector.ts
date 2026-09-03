import { createHash } from "node:crypto";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import semver from "semver";
import { validateCapabilityStaticDescriptor, type CapabilityStaticDescriptor } from "@agentic-worktrees/capability-sdk";
import type { StagedNpmPackage } from "../packages/npm-acquirer";
import type { OfficialCatalogEntry } from "../packages/catalog/official-catalog";
import type { PackageReviewStatus, PackageTrust } from "../../shared/packages/schemas";
import { listBundledCapabilities } from "./catalog";

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
function contained(root: string, candidate: string): boolean { const rel = relative(root, candidate); return !!rel && !rel.startsWith("..") && !isAbsolute(rel); }
function safeRelativePath(value: unknown, label: string): string {
  if (typeof value !== "string" || !value || isAbsolute(value) || value.includes("\0")) fail(`Invalid capability ${label} path`);
  const normalized = value.replace(/\\/g, "/");
  if (normalized.split("/").includes("..")) fail(`Invalid capability ${label} path`);
  return normalized.startsWith("./") ? normalized : `./${normalized}`;
}
function sameFile(left: Awaited<ReturnType<typeof lstat>>, right: Awaited<ReturnType<typeof lstat>>): boolean {
  return left.isFile() && right.isFile() && left.dev === right.dev && left.ino === right.ino && left.mode === right.mode && left.size === right.size && left.mtimeMs === right.mtimeMs;
}
async function readBoundedJson(root: string, relativePath: string): Promise<unknown> {
  try {
    const rootReal = await realpath(root);
    const lexicalPath = resolve(root, relativePath);
    if (!contained(resolve(root), lexicalPath)) fail();
    const beforePath = await lstat(lexicalPath);
    if (!beforePath.isFile() || beforePath.isSymbolicLink()) fail();
    const pathReal = await realpath(lexicalPath);
    if (!contained(rootReal, pathReal)) fail();
    const handle = await open(lexicalPath, "r");
    try {
      const beforeHandle = await handle.stat();
      if (!sameFile(beforePath, beforeHandle) || beforeHandle.size > MAX_CAPABILITY_METADATA_BYTES) fail();
      const buffer = Buffer.alloc(MAX_CAPABILITY_METADATA_BYTES + 1);
      let offset = 0;
      while (offset < buffer.length) {
        const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
        if (!bytesRead) break;
        offset += bytesRead;
      }
      if (offset > MAX_CAPABILITY_METADATA_BYTES) fail();
      const afterHandle = await handle.stat();
      const afterPath = await lstat(lexicalPath);
      const afterReal = await realpath(lexicalPath);
      if (afterReal !== pathReal || !sameFile(beforeHandle, afterHandle) || !sameFile(beforeHandle, afterPath)) fail();
      return JSON.parse(buffer.subarray(0, offset).toString("utf8"));
    } finally { await handle.close(); }
  } catch { return fail(); }
}
function digest(descriptor: CapabilityStaticDescriptor): string { return createHash("sha256").update(JSON.stringify({ permissions: descriptor.manifest.permissions, version: descriptor.manifest.version })).digest("hex"); }

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
    return { staged, packageMetadata: { kind: "capability", manifest, entry }, descriptor, permissionDigest: digest(descriptor), trust: options.trust, reviewStatus: options.reviewStatus };
  }
}
