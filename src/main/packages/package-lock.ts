import { randomUUID } from "node:crypto";
import type { FileHandle } from "node:fs/promises";
import { lstat, mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";

interface LockOwner { pid: number; acquiredAt: number; ownerToken: string }
interface LockOptions { retryMs?: number; timeoutMs?: number; writeOwner?: (handle: FileHandle, owner: LockOwner) => Promise<void> }
const STALE_MS = 60_000;
export class PackageLock {
	private queue: Promise<void> = Promise.resolve();
	constructor(private readonly lockPath: string, private readonly options: LockOptions = {}) {}
	async runExclusive<T>(task: () => Promise<T>): Promise<T> {
		const previous = this.queue; let releaseQueue!: () => void;
		this.queue = new Promise<void>(resolve => { releaseQueue = resolve; });
		await previous; let owner: LockOwner | undefined;
		try { owner = await this.acquireFile(); return await task(); }
		finally { try { if (owner) await this.releaseOwned(owner); } finally { releaseQueue(); } }
	}
	private async acquireFile(): Promise<LockOwner> {
		await mkdir(dirname(this.lockPath), { recursive: true, mode: 0o700 });
		const started = Date.now(), retry = this.options.retryMs ?? 25, timeout = this.options.timeoutMs ?? 5_000;
		for (;;) {
			const owner = { pid: process.pid, acquiredAt: Date.now(), ownerToken: randomUUID() };
			let handle: FileHandle | undefined;
			try {
				handle = await open(this.lockPath, "wx", 0o600);
				await (this.options.writeOwner ?? writeOwner)(handle, owner);
				return owner;
			} catch (error) {
				if (handle) await this.removeCreatedFile(handle);
				if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
				if (await this.quarantineIfStale()) continue;
				if (Date.now() - started >= timeout) throw new Error("Timed out waiting for package lock");
				await new Promise(resolve => setTimeout(resolve, retry));
			} finally { if (handle) await handle.close().catch(() => undefined); }
		}
	}
	private async removeCreatedFile(handle: FileHandle): Promise<void> {
		try { const opened = await handle.stat(); const current = await lstat(this.lockPath); if (opened.dev === current.dev && opened.ino === current.ino) await rm(this.lockPath); } catch { /* best-effort cleanup; never remove an unverified path */ }
	}
	private async releaseOwned(owner: LockOwner): Promise<void> {
		const current = await readOwner(this.lockPath); if (!current || current.ownerToken !== owner.ownerToken) return;
		const quarantine = `${this.lockPath}.release-${owner.ownerToken}`;
		try { await rename(this.lockPath, quarantine); const moved = await readOwner(quarantine); if (moved?.ownerToken === owner.ownerToken) await rm(quarantine, { force: true }); }
		catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
	}
	private async quarantineIfStale(): Promise<boolean> {
		let owner: LockOwner | undefined; let stale = false;
		try {
			owner = await readOwner(this.lockPath);
			if (owner) stale = Date.now() - owner.acquiredAt > STALE_MS && !isAlive(owner.pid);
			else stale = Date.now() - (await stat(this.lockPath)).mtimeMs > STALE_MS;
		} catch (error) { return (error as NodeJS.ErrnoException).code === "ENOENT"; }
		if (!stale) return false;
		const expectedToken = owner?.ownerToken; const quarantine = `${this.lockPath}.stale-${randomUUID()}`;
		try {
			await rename(this.lockPath, quarantine); const moved = await readOwner(quarantine);
			if (expectedToken ? moved?.ownerToken !== expectedToken : moved !== undefined) return true;
			await rm(quarantine, { force: true }); return true;
		} catch (error) { return (error as NodeJS.ErrnoException).code === "ENOENT"; }
	}
}
async function writeOwner(handle: FileHandle, owner: LockOwner): Promise<void> { await handle.writeFile(JSON.stringify(owner)); await handle.sync(); }
async function readOwner(path: string): Promise<LockOwner | undefined> { try { const value = JSON.parse(await readFile(path, "utf8")) as Partial<LockOwner>; return Number.isInteger(value.pid) && typeof value.acquiredAt === "number" && typeof value.ownerToken === "string" ? value as LockOwner : undefined; } catch { return undefined; } }
function isAlive(pid: number): boolean { try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; } }
