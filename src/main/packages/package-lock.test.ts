import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PackageLock } from "./package-lock";

describe("PackageLock", () => {
	it("serializes contenders", async () => {
		const lock = new PackageLock(join(await mkdtemp(join(tmpdir(), "lock-")), "global.lock"));
		const order: string[] = [];
		await Promise.all([lock.runExclusive(async () => { order.push("a1"); await new Promise(r => setTimeout(r, 20)); order.push("a2"); }), lock.runExclusive(async () => { order.push("b"); })]);
		expect(order).toEqual(["a1", "a2", "b"]);
	});
	it("recovers stale dead locks but not recent ones", async () => {
		const path = join(await mkdtemp(join(tmpdir(), "lock-")), "global.lock");
		await writeFile(path, JSON.stringify({ pid: 99999999, acquiredAt: Date.now() - 61_000 }));
		await expect(new PackageLock(path).runExclusive(async () => "ok")).resolves.toBe("ok");
		await writeFile(path, JSON.stringify({ pid: 99999999, acquiredAt: Date.now() }));
		await expect(new PackageLock(path, { retryMs: 2, timeoutMs: 10 }).runExclusive(async () => "no")).rejects.toThrow("lock");
	});
});
