export interface CapabilitySessionPackageCoordinator {
  listActiveRuns(capabilityId: string): readonly string[];
  activeRunCount(capabilityId: string): number;
  assertRunsIdle(runIds: readonly string[]): Promise<void>;
  reloadRuns(capabilityId: string, version: string): Promise<void>;
  restoreRuns(capabilityId: string, version: string): Promise<void>;
  finalizeDeactivation(capabilityId: string): void;
  deactivateRuns(capabilityId: string): Promise<void>;
  reactivateRuns(capabilityId: string, version: string): Promise<void>;
  assertManagedCapability(capabilityId: string): void;
}
