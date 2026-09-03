import BetterSqlite3 from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import { capabilityDetailSchema } from "../../shared/capabilities/schemas";
import {
  capabilityDistributionProgressSchema,
  capabilityPackageInspectionSchema,
  packageErrorCodeSchema,
} from "../../shared/packages/schemas";
import { bootstrapSchemaSql } from "../database/bootstrap";
import { ManagedPackageRepository } from "../packages/package-repository";
import { CapabilityRepository } from "./capability-repository";
import { CapabilityDistributionService } from "./capability-distribution-service";

const staged = {
  packageRoot: "/private/stage/secret",
  packageName: "@example/search",
  resolvedVersion: "1.2.3",
  integrity: "sha512-safe",
  contentDigest: "digest-safe",
  operationId: "unused",
  requestedSpec: "@example/search@1.2.3",
};
const descriptor = {
  manifest: {
    id: "example.search",
    version: "1.2.3",
    name: "Search",
    description: "Search safely",
    category: "test",
    sdkVersion: ">=0.1.0",
    author: { name: "Test" },
    license: "MIT",
    compatibility: { codex: "supported", opencode: "supported" },
    permissions: { network: [], secrets: [] },
    settings: {},
  },
  entry: "./dist/index.js",
  tools: [
    { name: "search", description: "Search", inputSchema: { type: "object" } },
  ],
};
const inspected = {
  staged,
  descriptor,
  packageMetadata: {
    kind: "capability",
    manifest: "./capability.json",
    entry: "./dist/index.js",
  },
  permissionDigest: "perm-safe",
  trust: "community",
  reviewStatus: "unreviewed",
};
class Lock {
  held = false;
  calls = 0;
  releases = 0;
  assertions = 0;
  compromisedAt = Infinity;
  async runExclusive<T>(
    task: (owner: { assertHealthy(): void }) => Promise<T>,
  ): Promise<T> {
    while (this.held)
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    this.calls++;
    this.held = true;
    try {
      return await task({
        assertHealthy: () => {
          this.assertions++;
          if (this.assertions >= this.compromisedAt)
            throw new Error("/private/lock compromised");
        },
      });
    } finally {
      this.held = false;
      this.releases++;
    }
  }
}
function setup(
  overrides: {
    acquire?: () => Promise<typeof staged>;
    inspect?: (...args: unknown[]) => Promise<typeof inspected>;
    official?: unknown;
    commit?: (
      repo: ManagedPackageRepository,
      capabilities: CapabilityRepository,
    ) => Promise<{ state: string }>;
    lock?: Lock;
  } = {},
) {
  const db = new BetterSqlite3(":memory:");
  db.exec(bootstrapSchemaSql);
  const repository = new ManagedPackageRepository(db),
    capabilities = new CapabilityRepository(db),
    lock = overrides.lock ?? new Lock();
  const order: string[] = [],
    discard = vi.fn(async () => {
      order.push("cleanup");
    }),
    acquire = vi.fn(
      overrides.acquire ??
        (async () => {
          order.push("acquire");
          return staged;
        }),
    ),
    inspect = vi.fn(
      overrides.inspect ??
        (async () => {
          order.push("inspect");
          return inspected;
        }),
    );
  const verifier = {
    verify: vi.fn(async () => {
      order.push("verify");
      return {
        capabilityId: "example.search",
        version: "1.2.3",
        contentDigest: "digest-safe",
        toolNames: ["search"],
      };
    }),
  };
  const installer = {
    commitFresh: vi.fn(async () => {
      order.push("install");
      if (overrides.commit) return overrides.commit(repository, capabilities);
      capabilities.upsertInstallation({
        capabilityId: "example.search",
        version: "1.2.3",
        permissionDigest: "perm-safe",
        configured: false,
      });
      repository.commitInstallation(currentId(), {
        packageName: staged.packageName,
        itemKind: "capability",
        itemId: "example.search",
        requestedSpec: staged.requestedSpec,
        activeVersion: staged.resolvedVersion,
        activeIntegrity: staged.integrity,
        activeContentDigest: staged.contentDigest,
        trust: "community",
        reviewStatus: "unreviewed",
        permissionDigest: "perm-safe",
        state: "installed",
      });
      return { state: "installed" };
    }),
  };
  let lastId = "";
  const currentId = () => lastId;
  const service = new CapabilityDistributionService({
    layout: { root: "/unused" } as never,
    repository,
    capabilityRepository: capabilities,
    packageLock: lock as never,
    acquirer: {
      acquire: async (operationId: string) => {
        lastId = operationId;
        return acquire();
      },
      discard,
    } as never,
    inspector: { inspect } as never,
    verifier: verifier as never,
    installer: installer as never,
    officialCatalog: {
      findCapability: vi.fn(async () => overrides.official),
    } as never,
  });
  return {
    db,
    repository,
    capabilities,
    lock,
    order,
    discard,
    acquire,
    inspect,
    verifier: verifier.verify,
    installer: installer.commitFresh,
    service,
    operationId: () => lastId,
  };
}
const consent = (
  inspection: Awaited<ReturnType<CapabilityDistributionService["inspect"]>>,
) => ({
  inspectionId: inspection.inspectionId,
  acceptedPackageName: inspection.packageName,
  acceptedVersion: inspection.resolvedVersion,
  acceptedIntegrity: inspection.integrity,
  acceptedPermissionDigest: inspection.permissionDigest,
});
const failure = async (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error("expected failure");
    },
    (error) => error as Error & { code?: string },
  );

describe("CapabilityDistributionService direct consent integration", () => {
  it("inspects a Community package statically and holds its only lock", async () => {
    const f = setup();
    const events: unknown[] = [];
    f.service.subscribe((e) => events.push(e));
    const dto = await f.service.inspect({ sourceSpec: staged.requestedSpec });
    expect(capabilityPackageInspectionSchema.parse(dto)).toEqual(dto);
    expect(dto).toMatchObject({
      trust: "community",
      reviewStatus: "unreviewed",
      releaseNotes: "",
    });
    expect(Object.isFrozen(dto)).toBe(true);
    expect(f.repository.snapshotOperation(dto.inspectionId)?.status).toBe(
      "awaiting_consent",
    );
    expect(f.verifier).not.toHaveBeenCalled();
    expect(f.installer).not.toHaveBeenCalled();
    expect(f.lock).toMatchObject({ held: true, calls: 1 });
    expect(JSON.stringify([dto, events])).not.toContain("/private");
    events.forEach((e) => capabilityDistributionProgressSchema.parse(e));
    await f.service.cancel(dto.inspectionId);
  });
  it("inspects an exact Official catalog package without downgrading trust", async () => {
    const official = {
      capabilityId: "example.search",
      packageName: staged.packageName,
      releaseSpec: staged.resolvedVersion,
      minimumAppVersion: "1.0.0",
      descriptor,
      releaseNotes: "Reviewed release",
    };
    const f = setup({ official });
    f.inspect.mockImplementation(async (_s: unknown, options: unknown) => {
      const trust = options as {
        trust: "official" | "community";
        reviewStatus: "official-reviewed" | "unreviewed";
      };
      return {
        ...inspected,
        trust: trust.trust,
        reviewStatus: trust.reviewStatus,
      };
    });
    const dto = await f.service.inspect({
      sourceSpec: staged.requestedSpec,
      officialCapabilityId: "example.search",
    });
    expect(dto).toMatchObject({
      trust: "official",
      reviewStatus: "official-reviewed",
      releaseNotes: "Reviewed release",
    });
    await f.service.cancel(dto.inspectionId);
  });
  it("fails unknown Official lookup specifically as package_not_found", async () => {
    const f = setup({ official: undefined });
    const error = await failure(
      f.service.inspect({
        sourceSpec: staged.requestedSpec,
        officialCapabilityId: "missing.id",
      }),
    );
    expect(error.message).toBe("package_not_found");
    const operation = f.repository.listInterruptedOperations();
    expect(operation).toHaveLength(0);
    expect(f.discard).toHaveBeenCalledOnce();
  });
  it("preserves Official identity mismatch as package_manifest_invalid", async () => {
    const f = setup({
      official: { capabilityId: "example.search" },
      inspect: async () => {
        throw new Error("package_manifest_invalid");
      },
    });
    const error = await failure(
      f.service.inspect({
        sourceSpec: staged.requestedSpec,
        officialCapabilityId: "example.search",
      }),
    );
    expect(error.message).toBe("package_manifest_invalid");
    expect(f.repository.listInterruptedOperations()).toHaveLength(0);
  });
  it("rejects invalid input before lock, operation, or acquisition", async () => {
    const f = setup();
    await expect(
      f.service.inspect({ sourceSpec: "file:///private/pkg" }),
    ).rejects.toThrow();
    expect(f.lock.calls).toBe(0);
    expect(f.acquire).not.toHaveBeenCalled();
    expect(f.repository.listInterruptedOperations()).toHaveLength(0);
  });
  it.each([
    ["package name", "package"],
    ["Capability ID", "item"],
  ] as const)(
    "blocks an existing %s collision coherently",
    async (_label, kind) => {
      const f = setup();
      f.repository.saveMigrationPending({
        packageName: kind === "package" ? staged.packageName : "other-package",
        itemKind: "capability",
        itemId: kind === "item" ? "example.search" : "other.id",
        requestedSpec:
          kind === "package" ? staged.requestedSpec : "other-package@1.0.0",
        trust: "community",
        reviewStatus: "unreviewed",
      });
      const error = await failure(
        f.service.inspect({ sourceSpec: staged.requestedSpec }),
      );
      expect(error.message).toBe("package_blocked");
      expect(f.repository.listInterruptedOperations()).toHaveLength(0);
      expect(f.discard).toHaveBeenCalledOnce();
    },
  );
  it("records acquisition failure and cleans with a safe shared code", async () => {
    const f = setup({
      acquire: async () => {
        throw new Error("token at /private/stage");
      },
    });
    const error = await failure(
      f.service.inspect({ sourceSpec: staged.requestedSpec }),
    );
    expect(error.message).toBe("package_download_failed");
    expect(packageErrorCodeSchema.parse(error.message)).toBe(
      "package_download_failed",
    );
    expect(f.repository.snapshotOperation(f.operationId())).toMatchObject({
      status: "failed",
      errorCode: "package_download_failed",
    });
    expect(f.repository.listInterruptedOperations()).toHaveLength(0);
    expect(f.discard).toHaveBeenCalledOnce();
    expect(JSON.stringify(error)).not.toContain("/private");
  });
  it("records static inspection failure and cleans with package_manifest_invalid", async () => {
    const f = setup({
      inspect: async () => {
        throw new Error("bad /private/manifest");
      },
    });
    const error = await failure(
      f.service.inspect({ sourceSpec: staged.requestedSpec }),
    );
    expect(error.message).toBe("package_manifest_invalid");
    expect(f.repository.snapshotOperation(f.operationId())).toMatchObject({
      status: "failed",
      errorCode: "package_manifest_invalid",
    });
    expect(f.discard).toHaveBeenCalledOnce();
    expect(f.lock.held).toBe(false);
  });
  it("installs in verify-then-commit order, completes, cleans, releases, and creates no session", async () => {
    const f = setup();
    const events: unknown[] = [];
    f.service.subscribe((e) => events.push(e));
    const inspection = await f.service.inspect({
      sourceSpec: staged.requestedSpec,
    });
    const result = await f.service.install(consent(inspection));
    expect(capabilityDetailSchema.parse(result)).toEqual(result);
    expect(f.order).toEqual([
      "acquire",
      "inspect",
      "verify",
      "install",
      "cleanup",
    ]);
    expect(
      f.repository.snapshotOperation(inspection.inspectionId)?.status,
    ).toBe("completed");
    expect(f.discard).toHaveBeenCalledOnce();
    expect(f.lock).toMatchObject({ calls: 1, releases: 1, held: false });
    expect(
      events.some(
        (e) =>
          capabilityDistributionProgressSchema.parse(e).status === "completed",
      ),
    ).toBe(true);
    expect(
      f.db.prepare("SELECT COUNT(*) count FROM session_capabilities").get(),
    ).toEqual({ count: 0 });
    await expect(f.service.install(consent(inspection))).rejects.toThrow(
      "package_busy",
    );
  });
  it("uses configured repository state with a custom installer", async () => {
    const f = setup({
      commit: async (repo, capabilities) => {
        capabilities.upsertInstallation({
          capabilityId: "example.search",
          version: "1.2.3",
          permissionDigest: "perm-safe",
          configured: true,
        });
        repo.commitInstallation(
          repo.listInterruptedOperations()[0].operationId,
          {
            packageName: staged.packageName,
            itemKind: "capability",
            itemId: "example.search",
            requestedSpec: staged.requestedSpec,
            activeVersion: staged.resolvedVersion,
            activeIntegrity: staged.integrity,
            activeContentDigest: staged.contentDigest,
            trust: "community",
            reviewStatus: "unreviewed",
            permissionDigest: "perm-safe",
            state: "installed",
          },
        );
        return { state: "installed" };
      },
    });
    const inspection = await f.service.inspect({
      sourceSpec: staged.requestedSpec,
    });
    expect((await f.service.install(consent(inspection))).state).toBe("ready");
  });
  it("detects compromise after verifier and skips installer", async () => {
    const lock = new Lock();
    lock.compromisedAt = 3;
    const f = setup({ lock });
    const inspection = await f.service.inspect({
      sourceSpec: staged.requestedSpec,
    });
    const error = await failure(f.service.install(consent(inspection)));
    expect(error.message).toBe("package_busy");
    expect(f.verifier).toHaveBeenCalledOnce();
    expect(f.installer).not.toHaveBeenCalled();
    expect(
      f.repository.snapshotOperation(inspection.inspectionId),
    ).toMatchObject({ status: "failed", errorCode: "package_busy" });
  });
  it("isolates throwing listeners and unsubscribe prevents later delivery", async () => {
    const f = setup();
    const heard = vi.fn();
    f.service.subscribe(() => {
      throw new Error("listener secret");
    });
    const unsubscribe = f.service.subscribe(heard);
    const inspection = await f.service.inspect({
      sourceSpec: staged.requestedSpec,
    });
    expect(heard).toHaveBeenCalled();
    unsubscribe();
    const count = heard.mock.calls.length;
    await f.service.cancel(inspection.inspectionId);
    expect(heard).toHaveBeenCalledTimes(count);
  });
  it("keeps a second inspect out of acquisition while the first awaits consent", async () => {
    const f = setup();
    const first = await f.service.inspect({ sourceSpec: staged.requestedSpec });
    const second = f.service.inspect({ sourceSpec: "second-package@1.0.0" });
    await Promise.resolve();
    await Promise.resolve();
    expect(f.acquire).toHaveBeenCalledOnce();
    await f.service.cancel(first.inspectionId);
    const secondInspection = await second;
    expect(f.acquire).toHaveBeenCalledTimes(2);
    await f.service.cancel(secondInspection.inspectionId);
  });
});
