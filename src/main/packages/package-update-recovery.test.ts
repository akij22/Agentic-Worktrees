import BetterSqlite3 from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bootstrapSchemaSql } from "../database/bootstrap";
import { ManagedPackageRepository } from "./package-repository";
import { updateRecoverySchema } from "../../shared/packages/update-recovery";

const journal = () => ({
  operationId: "operation-1", ownerToken: "owner-1", packageName: "@example/search", capabilityId: "example.search",
  stage: "prepared" as const,
  previousPointer: { packageName: "@example/search", capabilityId: "example.search", version: "1.0.0", integrity: "sha512-old", contentDigest: "old-digest", manifestPath: "./capability.json", entryPath: "./dist/index.js" },
  candidatePointer: { packageName: "@example/search", capabilityId: "example.search", version: "2.0.0", integrity: "sha512-new", contentDigest: "new-digest", manifestPath: "./capability.json", entryPath: "./dist/index.js" },
  previousInstallation: { packageName: "@example/search", itemKind: "capability" as const, itemId: "example.search", requestedSpec: "@example/search@1.0.0", activeVersion: "1.0.0", activeIntegrity: "sha512-old", activeContentDigest: "old-digest", trust: "community" as const, reviewStatus: "unreviewed" as const, state: "installed" as const, createdAt: 1, updatedAt: 1 },
  configuration: { capabilityId: "example.search", settings: [{ key: "token", secretRef: "opaque-encrypted-ref" }] },
  sessions: [], obsoleteSecretRefs: ["obsolete-ref"],
});

describe("persistent update recovery journal", () => {
  function fixture() { const db = new BetterSqlite3(":memory:"); db.exec(bootstrapSchemaSql); return { db, repository: new ManagedPackageRepository(db) }; }
  it("roundtrips numeric installation timestamps through JSON and the recovery repository", () => {
    const { db, repository } = fixture();
    try {
      const snapshot = journal();
      snapshot.previousInstallation.createdAt = 1725000000000;
      snapshot.previousInstallation.updatedAt = 1725000000123;
      const serialized = JSON.stringify(snapshot);
      expect(updateRecoverySchema.parse(JSON.parse(serialized))).toEqual(snapshot);
      repository.createUpdateRecovery(snapshot);
      const restored = repository.listUpdateRecoveries()[0];
      expect(restored).toEqual(snapshot);
      expect(typeof restored.previousInstallation.updatedAt).toBe("number");
      expect(updateRecoverySchema.safeParse({ ...snapshot, previousInstallation: { ...snapshot.previousInstallation, createdAt: new Date() } }).success).toBe(false);
    } finally { db.close(); }
  });
  it("rejects unrelated skill installation entities in capability recovery snapshots", () => {
    const snapshot = journal();
    expect(updateRecoverySchema.safeParse({ ...snapshot, previousInstallation: { ...snapshot.previousInstallation, itemKind: "skill" } }).success).toBe(false);
  });
  it.each(["quarantine", "cleanup"] as const)("runs %s with a present journal in one SQLite transaction without nested savepoints", (action) => {
    const statements: string[] = [];
    const db = new BetterSqlite3(":memory:", { verbose: (sql) => statements.push(String(sql)) });
    db.exec(bootstrapSchemaSql);
    const repository = new ManagedPackageRepository(db);
    try {
      const snapshot = journal();
      repository.createUpdateRecovery(snapshot);
      repository.restoreInstallation(snapshot.packageName, { ...snapshot.previousInstallation, activeVersion: snapshot.candidatePointer.version, activeIntegrity: snapshot.candidatePointer.integrity, activeContentDigest: snapshot.candidatePointer.contentDigest, createdAt: new Date(1), updatedAt: new Date(1) });
      if (action === "cleanup") {
        repository.quarantineUpdateRecoveries();
        repository.advanceUpdateRecovery(snapshot.operationId, snapshot.ownerToken, "cleanup_pending");
      }
      statements.length = 0;
      expect(() => action === "quarantine" ? repository.quarantineUpdateRecoveries() : repository.completeRecoveredCleanup(snapshot.operationId, snapshot.ownerToken)).not.toThrow();
      expect(statements.filter((sql) => /SAVEPOINT|RELEASE/i.test(sql))).toEqual([]);
      expect(statements.filter((sql) => /^BEGIN/i.test(sql))).toHaveLength(1);
      expect(statements.filter((sql) => /^COMMIT/i.test(sql))).toHaveLength(1);
      if (action === "quarantine") {
        expect(repository.listUpdateRecoveries()[0].stage).toBe("conflict");
        expect(repository.getByPackageName(snapshot.packageName)?.state).toBe("blocked");
      } else {
        expect(repository.listUpdateRecoveries()).toEqual([]);
        expect(repository.getByPackageName(snapshot.packageName)?.state).toBe("installed");
        expect(repository.getByPackageName(snapshot.packageName)?.errorCode).toBeUndefined();
      }
    } finally { db.close(); }
  });
  it.each(["quarantine", "cleanup"] as const)("rolls back the whole %s transition when a later SQLite statement fails", (action) => {
    const { db, repository } = fixture();
    try {
      const snapshot = journal();
      repository.createUpdateRecovery(snapshot);
      repository.restoreInstallation(snapshot.packageName, { ...snapshot.previousInstallation, activeVersion: snapshot.candidatePointer.version, activeIntegrity: snapshot.candidatePointer.integrity, activeContentDigest: snapshot.candidatePointer.contentDigest, createdAt: new Date(1), updatedAt: new Date(1) });
      if (action === "cleanup") {
        repository.quarantineUpdateRecoveries();
        repository.advanceUpdateRecovery(snapshot.operationId, snapshot.ownerToken, "cleanup_pending");
      }
      const before = { journal: repository.listUpdateRecoveries(), installation: repository.getByPackageName(snapshot.packageName) };
      db.exec(action === "quarantine"
        ? "CREATE TRIGGER reject_recovery BEFORE UPDATE ON managed_package_update_recoveries BEGIN SELECT RAISE(ABORT, 'injected failure'); END"
        : "CREATE TRIGGER reject_recovery BEFORE UPDATE ON managed_package_installations BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
      expect(() => action === "quarantine" ? repository.quarantineUpdateRecoveries() : repository.completeRecoveredCleanup(snapshot.operationId, snapshot.ownerToken)).toThrow();
      expect(repository.listUpdateRecoveries()).toEqual(before.journal);
      expect(repository.getByPackageName(snapshot.packageName)).toEqual(before.installation);
      expect(db.inTransaction).toBe(false);
    } finally { db.close(); }
  });
  it("survives a SQLite close/reopen without losing encrypted references or version retention", async () => {
    const root = await mkdtemp(join(tmpdir(), "update-journal-"));
    try {
      let db = new BetterSqlite3(join(root, "recovery.sqlite")); db.exec(bootstrapSchemaSql);
      new ManagedPackageRepository(db).createUpdateRecovery(journal()); db.close();
      db = new BetterSqlite3(join(root, "recovery.sqlite"));
      try { expect(new ManagedPackageRepository(db).listUpdateRecoveries()).toEqual([journal()]); } finally { db.close(); }
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("rejects stale owner transitions and deletion without modifying the snapshot", () => {
    const { db, repository } = fixture();
    try {
      repository.createUpdateRecovery(journal());
      expect(() => repository.advanceUpdateRecovery("operation-1", "other", "recovering")).toThrow("package_update_failed");
      expect(() => repository.finishUpdateRecovery("operation-1", "other")).toThrow("package_update_failed");
      expect(repository.listUpdateRecoveries()).toEqual([journal()]);
    } finally { db.close(); }
  });
  it("retains failed cleanup references until explicitly finalized by the owner", () => {
    const { db, repository } = fixture();
    try {
      repository.createUpdateRecovery(journal());
      repository.advanceUpdateRecovery("operation-1", "owner-1", "cleanup_pending", "package_update_failed");
      expect(repository.listUpdateRecoveries()[0]).toMatchObject({ stage: "cleanup_pending", obsoleteSecretRefs: ["obsolete-ref"], errorCode: "package_update_failed" });
      repository.finishUpdateRecovery("operation-1", "owner-1");
      expect(repository.listUpdateRecoveries()).toEqual([]);
    } finally { db.close(); }
  });
  it.each(["/private/root/index.js", "../escape.js", "C:\\private\\entry.js"])("refuses unsafe pointer path %s", (entryPath) => {
    const { db, repository } = fixture();
    try { const input = journal(); input.previousPointer.entryPath = entryPath;
      expect(() => repository.createUpdateRecovery(input)).toThrow("package_update_failed");
      expect(repository.listUpdateRecoveries()).toEqual([]);
    } finally { db.close(); }
  });
  it("rejects duplicate package ownership rather than replacing a recoverable snapshot", () => {
    const { db, repository } = fixture();
    try {
      repository.createUpdateRecovery(journal());
      expect(() => repository.createUpdateRecovery({ ...journal(), operationId: "operation-2", ownerToken: "owner-2" })).toThrow("package_update_failed");
      expect(repository.listUpdateRecoveries()).toEqual([journal()]);
    } finally { db.close(); }
  });
});
