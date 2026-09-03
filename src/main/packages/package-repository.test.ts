import BetterSqlite3 from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bootstrapSchemaSql } from "../database/bootstrap";
import { ManagedPackageRepository } from "./package-repository";

const migration = {
	packageName: "@agentic-worktrees/web-search",
	itemKind: "capability" as const,
	itemId: "agentic-worktrees.web-search",
	requestedSpec: "@agentic-worktrees/web-search@0.1.0",
	trust: "official" as const,
	reviewStatus: "official-reviewed" as const,
	permissionDigest: "digest",
};
const stable = {
	...migration,
	activeVersion: "0.1.0",
	activeIntegrity: "sha512-old",
	activeContentDigest: "content-old",
	permissionDigest: "digest",
	state: "installed" as const,
};

describe("ManagedPackageRepository", () => {
	let sqlite: BetterSqlite3.Database;
	let repository: ManagedPackageRepository;
	beforeEach(() => {
		sqlite = new BetterSqlite3(":memory:");
		sqlite.pragma("foreign_keys = ON");
		sqlite.exec(bootstrapSchemaSql);
		repository = new ManagedPackageRepository(sqlite);
	});
	afterEach(() => sqlite.close());

	it("stores migration records without active metadata", () => {
		repository.saveMigrationPending(migration);
		expect(repository.getByItemId("capability", migration.itemId)).toMatchObject({
			state: "migration_pending", activeVersion: undefined,
		});
	});

	it("keeps a stable installation while an operation is in progress", () => {
		repository.saveMigrationPending(migration);
		repository.beginOperation({ operationId: "install-1", action: "install", stage: "resolving", packageName: migration.packageName, requestedSpec: migration.requestedSpec });
		repository.commitInstallation("install-1", stable);
		repository.beginOperation({ operationId: "update-1", action: "update", stage: "downloading", packageName: migration.packageName, requestedSpec: "@agentic-worktrees/web-search@0.2.0" });
		expect(repository.getByPackageName(migration.packageName)).toMatchObject({ activeVersion: "0.1.0", state: "installed" });
		expect(repository.listInterruptedOperations()).toMatchObject([{ operationId: "update-1", status: "in_progress" }]);
	});

	it("commits candidate metadata without deleting installation identity", () => {
		repository.beginOperation({ operationId: "install-1", action: "install", stage: "resolving", packageName: migration.packageName, requestedSpec: migration.requestedSpec });
		repository.markAwaitingConsent("install-1", { packageName: migration.packageName, version: "0.1.0", integrity: "sha512-old", contentDigest: "content-old" });
		const original = repository.commitInstallation("install-1", stable);
		repository.beginOperation({ operationId: "update-1", action: "update", stage: "verifying", packageName: migration.packageName, requestedSpec: "@agentic-worktrees/web-search@0.2.0" });
		const updated = repository.commitInstallation("update-1", { ...stable, activeVersion: "0.2.0", activeIntegrity: "sha512-new", activeContentDigest: "content-new" });
		expect(updated).toMatchObject({ itemId: migration.itemId, activeVersion: "0.2.0", activeIntegrity: "sha512-new", activeContentDigest: "content-new" });
		expect(updated.createdAt).toEqual(original.createdAt);
	});

	it("rolls back operation completion when package/item identities collide", () => {
		repository.beginOperation({ operationId: "first", action: "install", stage: "installing", packageName: migration.packageName, requestedSpec: migration.requestedSpec });
		repository.commitInstallation("first", stable);
		repository.beginOperation({ operationId: "collision", action: "install", stage: "installing", packageName: "community-search", requestedSpec: "community-search@1.0.0" });
		expect(() => repository.commitInstallation("collision", { ...stable, packageName: "community-search", requestedSpec: "community-search@1.0.0" })).toThrow();
		expect(repository.listInterruptedOperations()).toMatchObject([{ operationId: "collision", status: "in_progress" }]);
		expect(repository.list()).toHaveLength(1);
	});

	it("rejects reusing a package name for a different item atomically", () => {
		repository.beginOperation({ operationId: "first", action: "install", stage: "installing", packageName: migration.packageName, requestedSpec: migration.requestedSpec });
		const original = repository.commitInstallation("first", stable);
		repository.beginOperation({ operationId: "inverse-collision", action: "install", stage: "installing", packageName: migration.packageName, requestedSpec: migration.requestedSpec });
		expect(() => repository.commitInstallation("inverse-collision", { ...stable, itemId: "agentic-worktrees.other", activeVersion: "9.0.0" })).toThrow();
		expect(repository.getByPackageName(migration.packageName)).toEqual(original);
		expect(repository.listInterruptedOperations()).toMatchObject([{ operationId: "inverse-collision", status: "in_progress" }]);
	});

	it("records failed and cancelled operations and lists only interruptions", () => {
		repository.beginOperation({ operationId: "failed", action: "inspect", stage: "resolving", requestedSpec: migration.requestedSpec });
		repository.beginOperation({ operationId: "cancelled", action: "install", stage: "downloading", requestedSpec: migration.requestedSpec });
		expect(repository.failOperation("failed", "package_download_failed")).toMatchObject({ status: "failed", errorCode: "package_download_failed" });
		expect(repository.cancelOperation("cancelled").status).toBe("cancelled");
		expect(repository.listInterruptedOperations()).toEqual([]);
	});
});
