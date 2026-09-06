import BetterSqlite3 from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bootstrapSchemaSql } from "../database/bootstrap";
import { ManagedPackageRepository } from "./package-repository";

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
