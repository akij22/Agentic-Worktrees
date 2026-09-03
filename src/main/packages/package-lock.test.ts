import { mkdtemp, readFile, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PackageLock } from "./package-lock";

describe("PackageLock", () => {
	it("serializes independent contenders", async () => {
		const path = join(await mkdtemp(join(tmpdir(), "lock-")), "global.lock");
		const first = new PackageLock(path, { retryMs: 2 }), second = new PackageLock(path, { retryMs: 2 });
		const order: string[] = [];
		await Promise.all([first.runExclusive(async () => { order.push("a1"); await new Promise(r => setTimeout(r, 20)); order.push("a2"); }), second.runExclusive(async () => { order.push("b"); })]);
		expect(order).toEqual(["a1", "a2", "b"]);
	});
	it("recovers stale dead locks but not recent ones", async () => {
		const path = join(await mkdtemp(join(tmpdir(), "lock-")), "global.lock");
		await writeFile(path, JSON.stringify({ pid: 99999999, acquiredAt: Date.now() - 61_000, ownerToken: "stale" }));
		await expect(new PackageLock(path).runExclusive(async () => "ok")).resolves.toBe("ok");
		await writeFile(path, JSON.stringify({ pid: 99999999, acquiredAt: Date.now(), ownerToken: "recent" }));
		await expect(new PackageLock(path, { retryMs: 2, timeoutMs: 10 }).runExclusive(async () => "no")).rejects.toThrow("lock");
	});
	it("does not recover an old lock owned by the live process", async () => {
		const path = join(await mkdtemp(join(tmpdir(), "lock-")), "global.lock");
		await writeFile(path, JSON.stringify({ pid: process.pid, acquiredAt: Date.now() - 61_000, ownerToken: "live" }));
		await expect(new PackageLock(path, { retryMs: 2, timeoutMs: 10 }).runExclusive(async () => undefined)).rejects.toThrow("lock");
		expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({ ownerToken: "live" });
	});
	it("recovers malformed files only after their filesystem timestamp is stale", async () => {
		const path = join(await mkdtemp(join(tmpdir(), "lock-")), "global.lock");
		await writeFile(path, "{partial");
		await expect(new PackageLock(path, { retryMs: 2, timeoutMs: 10 }).runExclusive(async () => undefined)).rejects.toThrow("lock");
		const stale = new Date(Date.now() - 61_000); await utimes(path, stale, stale);
		await expect(new PackageLock(path).runExclusive(async () => "recovered")).resolves.toBe("recovered");
	});
	it("closes and removes its lock when owner-record writing fails", async () => {
		const path = join(await mkdtemp(join(tmpdir(), "lock-")), "global.lock");
		const failing = new PackageLock(path, { writeOwner: async () => { throw new Error("write failed"); } });
		await expect(failing.runExclusive(async () => undefined)).rejects.toThrow("write failed");
		await expect(new PackageLock(path).runExclusive(async () => "ok")).resolves.toBe("ok");
	});
	it("allows only one contender to recover and preserves the winner's ownership", async () => {
		const path = join(await mkdtemp(join(tmpdir(), "lock-")), "global.lock");
		await writeFile(path, JSON.stringify({ pid: 99999999, acquiredAt: Date.now() - 61_000, ownerToken: "dead" }));
		const active: string[] = []; let running = 0;
		const contender = (name: string) => new PackageLock(path, { retryMs: 1 }).runExclusive(async () => { running++; expect(running).toBe(1); active.push(name); await new Promise(r => setTimeout(r, 10)); running--; });
		await Promise.all([contender("a"), contender("b")]); expect(active).toHaveLength(2);
	});
});
