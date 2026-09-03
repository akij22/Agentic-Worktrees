import lockfile, { type LockOptions } from "proper-lockfile";

export interface PackageLockAdapter { lock(path: string, options: LockOptions): Promise<() => Promise<void>> }
interface PackageLockOptions { retryMs?: number; timeoutMs?: number; adapter?: PackageLockAdapter }
const defaultAdapter: PackageLockAdapter = { lock: (path, options) => lockfile.lock(path, options) };
const safeLockError = (cause: unknown) => new Error("Unable to acquire or maintain package lock safely", { cause });

export class PackageLock {
	private queue: Promise<void> = Promise.resolve();
	constructor(private readonly lockPath: string, private readonly options: PackageLockOptions = {}) {}
	async runExclusive<T>(task: () => Promise<T>): Promise<T> {
		const previous = this.queue; let releaseQueue!: () => void;
		this.queue = new Promise<void>(resolve => { releaseQueue = resolve; }); await previous;
		let release: (() => Promise<void>) | undefined; let rejectCompromise!: (error: Error) => void;
		const compromised = new Promise<never>((_, reject) => { rejectCompromise = reject; });
		try {
			const retryMs = Math.max(1, this.options.retryMs ?? 25), timeoutMs = Math.max(0, this.options.timeoutMs ?? 5_000);
			try {
				release = await (this.options.adapter ?? defaultAdapter).lock(this.lockPath, {
					realpath: false, stale: 60_000, update: 20_000,
					retries: { retries: Math.floor(timeoutMs / retryMs), factor: 1, minTimeout: retryMs, maxTimeout: retryMs, randomize: false },
					onCompromised: error => rejectCompromise(safeLockError(error)),
				});
			} catch (error) { throw safeLockError(error); }
			return await Promise.race([task(), compromised]);
		} finally {
			try { if (release) await release(); } finally { releaseQueue(); }
		}
	}
}
