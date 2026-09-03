import { mkdir, open, readFile, realpath, rm } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import pacote from "pacote";
import semver from "semver";
import type { PackageOperationStage } from "../../shared/packages/schemas";
import { digestPackageTree } from "./content-digest";
import { parseNpmSourceSpec } from "./npm-source";
import type { ManagedPackageLayout } from "./storage-layout";

const MAX_BYTES = 50 * 1024 * 1024;
export interface ResolvedNpmSource { requestedSpec: string; packageName: string; resolvedVersion: string; integrity: string; unpackedSize?: number }
export interface StagedNpmPackage extends ResolvedNpmSource { operationId: string; packageRoot: string; packageJson: unknown; contentDigest: string }
export interface NpmRegistryAdapter { resolve(spec: string, signal: AbortSignal): Promise<ResolvedNpmSource>; extract(source: ResolvedNpmSource, destination: string, signal: AbortSignal): Promise<void> }

export class PacoteNpmRegistryAdapter implements NpmRegistryAdapter {
	constructor(private readonly cacheRoot: string) {}
	async resolve(spec: string, signal: AbortSignal): Promise<ResolvedNpmSource> {
		const parsed = parseNpmSourceSpec(spec); const manifest = await pacote.manifest(parsed.requestedSpec, { cache: this.cacheRoot, signal });
		if (!manifest.name || !semver.valid(manifest.version) || !manifest._integrity) throw new Error("npm registry returned incomplete package metadata");
		return { ...parsed, packageName: manifest.name, resolvedVersion: manifest.version, integrity: String(manifest._integrity), unpackedSize: manifest.dist?.unpackedSize };
	}
	async extract(source: ResolvedNpmSource, destination: string, signal: AbortSignal): Promise<void> {
		await pacote.extract(`${source.packageName}@${source.resolvedVersion}`, destination, { cache: this.cacheRoot, signal, integrity: source.integrity });
	}
}
export class NpmPackageAcquirer {
	constructor(private readonly layout: ManagedPackageLayout, private readonly adapter: NpmRegistryAdapter = new PacoteNpmRegistryAdapter(layout.cacheRoot)) {}
	async acquire(operationId: string, sourceSpec: string, signal: AbortSignal, onStage: (stage: PackageOperationStage) => void): Promise<StagedNpmPackage> {
		const operationRoot = this.layout.stagingOperationRoot(operationId); const packageRoot = resolve(operationRoot, "package");
		await rm(operationRoot, { recursive: true, force: true });
		try {
			this.throwIfAborted(signal); onStage("resolving"); const parsed = parseNpmSourceSpec(sourceSpec); const source = await this.adapter.resolve(parsed.requestedSpec, signal);
			if (source.packageName !== parsed.packageName || !semver.valid(source.resolvedVersion) || !source.integrity) throw new Error("npm registry metadata verification failed");
			if (source.unpackedSize !== undefined && source.unpackedSize > MAX_BYTES) throw new Error("Package exceeds maximum size");
			this.throwIfAborted(signal); onStage("downloading"); await mkdir(packageRoot, { recursive: true, mode: 0o700 }); await this.adapter.extract(source, packageRoot, signal);
			this.throwIfAborted(signal); onStage("verifying"); const canonical = await realpath(packageRoot); const rel = relative(operationRoot, canonical); if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("Extracted package escapes staging root");
			const contentDigest = await digestPackageTree(packageRoot); const manifestPath = resolve(packageRoot, "package.json"); const handle = await open(manifestPath, "r").catch(() => { throw new Error("Package root must contain package.json"); });
			try { const stat = await handle.stat(); if (!stat.isFile() || stat.size > 256 * 1024) throw new Error("package.json is invalid or too large"); } finally { await handle.close(); }
			const packageJson: unknown = JSON.parse(await readFile(manifestPath, "utf8")); this.throwIfAborted(signal);
			return { ...source, operationId, packageRoot, packageJson, contentDigest };
		} catch (error) { await rm(operationRoot, { recursive: true, force: true }); throw error; }
	}
	async discard(operationId: string): Promise<void> { await rm(this.layout.stagingOperationRoot(operationId), { recursive: true, force: true }); }
	private throwIfAborted(signal: AbortSignal): void { if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("Package acquisition aborted"); }
}
