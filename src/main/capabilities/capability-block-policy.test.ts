import BetterSqlite3 from "better-sqlite3";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { bootstrapSchemaSql } from "../database/bootstrap";
import { createManagedPackageLayout } from "../packages/storage-layout";
import { ManagedPackageRepository } from "../packages/package-repository";
import { digestPackageTree } from "../packages/content-digest";
import { InstalledCapabilityCatalog } from "./installed-catalog";
import {
  createCapabilityCatalog,
  toCapabilityDetailDto,
  permissionDigest,
} from "./catalog";
import { webSearchManifest } from "@agentic-worktrees/web-search";

it("projects signed active-version blocking without hiding or deleting the installed package", async () => {
  const root = await mkdtemp(join(tmpdir(), "block-policy-"));
  const db = new BetterSqlite3(":memory:");
  try {
    db.exec(bootstrapSchemaSql);
    const repository = new ManagedPackageRepository(db);
    const layout = createManagedPackageLayout(root);
    const capabilityId = webSearchManifest.id,
      version = webSearchManifest.version,
      packageName = "@agentic-worktrees/web-search";
    const packageRoot = layout.packageVersionRoot(capabilityId, version);
    await mkdir(packageRoot, { recursive: true });
    await mkdir(layout.activeRoot, { recursive: true });
    await writeFile(
      join(packageRoot, "capability.json"),
      JSON.stringify({ manifest: webSearchManifest, tools: [] }),
    );
    await writeFile(join(packageRoot, "index.js"), "export {};");
    const contentDigest = await digestPackageTree(packageRoot);
    await writeFile(
      `${layout.activePointerPath(capabilityId)}.json`,
      JSON.stringify({
        packageName,
        capabilityId,
        version,
        integrity: "integrity",
        contentDigest,
        manifestPath: "capability.json",
        entryPath: "index.js",
      }),
    );
    repository.restoreInstallation(packageName, {
      packageName,
      itemKind: "capability",
      itemId: capabilityId,
      requestedSpec: `${packageName}@${version}`,
      activeVersion: version,
      activeIntegrity: "integrity",
      activeContentDigest: contentDigest,
      acceptedPermissionDigest: permissionDigest(webSearchManifest),
      state: "installed",
      trust: "official",
      reviewStatus: "official-reviewed",
      createdAt: new Date(1),
      updatedAt: new Date(1),
    });
    const before = repository.getByPackageName(packageName);
    const officialCatalog = {
      findCapability: vi
        .fn()
        .mockResolvedValue({
          capabilityId,
          packageName,
          blockedVersions: [version],
        }),
    };
    const installed = new InstalledCapabilityCatalog(layout, repository, {
      officialCatalog,
    });
    await installed.refresh();
    const catalog = createCapabilityCatalog(installed);
    const dto = toCapabilityDetailDto(catalog.get(capabilityId));
    expect(dto.installationState).toBe("blocked");
    expect(dto.state).toBe("unavailable");
    expect(installed.list()).toHaveLength(1);
    expect(repository.getByPackageName(packageName)).toEqual(before);
    expect(officialCatalog.findCapability).toHaveBeenCalledWith(capabilityId);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
