import { mkdirSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

export interface ManagedPackageLayout {
	root: string; packagesRoot: string; activeRoot: string; stagingRoot: string; cacheRoot: string;
	packageVersionRoot(itemId: string, version: string): string;
	activePointerPath(itemId: string): string;
	stagingOperationRoot(operationId: string): string;
	assertManagedPath(candidate: string): string;
}

function segment(value: string): string {
	if (!value || value === "." || value === ".." || isAbsolute(value) || value.includes("/") || value.includes("\\") || value.includes("\0")) throw new Error("Unsafe managed package path segment");
	return value;
}
export function createManagedPackageLayout(rootPath: string): ManagedPackageLayout {
	mkdirSync(rootPath, { recursive: true, mode: 0o700 });
	const root = realpathSync(rootPath);
	const assertManagedPath = (candidate: string) => {
		const absolute = resolve(candidate); const rel = relative(root, absolute);
		if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("Path is outside managed package root");
		return absolute;
	};
	const packagesRoot = resolve(root, "packages"), activeRoot = resolve(root, "active"), stagingRoot = resolve(root, "staging"), cacheRoot = resolve(root, "cache");
	return { root, packagesRoot, activeRoot, stagingRoot, cacheRoot, assertManagedPath,
		packageVersionRoot: (id, version) => assertManagedPath(resolve(packagesRoot, segment(id), segment(version))),
		activePointerPath: id => assertManagedPath(resolve(activeRoot, segment(id))),
		stagingOperationRoot: id => assertManagedPath(resolve(stagingRoot, segment(id))),
	};
}
