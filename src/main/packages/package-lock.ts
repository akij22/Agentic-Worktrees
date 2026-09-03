import lockfile, { type LockOptions } from "proper-lockfile";

export interface PackageLockAdapter { lock(path: string, options: LockOptions): Promise<() => Promise<void>> }
export interface PackageLockOwner { assertHealthy(): void }
interface PackageLockOptions {
	retryMs?: number; timeoutMs?: number; adapter?: PackageLockAdapter;
	/** Test-only timing override; proper-lockfile enforces a 2s minimum stale lease. */
	staleMs?: number; updateMs?: number;
}
const defaultAdapter: PackageLockAdapter = { lock: (path, options) => lockfile.lock(path, options) };
const safeLockError = (cause: unknown) => new Error("Unable to acquire or maintain package lock safely", { cause });

export class PackageLock {
	private queue: Promise<void> = Promise.resolve();
	constructor(private readonly lockPath: string, private readonly options: PackageLockOptions = {}) {}
	async runExclusive<T>(task: (owner: PackageLockOwner) => Promise<T>): Promise<T> {
		const previous = this.queue; let releaseQueue!: () => void;
		this.queue = new Promise<void>(resolve => { releaseQueue = resolve; }); await previous;
		let release: (() => Promise<void>) | undefined;
		try {
			const retryMs = Math.max(1, this.options.retryMs ?? 25), timeoutMs = Math.max(0, this.options.timeoutMs ?? 5_000);
			const stale = Math.max(2_000, this.options.staleMs ?? 60_000);
			const update = Math.max(1_000, Math.min(this.options.updateMs ?? 20_000, stale / 2));
			let compromiseError: Error | undefined;
			try {
				release = await (this.options.adapter ?? defaultAdapter).lock(this.lockPath, {
					realpath: false, stale, update,
					retries: { retries: Math.floor(timeoutMs / retryMs), factor: 1, minTimeout: retryMs, maxTimeout: retryMs, randomize: false },
					onCompromised: error => { compromiseError ??= safeLockError(error); },
				});
			} catch (error) { throw safeLockError(error); }
			const owner: PackageLockOwner = { assertHealthy: () => { if (compromiseError) throw compromiseError; } };
			let result: T | undefined; let callbackError: unknown; let callbackFailed = false;
			try { result = await task(owner); } catch (error) { callbackFailed = true; callbackError = error; }
			if (callbackFailed) throw callbackError;
			if (compromiseError) throw compromiseError;
			return result as T;
		} finally {
			try { if (release) await release(); } finally { releaseQueue(); }
		}
	}
}
