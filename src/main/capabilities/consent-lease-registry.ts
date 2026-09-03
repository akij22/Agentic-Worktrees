export interface PackageLockOwner {
  assertHealthy(): void;
}

export interface ExclusivePackageLock {
  runExclusive<T>(task: (owner: PackageLockOwner) => Promise<T>): Promise<T>;
}

export interface ConsentLeaseScheduler {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface ConsentLease<Inspection, Payload, Result> {
  readonly operationId: string;
  readonly ready: Promise<Readonly<Inspection>>;
  readonly terminal: Promise<Result | undefined>;
  accept(payload: Payload): Promise<Result>;
  cancel(): Promise<void>;
}

interface StartOptions<Acquired, Inspection, Payload, Result> {
  operationId: string;
  acquire(): Promise<Acquired>;
  inspect(acquired: Acquired, timing: Readonly<{ expiresAt: number }>): Inspection;
  accept(payload: Payload, acquired: Acquired): Promise<Result>;
  cleanup(): Promise<void>;
}

interface RegistryOptions {
  lock: ExclusivePackageLock;
  scheduler: ConsentLeaseScheduler;
  clock: () => number;
  timeoutMs?: number;
}

type Command<Payload> = { kind: "accept"; payload: Payload } | { kind: "cancel" } | { kind: "expiry" };
export class LeaseError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = "LeaseError"; this.code = code; }
}
const safeError = (code: string) => new LeaseError(code);
const freeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void, reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

export class ConsentLeaseRegistry {
  private readonly workflows = new Map<string, ConsentLease<unknown, unknown, unknown>>();
  private readonly timeoutMs: number;
  constructor(private readonly options: RegistryOptions) { this.timeoutMs = options.timeoutMs ?? 900_000; }

  has(operationId: string) { return this.workflows.has(operationId); }

  start<Acquired, Inspection, Payload, Result>(options: StartOptions<Acquired, Inspection, Payload, Result>): ConsentLease<Inspection, Payload, Result> {
    if (this.workflows.has(options.operationId)) throw safeError("package_operation_exists");
    const ready = deferred<Readonly<Inspection>>(), command = deferred<Command<Payload>>();
    let commandChosen = false, timer: unknown;
    let resolveAccept: ((result: Result) => void) | undefined, rejectAccept: ((error: unknown) => void) | undefined;
    let resolveCancel: (() => void) | undefined, rejectCancel: ((error: unknown) => void) | undefined;

    const choose = (next: Command<Payload>) => {
      if (commandChosen) throw safeError("package_operation_terminal");
      commandChosen = true; command.resolve(next);
    };

    const ownerTask = this.options.lock.runExclusive(async owner => {
      let acquired: Acquired | undefined;
      try {
        try {
          acquired = await options.acquire();
          const inspection = freeze(options.inspect(acquired, freeze({ expiresAt: this.options.clock() + this.timeoutMs })));
          ready.resolve(inspection);
        }
        catch { const safe = safeError("package_inspection_failed"); ready.reject(safe); throw safe; }
        timer = this.options.scheduler.setTimeout(() => { if (!commandChosen) { commandChosen = true; command.resolve({ kind: "expiry" }); } }, this.timeoutMs);
        const selected = await command.promise;
        if (selected.kind === "cancel") return undefined;
        if (selected.kind === "expiry") throw safeError("package_consent_expired");
        try { owner.assertHealthy(); }
        catch { throw safeError("package_lock_failed"); }
        try { return await options.accept(selected.payload, acquired); }
        catch { throw safeError("package_commit_failed"); }
      } finally {
        if (timer !== undefined) this.options.scheduler.clearTimeout(timer);
        await options.cleanup();
      }
    }).catch(error => {
      const safe = error instanceof LeaseError ? error : safeError("package_lock_failed");
      ready.reject(safe);
      throw safe;
    });

    const lease: ConsentLease<Inspection, Payload, Result> = {
      operationId: options.operationId,
      ready: ready.promise,
      terminal: ownerTask,
      accept: (payload: Payload) => {
        try { choose({ kind: "accept", payload }); }
        catch (error) { return Promise.reject(error); }
        return new Promise<Result>((resolve, reject) => { resolveAccept = resolve; rejectAccept = reject; });
      },
      cancel: () => {
        try { choose({ kind: "cancel" }); }
        catch (error) { return Promise.reject(error); }
        return new Promise<void>((resolve, reject) => { resolveCancel = resolve; rejectCancel = reject; });
      },
    };
    this.workflows.set(options.operationId, lease as ConsentLease<unknown, unknown, unknown>);
    ownerTask.then(result => {
      this.workflows.delete(options.operationId);
      if (resolveAccept) resolveAccept(result as Result);
      if (resolveCancel) resolveCancel();
    }, error => {
      this.workflows.delete(options.operationId);
      rejectAccept?.(error); rejectCancel?.(error);
    });
    void ownerTask.catch(() => undefined);
    void ready.promise.catch(() => undefined);
    return lease;
  }

  accept<Payload, Result>(operationId: string, payload: Payload): Promise<Result> {
    const lease = this.workflows.get(operationId);
    if (!lease) return Promise.reject(safeError("package_operation_unknown"));
    return lease.accept(payload) as Promise<Result>;
  }

  cancel(operationId: string): Promise<void> {
    const lease = this.workflows.get(operationId);
    if (!lease) return Promise.reject(safeError("package_operation_unknown"));
    return lease.cancel();
  }
}
