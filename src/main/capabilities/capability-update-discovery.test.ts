import BetterSqlite3 from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapSchemaSql } from "../database/bootstrap";
import { ManagedPackageRepository } from "../packages/package-repository";
import { CapabilityRepository } from "./capability-repository";
import { CapabilityDistributionService } from "./capability-distribution-service";
import { capabilityUpdateSchema } from "../../shared/packages/schemas";

const packageName = "@example/search";
const capabilityId = "example.search";

describe("Capability update discovery", () => {
  let sqlite: BetterSqlite3.Database;
  let repository: ManagedPackageRepository;
  beforeEach(() => {
    sqlite = new BetterSqlite3(":memory:");
    sqlite.exec(bootstrapSchemaSql);
    repository = new ManagedPackageRepository(sqlite);
  });
  afterEach(() => sqlite.close());
  function install(trust: "community" | "official" = "community") {
    repository.beginOperation({
      operationId: "original",
      action: "install",
      stage: "installing",
      requestedSpec: packageName,
    });
    repository.commitInstallation("original", {
      packageName,
      itemKind: "capability",
      itemId: capabilityId,
      requestedSpec: `${packageName}@1.0.0`,
      activeVersion: "1.0.0",
      activeIntegrity: "old-integrity",
      activeContentDigest: "old-content",
      permissionDigest: "old-permissions",
      trust,
      reviewStatus: trust === "official" ? "official-reviewed" : "unreviewed",
      state: "installed",
    });
  }
  function setup() {
    const metadata = {
      resolve: vi
        .fn()
        .mockResolvedValue({
          packageName,
          version: "2.0.0",
          integrity: "candidate-integrity",
        }),
    };
    const lock = { runExclusive: vi.fn() },
      acquirer = { acquire: vi.fn(), discard: vi.fn() },
      verifier = { verify: vi.fn() },
      installer = { commitFresh: vi.fn() };
    const official = { findCapability: vi.fn().mockResolvedValue(undefined) };
    const service = new CapabilityDistributionService({
      layout: { root: "/unused/private" } as never,
      repository,
      capabilityRepository: new CapabilityRepository(sqlite),
      metadata,
      packageLock: lock as never,
      acquirer: acquirer as never,
      verifier: verifier as never,
      installer: installer as never,
      officialCatalog: official as never,
    });
    return { service, metadata, lock, acquirer, verifier, installer, official };
  }
  it("has no acquisition, verification, lock, event or database side effects", async () => {
    install();
    const f = setup();
    const listener = vi.fn();
    f.service.subscribe(listener);
    const before = repository.getByPackageName(packageName);
    const updates = await f.service.checkForUpdates();
    expect(updates).toHaveLength(1);
    expect(f.metadata.resolve).toHaveBeenCalledWith(packageName);
    expect(f.lock.runExclusive).not.toHaveBeenCalled();
    expect(f.acquirer.acquire).not.toHaveBeenCalled();
    expect(f.acquirer.discard).not.toHaveBeenCalled();
    expect(f.verifier.verify).not.toHaveBeenCalled();
    expect(f.installer.commitFresh).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(repository.getByPackageName(packageName)).toEqual(before);
    expect(repository.listInterruptedOperations()).toEqual([]);
  });
  it("marks permission and setup metadata unknown until inspection", async () => {
    install();
    const [update] = await setup().service.checkForUpdates(packageName);
    expect(update).toMatchObject({
      packageName,
      capabilityId,
      currentVersion: "1.0.0",
      candidateVersion: "2.0.0",
      requiresReview: true,
    });
    expect(update).not.toHaveProperty("permissionChanged");
    expect(update).not.toHaveProperty("requiresSetup");
    expect(update).not.toHaveProperty("releaseNotes");
    expect(capabilityUpdateSchema.parse(update)).toEqual(update);
    expect(Object.isFrozen(update)).toBe(true);
    expect(JSON.stringify(update)).not.toContain("/private");
  });
  it("returns no updates for an empty managed catalog", async () => {
    const f = setup();
    expect(await f.service.checkForUpdates()).toEqual([]);
    expect(f.metadata.resolve).not.toHaveBeenCalled();
  });
  it("rejects bundled or unknown package names before metadata resolution", async () => {
    const f = setup();
    await expect(
      f.service.checkForUpdates("@agentic-worktrees/url-fetch"),
    ).rejects.toThrow("package_not_found");
    expect(f.metadata.resolve).not.toHaveBeenCalled();
  });
  it("does not suggest an implicit community downgrade", async () => {
    install();
    const f = setup();
    f.metadata.resolve.mockResolvedValue({
      packageName,
      version: "0.9.0",
      integrity: "old",
    });
    expect(await f.service.checkForUpdates()).toEqual([]);
  });
  it("does not suggest reinstalling the current version", async () => {
    install();
    const f = setup();
    f.metadata.resolve.mockResolvedValue({
      packageName,
      version: "1.0.0",
      integrity: "old",
    });
    expect(await f.service.checkForUpdates()).toEqual([]);
  });
  it("uses the signed Official release identity and notes", async () => {
    install("official");
    const f = setup();
    f.official.findCapability.mockResolvedValue({
      capabilityId,
      packageName,
      releaseSpec: "2.0.0",
      releaseNotes: "Reviewed changes",
      blockedVersions: [],
    });
    const [update] = await f.service.checkForUpdates();
    expect(f.metadata.resolve).toHaveBeenCalledWith(`${packageName}@2.0.0`);
    expect(update.releaseNotes).toBe("Reviewed changes");
  });
  it("fails closed if the Official package identity changes", async () => {
    install("official");
    const f = setup();
    f.official.findCapability.mockResolvedValue({
      capabilityId,
      packageName: "different",
      releaseSpec: "2.0.0",
      blockedVersions: [],
    });
    await expect(f.service.checkForUpdates()).rejects.toThrow(
      "package_blocked",
    );
    expect(f.metadata.resolve).not.toHaveBeenCalled();
  });
  it("fails closed for a blocked Official candidate", async () => {
    install("official");
    const f = setup();
    f.official.findCapability.mockResolvedValue({
      capabilityId,
      packageName,
      releaseSpec: "2.0.0",
      blockedVersions: ["2.0.0"],
    });
    await expect(f.service.checkForUpdates()).rejects.toThrow(
      "package_blocked",
    );
  });
  it("sanitizes metadata adapter failures", async () => {
    install();
    const f = setup();
    f.metadata.resolve.mockRejectedValue(new Error("/private/token"));
    await expect(f.service.checkForUpdates()).rejects.toThrow(
      "package_download_failed",
    );
  });
});
