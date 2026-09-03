import { createHash } from "node:crypto";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export interface PackageTreeLimits { maxBytes?: number; maxEntries?: number }
export function normalizePackagePath(path: string): string { return path.replace(/\\/g, "/"); }
const comparePaths = (left: { path: string }, right: { path: string }) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path));
export async function digestPackageTree(rootPath: string, limits: PackageTreeLimits = {}): Promise<string> {
	const root = await realpath(rootPath); const maxBytes = limits.maxBytes ?? 50 * 1024 * 1024, maxEntries = limits.maxEntries ?? 5_000;
	const records: Array<{ path: string; mode: number; content?: Buffer }> = []; let bytes = 0, entries = 0;
	async function walk(directory: string): Promise<void> {
		for (const name of (await readdir(directory)).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))) {
			const path = resolve(directory, name); const rel = normalizePackagePath(relative(root, path));
			if (!rel || rel.startsWith("../") || isAbsolute(rel)) throw new Error("Package entry escapes extraction root");
			const before = await lstat(path); entries += 1; if (entries > maxEntries) throw new Error("Package exceeds maximum entries");
			if (before.isSymbolicLink() || (before.isFile() && before.nlink !== 1)) throw new Error("Package links are not allowed");
			const canonical = await realpath(path); const canonicalRel = relative(root, canonical); if (canonicalRel.startsWith("..") || isAbsolute(canonicalRel)) throw new Error("Package entry escapes extraction root");
			if (before.isDirectory()) {
				records.push({ path: `${rel}/`, mode: before.mode & 0o777 }); await walk(path);
				const after = await lstat(path); if (!after.isDirectory() || after.dev !== before.dev || after.ino !== before.ino) throw new Error("Package entry changed during verification");
			} else if (before.isFile()) {
				const handle = await open(path, "r");
				try {
					const opened = await handle.stat(); if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino) throw new Error("Package entry changed during verification");
					bytes += opened.size; if (bytes > maxBytes) throw new Error("Package exceeds maximum size");
					const content = Buffer.alloc(opened.size); let offset = 0; while (offset < content.length) { const result = await handle.read(content, offset, content.length - offset, offset); if (result.bytesRead === 0) throw new Error("Package entry changed during verification"); offset += result.bytesRead; }
					const after = await handle.stat(); if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ino !== opened.ino) throw new Error("Package entry changed during verification");
					records.push({ path: rel, mode: opened.mode & 0o777, content });
				} finally { await handle.close(); }
			} else throw new Error("Unsupported package entry type");
		}
	}
	await walk(root); const hash = createHash("sha256");
	for (const record of records.sort(comparePaths)) { hash.update(record.path); hash.update("\0"); hash.update(record.mode.toString(8)); hash.update("\0"); if (record.content) hash.update(record.content); hash.update("\0"); }
	return hash.digest("hex");
}
