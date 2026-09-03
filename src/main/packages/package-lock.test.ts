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
	it("maps lease compromise and still invokes owner release", async () => {
		const release = vi.fn(async () => undefined); const gate = deferred();
		const adapter: PackageLockAdapter = { lock: vi.fn(async (_path, options) => { queueMicrotask(() => options.onCompromised(new Error("lost"))); return release; }) };
		await expect(new PackageLock("/managed/lock", { adapter }).runExclusive(() => gate.promise)).rejects.toThrow("package lock"); expect(release).toHaveBeenCalledOnce();
	});
});
