import { describe, expect, it, vi } from "vitest";
import { ConsentLeaseRegistry, type ConsentLeaseScheduler, type ExclusivePackageLock } from "./consent-lease-registry";

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
class Scheduler implements ConsentLeaseScheduler {
  now = 1_000; private next = 1; readonly timers = new Map<number, { at: number; run: () => void }>();
  setTimeout(run: () => void, delayMs: number) { const id = this.next++; this.timers.set(id, { at: this.now + delayMs, run }); return id; }
  clearTimeout(id: unknown) { this.timers.delete(id as number); }
  advance(ms: number) { this.now += ms; for (const [id, timer] of [...this.timers]) if (timer.at <= this.now) { this.timers.delete(id); timer.run(); } }
}
class FakeLock implements ExclusivePackageLock {
  held = false; enters = 0; releases = 0; failAcquire = false; compromised = false;
  async runExclusive<T>(task: (owner: { assertHealthy(): void }) => Promise<T>) { if (this.failAcquire) throw new Error("/secret/lock busy"); while (this.held) await new Promise<void>(resolve => queueMicrotask(resolve)); this.held = true; this.enters++; try { const result = await task({ assertHealthy: () => { if (this.compromised) throw new Error("lost /secret/lock"); } }); if (this.compromised) throw new Error("lost /secret/lock"); return result; } finally { this.held = false; this.releases++; } }
}
const setup = (overrides: Partial<{ lock: FakeLock; acquire: () => Promise<{ packageName: string }>; cleanup: () => Promise<void>; commit: (payload: string) => Promise<string> }> = {}) => {
  const scheduler = new Scheduler(), lock = overrides.lock ?? new FakeLock();
  const acquire = vi.fn(overrides.acquire ?? (async () => ({ packageName: "safe-package" })));
  const cleanup = vi.fn(overrides.cleanup ?? (async () => undefined));
  const commit = vi.fn(overrides.commit ?? (async payload => `installed:${payload}`));
  const registry = new ConsentLeaseRegistry({ lock, scheduler, clock: () => scheduler.now, timeoutMs: 900_000 });
  const lease = registry.start({ operationId: "op", acquire, inspect: (value, timing) => ({ ...value, expiresAt: timing.expiresAt }), accept: commit, cleanup });
  return { scheduler, lock, acquire, cleanup, commit, registry, lease };
};

describe("ConsentLeaseRegistry", () => {
  it("publishes immutable readiness before release and holds the lock awaiting consent", async () => { const f = setup(); const ready = await f.lease.ready; expect(ready).toEqual({ packageName: "safe-package", expiresAt: 901_000 }); expect(Object.isFrozen(ready)).toBe(true); expect(f.lock.held).toBe(true); expect(f.lock.releases).toBe(0); await f.lease.cancel(); });
  it("accepts once, commits inside the owner callback, cleans once, and releases afterward", async () => { const f = setup({ commit: async payload => { expect(f.lock.held).toBe(true); expect(f.lock.releases).toBe(0); return `ok:${payload}`; } }); await f.lease.ready; await expect(f.lease.accept("yes")).resolves.toBe("ok:yes"); expect(f.commit).toHaveBeenCalledOnce(); expect(f.cleanup).toHaveBeenCalledOnce(); expect(f.lock.releases).toBe(1); });
  it("cancel skips commit, cleans once, releases, and clears its timer", async () => { const f = setup(); await f.lease.ready; await expect(f.lease.cancel()).resolves.toBeUndefined(); expect(f.commit).not.toHaveBeenCalled(); expect(f.cleanup).toHaveBeenCalledOnce(); expect(f.lock.releases).toBe(1); expect(f.scheduler.timers.size).toBe(0); });
  it("expires deterministically after exactly 15 minutes without commit", async () => { const f = setup(); await f.lease.ready; f.scheduler.advance(899_999); expect(f.lock.held).toBe(true); f.scheduler.advance(1); await expect(f.lease.terminal).rejects.toThrow("package_consent_expired"); expect(f.commit).not.toHaveBeenCalled(); expect(f.cleanup).toHaveBeenCalledOnce(); expect(f.lock.releases).toBe(1); expect(f.scheduler.timers.size).toBe(0); });
  it("maps acquisition/inspection failure to a stable path-free error and cleans owned staging once", async () => { const f = setup({ acquire: async () => { throw new Error("failed /private/stage"); } }); await expect(f.lease.ready).rejects.toThrow("package_inspection_failed"); await expect(f.lease.terminal).rejects.toThrow("package_inspection_failed"); expect(f.cleanup).toHaveBeenCalledOnce(); expect(f.lock.releases).toBe(1); expect(JSON.stringify(await f.lease.terminal.catch(e => e.message))).not.toContain("/private"); });
  it("maps lock acquisition failure without cleaning an unowned staging path", async () => { const lock = new FakeLock(); lock.failAcquire = true; const f = setup({ lock }); await expect(f.lease.ready).rejects.toThrow("package_lock_failed"); await expect(f.lease.terminal).rejects.toThrow("package_lock_failed"); expect(f.acquire).not.toHaveBeenCalled(); expect(f.cleanup).not.toHaveBeenCalled(); });
  it("rejects duplicate and late terminal commands and never commits twice", async () => { const f = setup(); await f.lease.ready; const first = f.lease.accept("one"); await expect(f.lease.accept("two")).rejects.toThrow("package_operation_terminal"); await expect(f.lease.cancel()).rejects.toThrow("package_operation_terminal"); await expect(first).resolves.toBe("installed:one"); expect(f.commit).toHaveBeenCalledOnce(); });
  it("gives accept-vs-cancel and accept-vs-expiry races exactly one winner", async () => { const a = setup(); await a.lease.ready; const accepted = a.lease.accept("one"); await expect(a.lease.cancel()).rejects.toThrow("package_operation_terminal"); await accepted; expect(a.commit).toHaveBeenCalledOnce(); const b = setup(); await b.lease.ready; b.scheduler.advance(900_000); await expect(b.lease.accept("late")).rejects.toThrow("package_operation_terminal"); await expect(b.lease.terminal).rejects.toThrow("package_consent_expired"); expect(b.commit).not.toHaveBeenCalled(); });
  it("prevents commit when the owner lock is compromised before acceptance", async () => { const f = setup(); await f.lease.ready; f.lock.compromised = true; await expect(f.lease.accept("yes")).rejects.toThrow("package_lock_failed"); expect(f.commit).not.toHaveBeenCalled(); expect(f.cleanup).toHaveBeenCalledOnce(); });
  it("removes terminal workflows and rejects unknown operation IDs", async () => { const f = setup(); await f.lease.ready; expect(f.registry.has("op")).toBe(true); await f.registry.cancel("op"); expect(f.registry.has("op")).toBe(false); await expect(f.registry.accept("missing", "x")).rejects.toThrow("package_operation_unknown"); });
  it("keeps a second workflow out of acquisition while the first awaits consent", async () => { const scheduler = new Scheduler(), lock = new FakeLock(), registry = new ConsentLeaseRegistry({ lock, scheduler, clock: () => scheduler.now }); const firstAcquire = vi.fn(async () => ({ id: 1 })), secondAcquire = vi.fn(async () => ({ id: 2 })); const options = (operationId: string, acquire: () => Promise<{ id: number }>) => ({ operationId, acquire, inspect: (x: { id: number }) => x, accept: async () => "ok", cleanup: async () => undefined }); const first = registry.start(options("one", firstAcquire)); await first.ready; const second = registry.start(options("two", secondAcquire)); await flush(); expect(secondAcquire).not.toHaveBeenCalled(); await first.cancel(); await second.ready; expect(secondAcquire).toHaveBeenCalledOnce(); await second.cancel(); });
});
