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
    acquire?: (signal: AbortSignal) => Promise<typeof staged>;
    inspect?: (...args: unknown[]) => Promise<typeof inspected>;
    verify?: (
      value: typeof inspected,
      signal: AbortSignal,
    ) => Promise<{
      capabilityId: string;
      version: string;
      contentDigest: string;
      toolNames: string[];
    }>;
    official?: unknown;
    clock?: () => number;
    scheduler?: {
      setTimeout(callback: () => void, delayMs: number): unknown;
      clearTimeout(handle: unknown): void;
    };
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
    verify: vi.fn(
      overrides.verify ??
        (async () => {
          order.push("verify");
          return {
            capabilityId: "example.search",
            version: "1.2.3",
            contentDigest: "digest-safe",
            toolNames: ["search"],
          };
        }),
    ),
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
      acquire: async (
        operationId: string,
        _sourceSpec: string,
        signal: AbortSignal,
      ) => {
        lastId = operationId;
        return acquire(signal);
      },
      discard,
    } as never,
    inspector: { inspect } as never,
    verifier: verifier as never,
    installer: installer as never,
    officialCatalog: {
      findCapability: vi.fn(async () => overrides.official),
    } as never,
    clock: overrides.clock,
    scheduler: overrides.scheduler,
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
  it("installs in verify-then-commit order without creating or activating a session", async () => {
    const activationBoundary = {
      prepareSession: vi.fn(),
      setActiveCapabilities: vi.fn(),
    };
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
    expect(activationBoundary.prepareSession).not.toHaveBeenCalled();
    expect(activationBoundary.setActiveCapabilities).not.toHaveBeenCalled();
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

  it("rejects an unknown inspection without touching package work", async () => {
    const f = setup();
    await expect(
      f.service.install({
        inspectionId: crypto.randomUUID(),
        acceptedPackageName: staged.packageName,
        acceptedVersion: staged.resolvedVersion,
        acceptedIntegrity: staged.integrity,
        acceptedPermissionDigest: "perm-safe",
      }),
    ).rejects.toThrow("package_busy");
    expect(f.acquire).not.toHaveBeenCalled();
    expect(f.verifier).not.toHaveBeenCalled();
    expect(f.installer).not.toHaveBeenCalled();
  });

  it("rejects an invalid install request before selecting a pending lease", async () => {
    const f = setup();
    const inspection = await f.service.inspect({
      sourceSpec: staged.requestedSpec,
    });
    await expect(
      f.service.install({ ...consent(inspection), acceptedIntegrity: "" }),
    ).rejects.toThrow();
    expect(f.verifier).not.toHaveBeenCalled();
    expect(f.installer).not.toHaveBeenCalled();
    await f.service.cancel(inspection.inspectionId);
  });

  it.each([
    ["package name", { acceptedPackageName: "@other/package" }],
    ["version", { acceptedVersion: "9.9.9" }],
    ["integrity", { acceptedIntegrity: "sha512-other" }],
    ["permission digest", { acceptedPermissionDigest: "perm-other" }],
  ])(
    "consumes a consent with mismatched %s without verification",
    async (_label, change) => {
      const f = setup();
      const events: unknown[] = [];
      f.service.subscribe((event) => events.push(event));
      const inspection = await f.service.inspect({
        sourceSpec: staged.requestedSpec,
      });
      const error = await failure(
        f.service.install({ ...consent(inspection), ...change }),
      );
      expect(error.message).toBe("package_permission_denied");
      expect(f.verifier).not.toHaveBeenCalled();
      expect(f.installer).not.toHaveBeenCalled();
      expect(f.discard).toHaveBeenCalledOnce();
      expect(f.lock).toMatchObject({ held: false, releases: 1 });
      expect(
        f.repository.snapshotOperation(inspection.inspectionId),
      ).toMatchObject({
        status: "failed",
        errorCode: "package_permission_denied",
      });
      const rawTerminal = events.at(-1);
      const terminal = capabilityDistributionProgressSchema.parse(rawTerminal);
      expect(terminal).toMatchObject({
        status: "failed",
        errorCode: "package_permission_denied",
      });
      expect(Object.isFrozen(rawTerminal)).toBe(true);
      expect(JSON.stringify([error, terminal])).not.toContain("/private");
    },
  );

  it.each([
    ["Capability ID", { capabilityId: "other.id" }],
    ["version", { version: "9.9.9" }],
    ["content digest", { contentDigest: "digest-other" }],
    ["missing tool", { toolNames: [] }],
    ["changed tool", { toolNames: ["other"] }],
  ])(
    "rejects verifier %s mismatch before installer commit",
    async (_label, change) => {
      const f = setup({
        verify: async () => ({
          capabilityId: "example.search",
          version: "1.2.3",
          contentDigest: "digest-safe",
          toolNames: ["search"],
          ...change,
        }),
      });
      const inspection = await f.service.inspect({
        sourceSpec: staged.requestedSpec,
      });
      await expect(f.service.install(consent(inspection))).rejects.toThrow(
        "package_verification_failed",
      );
      expect(f.installer).not.toHaveBeenCalled();
      expect(f.discard).toHaveBeenCalledOnce();
      expect(f.lock.held).toBe(false);
      expect(
        f.repository.snapshotOperation(inspection.inspectionId),
      ).toMatchObject({
        status: "failed",
        errorCode: "package_verification_failed",
      });
    },
  );

  it("detects staged content mutation at the verifier boundary", async () => {
    const f = setup({
      verify: async (value) => {
        value.staged.contentDigest = "digest-tampered";
        return {
          capabilityId: "example.search",
          version: "1.2.3",
          contentDigest: "digest-safe",
          toolNames: ["search"],
        };
      },
    });
    const inspection = await f.service.inspect({
      sourceSpec: staged.requestedSpec,
    });
    await expect(f.service.install(consent(inspection))).rejects.toThrow(
      "package_verification_failed",
    );
    expect(f.installer).not.toHaveBeenCalled();
    staged.contentDigest = "digest-safe";
  });

  it("expires at exactly fifteen minutes and cannot be revived", async () => {
    const scheduler = new Scheduler();
    const f = setup({ clock: () => scheduler.now, scheduler });
    const inspection = await f.service.inspect({
      sourceSpec: staged.requestedSpec,
    });
    scheduler.advance(900_000);
    await expect(f.service.install(consent(inspection))).rejects.toThrow(
      "package_busy",
    );
    expect(
      f.repository.snapshotOperation(inspection.inspectionId),
    ).toMatchObject({
      status: "failed",
      errorCode: "package_permission_denied",
    });
    expect(f.discard).toHaveBeenCalledOnce();
    expect(f.lock.held).toBe(false);
  });

  it("accepts one millisecond before the fifteen-minute deadline", async () => {
    const scheduler = new Scheduler();
    const f = setup({ clock: () => scheduler.now, scheduler });
    const inspection = await f.service.inspect({
      sourceSpec: staged.requestedSpec,
    });
    scheduler.advance(899_999);
    await expect(f.service.install(consent(inspection))).resolves.toMatchObject(
      {
        state: "needs_setup",
      },
    );
    expect(f.installer).toHaveBeenCalledOnce();
  });

  it("cancels an in-flight acquisition through its real AbortSignal", async () => {
    let observedSignal: AbortSignal | undefined;
    const f = setup({
      acquire: (signal) => {
        observedSignal = signal;
        return new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        );
      },
    });
    const pending = f.service.inspect({ sourceSpec: staged.requestedSpec });
    await Promise.resolve();
    const operationId = f.operationId();
    const cancellation = f.service.cancel(operationId);
    await expect(pending).rejects.toThrow("package_permission_denied");
    await expect(cancellation).resolves.toBeUndefined();
    expect(observedSignal?.aborted).toBe(true);
    expect(f.repository.snapshotOperation(operationId)?.status).toBe(
      "cancelled",
    );
    expect(f.discard).toHaveBeenCalledOnce();
    expect(f.lock.held).toBe(false);
  });

  it("cancels an in-flight verifier, skips commit, and records cancellation", async () => {
    let observedSignal: AbortSignal | undefined;
    const f = setup({
      verify: (_value, signal) => {
        observedSignal = signal;
        return new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        );
      },
    });
    const inspection = await f.service.inspect({
      sourceSpec: staged.requestedSpec,
    });
    const installing = f.service.install(consent(inspection));
    await Promise.resolve();
    const cancellation = f.service.cancel(inspection.inspectionId);
    await expect(installing).rejects.toThrow("package_permission_denied");
    await expect(cancellation).resolves.toBeUndefined();
    expect(observedSignal?.aborted).toBe(true);
    expect(f.installer).not.toHaveBeenCalled();
    expect(
      f.repository.snapshotOperation(inspection.inspectionId)?.status,
    ).toBe("cancelled");
    expect(f.discard).toHaveBeenCalledOnce();
  });

  it("never commits when an abort-ignoring verifier resolves after cancellation", async () => {
    let resolveVerification!: (value: {
      capabilityId: string;
      version: string;
      contentDigest: string;
      toolNames: string[];
    }) => void;
    const verification = new Promise<{
      capabilityId: string;
      version: string;
      contentDigest: string;
      toolNames: string[];
    }>((resolve) => {
      resolveVerification = resolve;
    });
    const events: unknown[] = [];
    const f = setup({ verify: async () => verification });
    f.service.subscribe((event) => events.push(event));
    const inspection = await f.service.inspect({
      sourceSpec: staged.requestedSpec,
    });
    const installing = f.service.install(consent(inspection));
    await Promise.resolve();
    const cancellation = f.service.cancel(inspection.inspectionId);
    resolveVerification({
      capabilityId: "example.search",
      version: "1.2.3",
      contentDigest: "digest-safe",
      toolNames: ["search"],
    });
    await expect(installing).rejects.toThrow("package_permission_denied");
    await expect(cancellation).resolves.toBeUndefined();
    expect(f.installer).not.toHaveBeenCalled();
    expect(
      f.repository.snapshotOperation(inspection.inspectionId),
    ).toMatchObject({ status: "cancelled" });
    expect(
      capabilityDistributionProgressSchema.parse(events.at(-1)),
    ).toMatchObject({
      status: "cancelled",
    });
    expect(f.discard).toHaveBeenCalledOnce();
    expect(f.lock).toMatchObject({ held: false, releases: 1 });
  });

  it.each([
    ["required secret", "apiKey", { type: "secret", required: true }],
    ["required non-secret", "endpoint", { type: "string", required: true }],
  ] as const)(
    "projects needs_setup for a %s while retaining reviewed settings",
    async (_label, key, setting) => {
      const customized = {
        ...inspected,
        descriptor: {
          ...descriptor,
          manifest: {
            ...descriptor.manifest,
            settings: { [key]: setting },
          },
        },
      };
      const f = setup({ inspect: async () => customized });
      const inspection = await f.service.inspect({
        sourceSpec: staged.requestedSpec,
      });
      expect(inspection.capability.settings).toEqual([{ key, ...setting }]);
      const accepted = consent(inspection);
      const result = await f.service.install(accepted);
      expect(result.state).toBe("needs_setup");
      expect(result.settings).toEqual([{ key, ...setting }]);
      expect(accepted.acceptedPermissionDigest).toBe("perm-safe");
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.settings)).toBe(true);
    },
  );

  it("rejects cancellation after atomic commit begins", async () => {
    let finish!: () => void;
    const committing = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const f = setup({
      commit: async (repo, capabilities) => {
        await committing;
        capabilities.upsertInstallation({
          capabilityId: "example.search",
          version: "1.2.3",
          permissionDigest: "perm-safe",
          configured: false,
        });
        repo.commitInstallation(f.operationId(), {
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
      },
    });
    const inspection = await f.service.inspect({
      sourceSpec: staged.requestedSpec,
    });
    const installing = f.service.install(consent(inspection));
    await Promise.resolve();
    await Promise.resolve();
    await expect(f.service.cancel(inspection.inspectionId)).rejects.toThrow(
      "package_busy",
    );
    finish();
    await expect(installing).resolves.toBeDefined();
    expect(f.installer).toHaveBeenCalledOnce();
  });
});

class Scheduler {
  now = 10_000;
  private next = 1;
  private readonly timers = new Map<number, { at: number; run: () => void }>();
  setTimeout(run: () => void, delayMs: number) {
    const id = this.next++;
    this.timers.set(id, { at: this.now + delayMs, run });
    return id;
  }
  clearTimeout(id: unknown) {
    this.timers.delete(id as number);
  }
  advance(ms: number) {
    this.now += ms;
    for (const [id, timer] of [...this.timers]) {
      if (timer.at <= this.now) {
        this.timers.delete(id);
        timer.run();
      }
    }
  }
}
