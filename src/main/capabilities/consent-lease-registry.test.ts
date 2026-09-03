import { describe, expect, it, vi } from "vitest";
import {
  ConsentLeaseRegistry,
  type ConsentLeaseScheduler,
  type ExclusivePackageLock,
} from "./consent-lease-registry";

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const caught = async (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error("expected rejection");
    },
    (error) => error as Error & { code?: string; cause?: unknown },
  );
const expectSafeError = (
  error: Error & { code?: string; cause?: unknown },
  code: string,
  forbidden: string[],
) => {
  expect(error).toMatchObject({ name: "LeaseError", message: code, code });
  expect(Reflect.ownKeys(error).sort()).toEqual(
    ["code", "message", "name", "stack"].sort(),
  );
  expect(error.cause).toBeUndefined();
  const exposed = `${error.message}\n${error.stack ?? ""}\n${JSON.stringify(error)}\n${Reflect.ownKeys(
    error,
  )
    .map((key) => String(error[key as keyof typeof error]))
    .join("\n")}`;
  for (const value of forbidden) expect(exposed).not.toContain(value);
};
class Scheduler implements ConsentLeaseScheduler {
  now = 1_000;
  private next = 1;
  readonly timers = new Map<number, { at: number; run: () => void }>();
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
    for (const [id, timer] of [...this.timers])
      if (timer.at <= this.now) {
        this.timers.delete(id);
        timer.run();
      }
  }
}
class FakeLock implements ExclusivePackageLock {
  held = false;
  enters = 0;
  releases = 0;
  failAcquire = false;
  compromised = false;
  async runExclusive<T>(
    task: (owner: { assertHealthy(): void }) => Promise<T>,
  ) {
    if (this.failAcquire) throw new Error("/secret/lock busy");
    while (this.held)
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    this.held = true;
    this.enters++;
    try {
      const result = await task({
        assertHealthy: () => {
          if (this.compromised) throw new Error("lost /secret/lock");
        },
      });
      if (this.compromised) throw new Error("lost /secret/lock");
      return result;
    } finally {
      this.held = false;
      this.releases++;
    }
  }
}
const setup = (
  overrides: Partial<{
    lock: FakeLock;
    acquire: () => Promise<{ packageName: string }>;
    cleanup: () => Promise<void>;
    commit: (payload: string) => Promise<string>;
  }> = {},
) => {
  const scheduler = new Scheduler(),
    lock = overrides.lock ?? new FakeLock();
  const acquire = vi.fn(
    overrides.acquire ?? (async () => ({ packageName: "safe-package" })),
  );
  const cleanup = vi.fn(overrides.cleanup ?? (async () => undefined));
  const commit = vi.fn(
    overrides.commit ?? (async (payload) => `installed:${payload}`),
  );
  const registry = new ConsentLeaseRegistry({
    lock,
    scheduler,
    clock: () => scheduler.now,
    timeoutMs: 900_000,
  });
  const lease = registry.start({
    operationId: "op",
    acquire,
    inspect: (value, timing) => ({ ...value, expiresAt: timing.expiresAt }),
    accept: commit,
    cleanup,
  });
  return { scheduler, lock, acquire, cleanup, commit, registry, lease };
};

describe("ConsentLeaseRegistry", () => {
  it("publishes immutable readiness before release and holds the lock awaiting consent", async () => {
    const f = setup();
    const ready = await f.lease.ready;
    expect(ready).toEqual({ packageName: "safe-package", expiresAt: 901_000 });
    expect(Object.isFrozen(ready)).toBe(true);
    expect(f.lock.held).toBe(true);
    expect(f.lock.releases).toBe(0);
    await f.lease.cancel();
  });
  it("accepts once, commits inside the owner callback, cleans once, and releases afterward", async () => {
    const f = setup({
      commit: async (payload) => {
        expect(f.lock.held).toBe(true);
        expect(f.lock.releases).toBe(0);
        return `ok:${payload}`;
      },
    });
    await f.lease.ready;
    await expect(f.lease.accept("yes")).resolves.toBe("ok:yes");
    expect(f.commit).toHaveBeenCalledOnce();
    expect(f.cleanup).toHaveBeenCalledOnce();
    expect(f.lock.releases).toBe(1);
  });
  it("cancel skips commit, cleans once, releases, and clears its timer", async () => {
    const f = setup();
    await f.lease.ready;
    await expect(f.lease.cancel()).resolves.toBeUndefined();
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.cleanup).toHaveBeenCalledOnce();
    expect(f.lock.releases).toBe(1);
    expect(f.scheduler.timers.size).toBe(0);
  });
  it("expires deterministically after exactly 15 minutes without commit", async () => {
    const f = setup();
    await f.lease.ready;
    f.scheduler.advance(899_999);
    expect(f.lock.held).toBe(true);
    f.scheduler.advance(1);
    await expect(f.lease.terminal).rejects.toThrow("package_permission_denied");
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.cleanup).toHaveBeenCalledOnce();
    expect(f.lock.releases).toBe(1);
    expect(f.scheduler.timers.size).toBe(0);
  });
  it("maps acquisition failure to a fully sanitized error and cleans owned staging once", async () => {
    const secret = "acquisition-token-938",
      path = "/private/stage-acquisition-938";
    const f = setup({
      acquire: async () => {
        throw new Error(`failed ${secret} ${path}`);
      },
    });
    const readyError = await caught(f.lease.ready),
      terminalError = await caught(f.lease.terminal);
    expectSafeError(readyError, "package_download_failed", [secret, path]);
    expectSafeError(terminalError, "package_download_failed", [secret, path]);
    expect(f.cleanup).toHaveBeenCalledOnce();
    expect(f.lock.releases).toBe(1);
    expect(f.registry.has("op")).toBe(false);
    expect(f.scheduler.timers.size).toBe(0);
  });
  it("sanitizes a static inspection failure after acquisition and releases all owned resources", async () => {
    const secret = "inspection-secret-741",
      path = "/private/staged-inspection-741";
    const scheduler = new Scheduler(),
      lock = new FakeLock(),
      cleanup = vi.fn(async () => undefined),
      commit = vi.fn(async () => "never");
    const registry = new ConsentLeaseRegistry({
      lock,
      scheduler,
      clock: () => scheduler.now,
    });
    const lease = registry.start({
      operationId: "inspect-fail",
      acquire: async () => ({ packageName: "safe" }),
      inspect: () => {
        throw new Error(`${secret} at ${path}`);
      },
      accept: commit,
      cleanup,
    });
    const readyError = await caught(lease.ready),
      terminalError = await caught(lease.terminal);
    expectSafeError(readyError, "package_manifest_invalid", [secret, path]);
    expectSafeError(terminalError, "package_manifest_invalid", [secret, path]);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(commit).not.toHaveBeenCalled();
    expect(lock.releases).toBe(1);
    expect(registry.has("inspect-fail")).toBe(false);
    expect(scheduler.timers.size).toBe(0);
  });
  it("maps lock acquisition failure without cleaning an unowned staging path or retaining its cause", async () => {
    const secret = "lock-secret-529",
      path = "/secret/lock-529";
    const lock = new FakeLock();
    lock.failAcquire = true;
    lock.runExclusive = async () => {
      throw new Error(`${secret} ${path}`);
    };
    const f = setup({ lock });
    const readyError = await caught(f.lease.ready),
      terminalError = await caught(f.lease.terminal);
    expectSafeError(readyError, "package_busy", [secret, path]);
    expectSafeError(terminalError, "package_busy", [secret, path]);
    expect(f.acquire).not.toHaveBeenCalled();
    expect(f.cleanup).not.toHaveBeenCalled();
    expect(f.registry.has("op")).toBe(false);
  });
  it("rejects duplicate and late terminal commands and never commits twice", async () => {
    const f = setup();
    await f.lease.ready;
    const first = f.lease.accept("one");
    await expect(f.lease.accept("two")).rejects.toThrow("package_busy");
    await expect(f.lease.cancel()).rejects.toThrow("package_busy");
    await expect(first).resolves.toBe("installed:one");
    expect(f.commit).toHaveBeenCalledOnce();
  });
  it("gives accept-vs-cancel and accept-vs-expiry races exactly one winner", async () => {
    const a = setup();
    await a.lease.ready;
    const accepted = a.lease.accept("one");
    await expect(a.lease.cancel()).rejects.toThrow("package_busy");
    await accepted;
    expect(a.commit).toHaveBeenCalledOnce();
    const b = setup();
    await b.lease.ready;
    b.scheduler.advance(900_000);
    await expect(b.lease.accept("late")).rejects.toThrow("package_busy");
    await expect(b.lease.terminal).rejects.toThrow("package_permission_denied");
    expect(b.commit).not.toHaveBeenCalled();
  });
  it("prevents commit when the owner lock is compromised before acceptance", async () => {
    const f = setup();
    await f.lease.ready;
    f.lock.compromised = true;
    await expect(f.lease.accept("yes")).rejects.toThrow("package_busy");
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.cleanup).toHaveBeenCalledOnce();
  });
  it("sanitizes commit failures without exposing their cause", async () => {
    const secret = "commit-secret-862",
      path = "/private/commit-862";
    const f = setup({
      commit: async () => {
        throw new Error(`${secret} ${path}`);
      },
    });
    await f.lease.ready;
    const acceptError = await caught(f.lease.accept("yes")),
      terminalError = await caught(f.lease.terminal);
    expectSafeError(acceptError, "package_install_failed", [secret, path]);
    expectSafeError(terminalError, "package_install_failed", [secret, path]);
    expect(f.commit).toHaveBeenCalledOnce();
    expect(f.cleanup).toHaveBeenCalledOnce();
    expect(f.lock.releases).toBe(1);
  });
  it("removes terminal workflows and rejects unknown operation IDs", async () => {
    const f = setup();
    await f.lease.ready;
    expect(f.registry.has("op")).toBe(true);
    await f.registry.cancel("op");
    expect(f.registry.has("op")).toBe(false);
    await expect(f.registry.accept("missing", "x")).rejects.toThrow(
      "package_busy",
    );
  });
  it("delivers one typed terminal outcome before cleanup", async () => {
    const order: string[] = [],
      scheduler = new Scheduler(),
      lock = new FakeLock();
    const terminal = vi.fn(async (outcome) => {
      order.push(
        `terminal:${outcome.reason}:${"code" in outcome ? outcome.code : "none"}`,
      );
    });
    const cleanup = vi.fn(async () => {
      order.push("cleanup");
    });
    const registry = new ConsentLeaseRegistry({
      lock,
      scheduler,
      clock: () => scheduler.now,
    });
    const lease = registry.start({
      operationId: "terminal",
      acquire: async () => ({ ok: true }),
      inspect: (value) => value,
      accept: async () => "done",
      terminal,
      cleanup,
    });
    await lease.ready;
    await lease.cancel();
    expect(terminal).toHaveBeenCalledOnce();
    expect(order).toEqual([
      "terminal:cancelled:package_permission_denied",
      "cleanup",
    ]);
  });
  it("passes the same healthy owner to the accept callback", async () => {
    const scheduler = new Scheduler(),
      lock = new FakeLock(),
      accept = vi.fn(
        async (
          _payload: string,
          _value: object,
          owner: { assertHealthy(): void },
        ) => {
          owner.assertHealthy();
          return "done";
        },
      );
    const registry = new ConsentLeaseRegistry({
      lock,
      scheduler,
      clock: () => scheduler.now,
    });
    const lease = registry.start({
      operationId: "owner",
      acquire: async () => ({}),
      inspect: (value) => value,
      accept,
      cleanup: async () => undefined,
    });
    await lease.ready;
    await lease.accept("yes");
    expect(accept).toHaveBeenCalledOnce();
  });
  it("keeps a second workflow out of acquisition while the first awaits consent", async () => {
    const scheduler = new Scheduler(),
      lock = new FakeLock(),
      registry = new ConsentLeaseRegistry({
        lock,
        scheduler,
        clock: () => scheduler.now,
      });
    const firstAcquire = vi.fn(async () => ({ id: 1 })),
      secondAcquire = vi.fn(async () => ({ id: 2 }));
    const options = (
      operationId: string,
      acquire: () => Promise<{ id: number }>,
    ) => ({
      operationId,
      acquire,
      inspect: (x: { id: number }) => x,
      accept: async () => "ok",
      cleanup: async () => undefined,
    });
    const first = registry.start(options("one", firstAcquire));
    await first.ready;
    const second = registry.start(options("two", secondAcquire));
    await flush();
    expect(secondAcquire).not.toHaveBeenCalled();
    await first.cancel();
    await second.ready;
    expect(secondAcquire).toHaveBeenCalledOnce();
    await second.cancel();
  });
});
