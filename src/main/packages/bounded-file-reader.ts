import type { Stats } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

function contained(root: string, candidate: string, allowRoot = false): boolean {
	const rel = relative(root, candidate);
	return (allowRoot && rel === "") || (!!rel && !rel.startsWith("..") && !isAbsolute(rel));
}
function sameFile(left: Stats, right: Stats): boolean {
	return left.isFile() && right.isFile() && left.dev === right.dev && left.ino === right.ino && left.mode === right.mode && left.size === right.size && left.mtimeMs === right.mtimeMs;
}

export async function readContainedFile(root: string, candidate: string, maxBytes: number): Promise<Buffer> {
	const lexicalRoot = resolve(root); const lexicalPath = resolve(candidate);
	if (!contained(lexicalRoot, lexicalPath)) throw new Error("invalid_static_file");
	const rootReal = await realpath(lexicalRoot); const beforePath = await lstat(lexicalPath);
	if (!beforePath.isFile() || beforePath.isSymbolicLink() || beforePath.nlink !== 1 || beforePath.size > maxBytes) throw new Error("invalid_static_file");
	const pathReal = await realpath(lexicalPath);
	if (!contained(rootReal, pathReal)) throw new Error("invalid_static_file");
	const handle = await open(lexicalPath, "r");
	try {
		const opened = await handle.stat();
		if (!sameFile(beforePath, opened) || opened.size > maxBytes) throw new Error("invalid_static_file");
		const bytes = Buffer.alloc(opened.size); let offset = 0;
		while (offset < bytes.length) { const result = await handle.read(bytes, offset, bytes.length - offset, offset); if (!result.bytesRead) throw new Error("invalid_static_file"); offset += result.bytesRead; }
		const afterHandle = await handle.stat(); const afterPath = await lstat(lexicalPath); const afterReal = await realpath(lexicalPath);
		if (afterReal !== pathReal || !sameFile(opened, afterHandle) || !sameFile(opened, afterPath)) throw new Error("invalid_static_file");
		return bytes;
	} finally { await handle.close(); }
}

export async function readContainedJson(root: string, candidate: string, maxBytes: number): Promise<unknown> {
	return JSON.parse((await readContainedFile(root, candidate, maxBytes)).toString("utf8"));
}
