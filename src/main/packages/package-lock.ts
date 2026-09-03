import { mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";

export class PackageLock {
	private queue: Promise<void> = Promise.resolve();
	constructor(private readonly lockPath: string, private readonly options: { retryMs?: number; timeoutMs?: number } = {}) {}
	async runExclusive<T>(task: () => Promise<T>): Promise<T> {
		const previous = this.queue; let releaseQueue!: () => void;
		this.queue = new Promise<void>(resolve => { releaseQueue = resolve; });
		await previous; let acquired = false;
		try { await this.acquireFile(); acquired = true; return await task(); }
		finally { if (acquired) await rm(this.lockPath, { force: true }); releaseQueue(); }
	}
	private async acquireFile(): Promise<void> {
		await mkdir(dirname(this.lockPath), { recursive: true, mode: 0o700 });
		const started = Date.now(), retry = this.options.retryMs ?? 25, timeout = this.options.timeoutMs ?? 5_000;
		for (;;) {
			try { const handle = await open(this.lockPath, "wx", 0o600); await handle.writeFile(JSON.stringify({ pid: process.pid, acquiredAt: Date.now() })); await handle.close(); return; }
			catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
				if (await this.removeIfStale()) continue;
				if (Date.now() - started >= timeout) throw new Error("Timed out waiting for package lock");
				await new Promise(resolve => setTimeout(resolve, retry));
			}
		}
	}
	private async removeIfStale(): Promise<boolean> {
		try {
			const data = JSON.parse(await readFile(this.lockPath, "utf8")) as { pid?: number; acquiredAt?: number };
			if (!data.acquiredAt || Date.now() - data.acquiredAt <= 60_000 || (data.pid && isAlive(data.pid))) return false;
			await rm(this.lockPath); return true;
		} catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return true; return false; }
	}
}
function isAlive(pid: number): boolean { try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; } }
