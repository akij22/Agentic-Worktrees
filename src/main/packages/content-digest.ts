import { createHash } from "node:crypto";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export interface PackageTreeLimits { maxBytes?: number; maxEntries?: number }
export async function digestPackageTree(rootPath: string, limits: PackageTreeLimits = {}): Promise<string> {
	const root = await realpath(rootPath); const maxBytes = limits.maxBytes ?? 50 * 1024 * 1024, maxEntries = limits.maxEntries ?? 5_000;
	const records: Array<{ path: string; mode: number; content?: Buffer }> = []; let bytes = 0, entries = 0;
	async function walk(directory: string): Promise<void> {
		for (const name of (await readdir(directory)).sort()) {
			const path = resolve(directory, name); const rel = relative(root, path);
			if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("Package entry escapes extraction root");
			const stat = await lstat(path); entries += 1; if (entries > maxEntries) throw new Error("Package exceeds maximum entries");
			if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink !== 1)) throw new Error("Package links are not allowed");
			const canonical = await realpath(path); const canonicalRel = relative(root, canonical); if (canonicalRel.startsWith("..") || isAbsolute(canonicalRel)) throw new Error("Package entry escapes extraction root");
			if (stat.isDirectory()) { records.push({ path: `${rel}/`, mode: stat.mode & 0o777 }); await walk(path); }
			else if (stat.isFile()) { bytes += stat.size; if (bytes > maxBytes) throw new Error("Package exceeds maximum size"); records.push({ path: rel, mode: stat.mode & 0o777, content: await readFile(path) }); }
			else throw new Error("Unsupported package entry type");
		}
	}
	await walk(root); const hash = createHash("sha256");
	for (const record of records.sort((a, b) => a.path.localeCompare(b.path))) { hash.update(record.path); hash.update("\0"); hash.update(record.mode.toString(8)); hash.update("\0"); if (record.content) hash.update(record.content); hash.update("\0"); }
	return hash.digest("hex");
}
