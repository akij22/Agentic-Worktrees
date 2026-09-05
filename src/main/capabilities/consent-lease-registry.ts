import {
  packageErrorCodeSchema,
  type PackageErrorCode,
} from "../../shared/packages/schemas";

export type ConsentLeasePhase = "pending" | "verifying" | "committing";
export interface PackageLockOwner {
  assertHealthy(): void;
  setPhase?(phase: ConsentLeasePhase): void;
}
export interface ExclusivePackageLock {
  runExclusive<T>(task: (owner: PackageLockOwner) => Promise<T>): Promise<T>;
}
export interface ConsentLeaseScheduler {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}
export type ConsentLeaseTerminalOutcome =
  | Readonly<{ reason: "completed" }>
  | Readonly<{
      reason: "cancelled" | "expired" | "failed";
      code: PackageErrorCode;
    }>;
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
  inspect(
    acquired: Acquired,
    timing: Readonly<{ expiresAt: number }>,
  ): Inspection | Promise<Inspection>;
  accept(
    payload: Payload,
    acquired: Acquired,
    owner: PackageLockOwner,
  ): Promise<Result>;
  terminal?(outcome: ConsentLeaseTerminalOutcome): void | Promise<void>;
  cleanup(): Promise<void>;
  onCancel?(): void;
}
interface RegistryOptions {
  lock: ExclusivePackageLock;
  scheduler: ConsentLeaseScheduler;
  clock: () => number;
  timeoutMs?: number;
}
type Command<Payload> =
  | { kind: "accept"; payload: Payload }
  | { kind: "cancel" }
  | { kind: "expiry" };
export class LeaseError extends Error {
  readonly code: PackageErrorCode;
  constructor(code: PackageErrorCode) {
    super(code);
    this.name = "LeaseError";
    this.code = packageErrorCodeSchema.parse(code);
  }
}
const safeError = (code: PackageErrorCode) => new LeaseError(code);
const safeCode = (
  error: unknown,
  fallback: PackageErrorCode,
): PackageErrorCode => {
  const candidate =
    error instanceof LeaseError
      ? error.code
      : error instanceof Error
        ? error.message
        : undefined;
  const parsed = packageErrorCodeSchema.safeParse(candidate);
  return parsed.success ? parsed.data : fallback;
};
const freeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>))
      freeze(child);
    Object.freeze(value);
  }
  return value;
};
const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void,
    reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

export class ConsentLeaseRegistry {
  private readonly workflows = new Map<
    string,
    ConsentLease<unknown, unknown, unknown>
  >();
  private readonly timeoutMs: number;
  constructor(private readonly options: RegistryOptions) {
    this.timeoutMs = options.timeoutMs ?? 900_000;
  }
  has(operationId: string): boolean {
    return this.workflows.has(operationId);
  }
  start<Acquired, Inspection, Payload, Result>(
    options: StartOptions<Acquired, Inspection, Payload, Result>,
  ): ConsentLease<Inspection, Payload, Result> {
    if (this.workflows.has(options.operationId))
      throw safeError("package_busy");
    const ready = deferred<Readonly<Inspection>>(),
      command = deferred<Command<Payload>>();
    let commandChosen = false,
      cancelRequested = false,
      phase: ConsentLeasePhase = "pending",
      timer: unknown,
      entered = false;
    let resolveAccept: ((result: Result) => void) | undefined,
      rejectAccept: ((error: unknown) => void) | undefined;
    let resolveCancel: (() => void) | undefined,
      rejectCancel: ((error: unknown) => void) | undefined;
    const choose = (next: Command<Payload>) => {
      if (next.kind === "cancel") {
        if (phase === "committing" || (commandChosen && phase === "pending"))
          throw safeError("package_busy");
        cancelRequested = true;
        options.onCancel?.();
        if (!commandChosen) {
          commandChosen = true;
          command.resolve(next);
        }
        return;
      }
      if (commandChosen) throw safeError("package_busy");
      commandChosen = true;
      command.resolve(next);
    };
    const ownerTask = this.options.lock
      .runExclusive(async (owner) => {
        entered = true;
        let acquired: Acquired | undefined;
        let outcome: ConsentLeaseTerminalOutcome = freeze({
          reason: "failed" as const,
          code: "package_download_failed" as const,
        });
        try {
          try {
            acquired = await options.acquire();
          } catch (error) {
            throw safeError(safeCode(error, "package_download_failed"));
          }
          try {
            ready.resolve(
              freeze(
                await options.inspect(
                  acquired,
                  freeze({ expiresAt: this.options.clock() + this.timeoutMs }),
                ),
              ),
            );
          } catch (error) {
            throw safeError(safeCode(error, "package_manifest_invalid"));
          }
          timer = this.options.scheduler.setTimeout(() => {
            if (!commandChosen) {
              commandChosen = true;
              command.resolve({ kind: "expiry" });
            }
          }, this.timeoutMs);
          const selected = await command.promise;
          if (selected.kind === "cancel") {
            outcome = freeze({
              reason: "cancelled" as const,
              code: "package_permission_denied" as const,
            });
            return undefined;
          }
          if (selected.kind === "expiry") {
            outcome = freeze({
              reason: "expired" as const,
              code: "package_permission_denied" as const,
            });
            throw safeError("package_permission_denied");
          }
          try {
            owner.assertHealthy();
          } catch {
            throw safeError("package_busy");
          }
          try {
            const result = await options.accept(selected.payload, acquired, {
              ...owner,
              setPhase: (next) => {
                phase = next;
                owner.setPhase?.(next);
              },
            });
            outcome = freeze({ reason: "completed" });
            return result;
          } catch (error) {
            throw safeError(safeCode(error, "package_install_failed"));
          }
        } catch (error) {
          const safe =
            error instanceof LeaseError
              ? error
              : safeError("package_install_failed");
          if (cancelRequested) {
            outcome = freeze({
              reason: "cancelled" as const,
              code: "package_permission_denied" as const,
            });
            throw safeError("package_permission_denied");
          } else if (outcome.reason !== "expired")
            outcome = freeze({ reason: "failed", code: safe.code });
          throw safe;
        } finally {
          if (timer !== undefined) this.options.scheduler.clearTimeout(timer);
          try {
            await options.terminal?.(outcome);
          } finally {
            await options.cleanup();
          }
        }
      })
      .catch((error) => {
        const safe =
          error instanceof LeaseError ? error : safeError("package_busy");
        ready.reject(safe);
        throw safe;
      });
    const lease: ConsentLease<Inspection, Payload, Result> = {
      operationId: options.operationId,
      ready: ready.promise,
      terminal: ownerTask,
      accept: (payload) => {
        try {
          choose({ kind: "accept", payload });
        } catch (error) {
          return Promise.reject(error);
        }
        return new Promise<Result>((resolve, reject) => {
          resolveAccept = resolve;
          rejectAccept = reject;
        });
      },
      cancel: () => {
        try {
          choose({ kind: "cancel" });
        } catch (error) {
          return Promise.reject(error);
        }
        return new Promise<void>((resolve, reject) => {
          resolveCancel = resolve;
          rejectCancel = reject;
        });
      },
    };
    this.workflows.set(
      options.operationId,
      lease as ConsentLease<unknown, unknown, unknown>,
    );
    ownerTask.then(
      (result) => {
        this.workflows.delete(options.operationId);
        resolveAccept?.(result as Result);
        resolveCancel?.();
      },
      (error) => {
        this.workflows.delete(options.operationId);
        rejectAccept?.(error);
        rejectCancel?.(error);
      },
    );
    void ownerTask.catch(() => undefined);
    void ready.promise.catch(() => undefined);
    // A synchronous lock implementation can reject before registration; the observer still removes it.
    if (!entered) void ownerTask.catch(() => undefined);
    return lease;
  }
  accept<Payload, Result>(
    operationId: string,
    payload: Payload,
  ): Promise<Result> {
    const lease = this.workflows.get(operationId);
    return lease
      ? (lease.accept(payload) as Promise<Result>)
      : Promise.reject(safeError("package_busy"));
  }
  cancel(operationId: string): Promise<void> {
    const lease = this.workflows.get(operationId);
    return lease ? lease.cancel() : Promise.reject(safeError("package_busy"));
  }
}
