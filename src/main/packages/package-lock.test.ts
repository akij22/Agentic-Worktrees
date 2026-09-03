import { mkdir, mkdtemp, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PackageLock, type PackageLockAdapter } from "./package-lock";

const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };
describe("PackageLock", () => {
	it("serializes independent real lock instances", async () => {
		const path = join(await mkdtemp(join(tmpdir(), "lock-")), "global"); const gate = deferred(); const entered = deferred(); const order: string[] = [];
		const first = new PackageLock(path, { retryMs: 2, timeoutMs: 1_000 }); const second = new PackageLock(path, { retryMs: 2, timeoutMs: 1_000 });
		const a = first.runExclusive(async () => { order.push("a"); entered.resolve(); await gate.promise; }); await entered.promise;
		const b = second.runExclusive(async () => { order.push("b"); }); await Promise.resolve(); expect(order).toEqual(["a"]); gate.resolve(); await Promise.all([a, b]); expect(order).toEqual(["a", "b"]);
	});
	it("recovers a stale proper-lockfile lease", async () => {
		const path = join(await mkdtemp(join(tmpdir(), "lock-")), "global"); const lockDir = `${path}.lock`; await mkdir(lockDir); const old = new Date(Date.now() - 61_000); await utimes(lockDir, old, old);
		await expect(new PackageLock(path, { retryMs: 2, timeoutMs: 100 }).runExclusive(async () => "ok")).resolves.toBe("ok");
	});
	it("configures a 60 second lease with a live-owner heartbeat", async () => {
		let captured: Record<string, unknown> = {}; const adapter: PackageLockAdapter = { lock: vi.fn(async (_path, options) => { captured = options as unknown as Record<string, unknown>; return async () => undefined; }) };
		await new PackageLock("/managed/lock", { adapter }).runExclusive(async () => undefined);
		expect(captured).toMatchObject({ realpath: false, stale: 60_000, update: 20_000 });
	});
	it("maps failed acquisition and releases its in-process queue for the next attempt", async () => {
		const release = vi.fn(async () => undefined); let attempts = 0;
		const adapter: PackageLockAdapter = { lock: vi.fn(async () => { if (++attempts === 1) throw new Error("busy"); return release; }) }; const lock = new PackageLock("/managed/lock", { adapter });
		await expect(lock.runExclusive(async () => undefined)).rejects.toThrow("package lock");
		await expect(lock.runExclusive(async () => "ok")).resolves.toBe("ok"); expect(release).toHaveBeenCalledOnce();
	});
	it("uses only the owner-bound release callback", async () => {
		const firstRelease = vi.fn(async () => undefined), secondRelease = vi.fn(async () => undefined); let call = 0;
		const adapter: PackageLockAdapter = { lock: vi.fn(async () => (++call === 1 ? firstRelease : secondRelease)) };
		const lock = new PackageLock("/managed/lock", { adapter }); await lock.runExclusive(async () => undefined); expect(firstRelease).toHaveBeenCalledOnce(); expect(secondRelease).not.toHaveBeenCalled();
		await lock.runExclusive(async () => undefined); expect(firstRelease).toHaveBeenCalledOnce(); expect(secondRelease).toHaveBeenCalledOnce();
	});
	it("holds the local queue until a compromised callback settles", async () => {
		const release = vi.fn(async () => undefined), gate = deferred(), entered = deferred(); let compromise!: (error: Error) => void; const order: string[] = [];
		const adapter: PackageLockAdapter = { lock: vi.fn(async (_path, options) => { compromise = options.onCompromised; return release; }) }; const lock = new PackageLock("/managed/lock", { adapter });
		const first = lock.runExclusive(async () => { order.push("first-enter"); entered.resolve(); await gate.promise; order.push("first-exit"); }); await entered.promise; compromise(new Error("lost"));
		const second = lock.runExclusive(async () => { order.push("second-enter"); }); await new Promise<void>(resolve => setImmediate(resolve)); expect(order).toEqual(["first-enter"]); expect(release).not.toHaveBeenCalled();
		gate.resolve(); await expect(first).rejects.toThrow("package lock"); await second; expect(order).toEqual(["first-enter", "first-exit", "second-enter"]); expect(release).toHaveBeenCalledTimes(2);
	});
	it("keeps a real long-lived owner through heartbeat renewal", async () => {
		const path = join(await mkdtemp(join(tmpdir(), "lock-")), "global"); const held = deferred();
		const owner = new PackageLock(path, { staleMs: 2_000, updateMs: 1_000, retryMs: 10, timeoutMs: 5_000 });
		const ownerRun = owner.runExclusive(async () => { held.resolve(); await new Promise(resolve => setTimeout(resolve, 2_500)); }); await held.promise;
		const contender = new PackageLock(path, { staleMs: 2_000, updateMs: 1_000, retryMs: 10, timeoutMs: 250 });
		await expect(contender.runExclusive(async () => "stolen")).rejects.toThrow("package lock"); await ownerRun;
		await expect(contender.runExclusive(async () => "acquired")).resolves.toBe("acquired");
	}, 7_000);
});
