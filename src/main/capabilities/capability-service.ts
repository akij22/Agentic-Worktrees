import { randomUUID } from "node:crypto";
import { CapabilityError } from "@agentic-worktrees/capability-sdk";
import type { CodingAgentKind } from "../coding-agents/types";
import type {
  CapabilityChangedEventDto,
  CapabilityConfigureRequest,
  CapabilityDetailDto,
  CapabilitySessionStateDto,
  CapabilityStateDto,
  CapabilitySummaryDto,
} from "../../shared/ipc/schemas";
import type { CodingAgentCapabilityActivator } from "./activation-types";
import {
  getBundledCapability,
  listBundledCapabilities,
  permissionDigest,
  toCapabilityDetailDto,
  toCapabilitySummaryDto,
  type CapabilityCatalog,
  type CapabilityCatalogEntry,
} from "./catalog";
import type { CapabilityCredentialStore } from "./capability-credential-store";
import type { CapabilityHostManager } from "./capability-host-manager";
import type {
  CapabilityRepository,
  SessionCapabilityRecord,
} from "./capability-repository";
import { prepareCapabilityConfiguration } from "./capability-configuration";
import type { CapabilitySessionPackageCoordinator } from "./capability-session-package-coordinator";

export interface CapabilityServiceDependencies {
  repository: CapabilityRepository;
  credentials: CapabilityCredentialStore;
  hosts: CapabilityHostManager;
  activator: CodingAgentCapabilityActivator;
  getAgentKind(runId: string): Promise<CodingAgentKind>;
  getAgentVersion?(runId: string): Promise<string>;
  logError?(event: string, code: string): void;
  catalog?: CapabilityCatalog;
}

const MINIMUM_AGENT_VERSIONS: Record<CodingAgentKind, string> = {
  codex: "0.150.1",
  opencode: "1.18.23",
};
function isVersionAtLeast(actual: string, minimum: string): boolean {
  const value = actual
    .match(/\d+\.\d+\.\d+/)?.[0]
    ?.split(".")
    .map(Number);
  const floor = minimum.split(".").map(Number);
  if (!value) return false;
  for (let index = 0; index < 3; index += 1) {
    if ((value[index] ?? 0) !== (floor[index] ?? 0))
      return (value[index] ?? 0) > (floor[index] ?? 0);
  }
  return true;
}

function recordState(
  record: SessionCapabilityRecord | undefined,
  baseState: "available" | "needs_setup" | "ready",
): CapabilityStateDto {
  return record?.status ?? baseState;
}
function sessionDto(
  record: SessionCapabilityRecord,
  catalog: CapabilityCatalogEntry,
): CapabilitySessionStateDto {
  return {
    runId: record.runId,
    capabilityId: record.capabilityId,
    name: catalog.manifest.name,
    version: record.version,
    state: record.status,
    ...(record.errorCode ? { errorCode: record.errorCode } : {}),
    ...(record.activatedAt
      ? { activatedAt: record.activatedAt.toISOString() }
      : {}),
    ...(record.deactivatedAt
      ? { deactivatedAt: record.deactivatedAt.toISOString() }
      : {}),
  };
}

export class CapabilityService implements CapabilitySessionPackageCoordinator {
  private readonly packageSessionSnapshots = new Map<
    string,
    {
      token: string;
      revision: number;
      snapshot: ReturnType<CapabilityRepository["snapshotSessionCapabilities"]>;
    }
  >();
  private packageSessionRevision = 0;
  private readonly packageSessionOperations = new Set<string>();
  private readonly listeners = new Set<
    (event: CapabilityChangedEventDto) => void
  >();
  constructor(private readonly dependencies: CapabilityServiceDependencies) {}
  private listCatalog(): readonly CapabilityCatalogEntry[] {
    return this.dependencies.catalog?.list() ?? listBundledCapabilities();
  }
  private getCatalog(id: string, version?: string): CapabilityCatalogEntry {
    const entry =
      this.dependencies.catalog?.get(id, version) ?? getBundledCapability(id);
    if (version !== undefined && entry.manifest.version !== version)
      throw new CapabilityError("invalid_input", "Unknown capability version.");
    return entry;
  }

  listCapabilities(runId?: string): CapabilitySummaryDto[] {
    return this.listCatalog().map((capability) => {
      const installation = this.dependencies.repository.getInstallation(
        capability.manifest.id,
      );
      const record = runId
        ? this.dependencies.repository.getSessionCapability(
            runId,
            capability.manifest.id,
          )
        : undefined;
      const secretConfigured = this.dependencies.repository
        .getSettings(capability.manifest.id)
        .some(
          (setting) =>
            capability.manifest.settings[setting.key]?.type === "secret" &&
            Boolean(setting.secretRef),
        );
      const baseState = !installation
        ? "available"
        : installation.configured &&
            installation.permissionDigest ===
              permissionDigest(capability.manifest) &&
            installation.version === capability.manifest.version
          ? "ready"
          : "needs_setup";
      return toCapabilitySummaryDto(
        capability,
        recordState(record, baseState),
        secretConfigured,
      );
    });
  }

  getCapability(capabilityId: string, runId?: string): CapabilityDetailDto {
    const capability = this.getCatalog(capabilityId);
    const installation =
      this.dependencies.repository.getInstallation(capabilityId);
    const record = runId
      ? this.dependencies.repository.getSessionCapability(runId, capabilityId)
      : undefined;
    const secretConfigured = this.dependencies.repository
      .getSettings(capabilityId)
      .some(
        (setting) =>
          capability.manifest.settings[setting.key]?.type === "secret" &&
          Boolean(setting.secretRef),
      );
    const baseState = !installation
      ? "available"
      : installation.configured &&
          installation.permissionDigest ===
            permissionDigest(capability.manifest) &&
          installation.version === capability.manifest.version
        ? "ready"
        : "needs_setup";
    return toCapabilityDetailDto(
      capability,
      recordState(record, baseState),
      secretConfigured,
    );
  }

  async configureCapability(
    input: CapabilityConfigureRequest,
  ): Promise<CapabilityDetailDto> {
    const capability = this.getCatalog(input.capabilityId);
    const digest = permissionDigest(capability.manifest);
    if (input.acceptedPermissionDigest !== digest)
      throw new CapabilityError(
        "permission_denied",
        "Capability permissions changed. Review and accept them again.",
      );
    const existing = this.dependencies.repository.getSettings(
      input.capabilityId,
    );
    const prepared = prepareCapabilityConfiguration(
      capability.manifest,
      input,
      existing,
    );
    const newlyStored: string[] = [];
    const obsolete: string[] = [];
    const settings = [...prepared.values];
    try {
      for (const change of prepared.secrets) {
        let secretRef = change.existingRef;
        if (typeof change.value === "string") {
          secretRef = await this.dependencies.credentials.setSecret(
            input.capabilityId,
            change.key,
            change.value,
          );
          newlyStored.push(secretRef);
        } else if (change.value === null) secretRef = undefined;
        if (secretRef) settings.push({ key: change.key, secretRef });
        if (change.existingRef && change.existingRef !== secretRef)
          obsolete.push(change.existingRef);
      }
      this.dependencies.repository.saveConfiguration(
        {
          capabilityId: input.capabilityId,
          version: capability.manifest.version,
          permissionDigest: digest,
          configured: true,
        },
        settings,
      );
    } catch (error) {
      for (const reference of newlyStored.reverse()) {
        await this.dependencies.credentials
          .removeSecret(reference)
          .catch(() =>
            this.dependencies.logError?.(
              "capability.configuration.secret.compensation.failed",
              "internal_error",
            ),
          );
      }
      throw error;
    }
    for (const reference of obsolete) {
      await this.dependencies.credentials
        .removeSecret(reference)
        .catch(() =>
          this.dependencies.logError?.(
            "capability.configuration.old_secret.cleanup.failed",
            "internal_error",
          ),
        );
    }
    return this.getCapability(input.capabilityId);
  }

  async activateCapability(
    runId: string,
    capabilityId: string,
  ): Promise<CapabilitySessionStateDto> {
    const capability = this.getCatalog(capabilityId);
    const installation =
      this.dependencies.repository.getInstallation(capabilityId);
    if (
      !installation?.configured ||
      installation.permissionDigest !== permissionDigest(capability.manifest) ||
      installation.version !== capability.manifest.version
    )
      throw new CapabilityError(
        "permission_denied",
        "Review and configure this capability before activation.",
      );
    const agentKind = await this.dependencies.getAgentKind(runId);
    const agentVersion = await this.dependencies.getAgentVersion?.(runId);
    if (
      agentVersion &&
      !isVersionAtLeast(agentVersion, MINIMUM_AGENT_VERSIONS[agentKind])
    )
      throw new CapabilityError(
        "activation_failed",
        "Update the coding agent before activating this capability.",
      );
    if (capability.manifest.compatibility[agentKind] !== "supported")
      throw new CapabilityError(
        "activation_failed",
        "Capability is incompatible with this coding agent.",
      );
    const current = this.dependencies.repository.getSessionCapability(
      runId,
      capabilityId,
    );
    if (current?.status === "active") return sessionDto(current, capability);
    if (!(await this.dependencies.activator.isAgentIdle(runId)))
      throw new CapabilityError(
        "activation_failed",
        "Capabilities can only be changed between turns.",
      );
    const previousIds = this.dependencies.repository
      .listSessionCapabilities(runId)
      .filter((item) => item.status === "active")
      .map((item) => item.capabilityId);
    const pending = this.dependencies.repository.transitionSessionCapability({
      runId,
      capabilityId,
      version: capability.manifest.version,
      to: "pending_activation",
    });
    this.emit(pending);
    try {
      await this.dependencies.activator.prepareSession(runId, agentKind);
      if (agentKind === "opencode") {
        const reloading =
          this.dependencies.repository.transitionSessionCapability({
            runId,
            capabilityId,
            version: capability.manifest.version,
            to: "reloading",
          });
        this.emit(reloading);
      }
      const settings = this.hostSettings([...previousIds, capabilityId]);
      const toolNames = await this.dependencies.hosts.setActiveCapabilities(
        runId,
        [...new Set([...previousIds, capabilityId])],
        settings,
      );
      await this.dependencies.activator.apply(runId, toolNames);
      const active = this.dependencies.repository.transitionSessionCapability({
        runId,
        capabilityId,
        version: capability.manifest.version,
        to: "active",
      });
      this.emit(active);
      return sessionDto(active, capability);
    } catch (error) {
      try {
        const rollbackTools =
          await this.dependencies.hosts.setActiveCapabilities(
            runId,
            previousIds,
            this.hostSettings(previousIds),
          );
        if (previousIds.length === 0) {
          await this.dependencies.activator.remove(runId);
          this.dependencies.hosts.stopHost(runId);
        } else {
          await this.dependencies.activator.apply(runId, rollbackTools);
        }
      } catch (rollbackError) {
        const rollbackCode =
          rollbackError instanceof CapabilityError
            ? rollbackError.code
            : "activation_failed";
        this.dependencies.logError?.(
          "capability.activation.rollback.failed",
          rollbackCode,
        );
      }
      const code =
        error instanceof CapabilityError ? error.code : "activation_failed";
      const failed = this.dependencies.repository.transitionSessionCapability({
        runId,
        capabilityId,
        version: capability.manifest.version,
        to: "activation_failed",
        errorCode: code,
      });
      this.emit(failed);
      throw new CapabilityError(code, "Capability activation failed.");
    }
  }

  async deactivateCapability(
    runId: string,
    capabilityId: string,
  ): Promise<CapabilitySessionStateDto> {
    const capability = this.getCatalog(capabilityId);
    const current = this.dependencies.repository.getSessionCapability(
      runId,
      capabilityId,
    );
    if (!current || current.status === "inactive")
      return sessionDto(
        current ??
          this.dependencies.repository.transitionSessionCapability({
            runId,
            capabilityId,
            version: capability.manifest.version,
            to: "inactive",
          }),
        capability,
      );
    if (!(await this.dependencies.activator.isAgentIdle(runId)))
      throw new CapabilityError(
        "activation_failed",
        "Capabilities can only be changed between turns.",
      );
    const agentKind = await this.dependencies.getAgentKind(runId);
    const pending = this.dependencies.repository.transitionSessionCapability({
      runId,
      capabilityId,
      version: capability.manifest.version,
      to: "pending_deactivation",
    });
    this.emit(pending);
    if (agentKind === "opencode") {
      const reloading =
        this.dependencies.repository.transitionSessionCapability({
          runId,
          capabilityId,
          version: capability.manifest.version,
          to: "reloading",
        });
      this.emit(reloading);
    }
    const remaining = this.dependencies.repository
      .listSessionCapabilities(runId)
      .filter(
        (item) =>
          item.capabilityId !== capabilityId && item.status === "active",
      )
      .map((item) => item.capabilityId);
    try {
      await this.dependencies.hosts.setActiveCapabilities(
        runId,
        remaining,
        this.hostSettings(remaining),
      );
      await this.dependencies.activator.remove(runId);
      const inactive = this.dependencies.repository.transitionSessionCapability(
        {
          runId,
          capabilityId,
          version: capability.manifest.version,
          to: "inactive",
        },
      );
      if (remaining.length === 0) this.dependencies.hosts.stopHost(runId);
      this.emit(inactive);
      return sessionDto(inactive, capability);
    } catch (error) {
      const previousIds = [...remaining, capabilityId];
      try {
        const rollbackTools =
          await this.dependencies.hosts.setActiveCapabilities(
            runId,
            previousIds,
            this.hostSettings(previousIds),
          );
        await this.dependencies.activator.apply(runId, rollbackTools);
      } catch (rollbackError) {
        const rollbackCode =
          rollbackError instanceof CapabilityError
            ? rollbackError.code
            : "activation_failed";
        this.dependencies.logError?.(
          "capability.deactivation.rollback.failed",
          rollbackCode,
        );
      }
      const code =
        error instanceof CapabilityError ? error.code : "activation_failed";
      const failed = this.dependencies.repository.transitionSessionCapability({
        runId,
        capabilityId,
        version: capability.manifest.version,
        to: "activation_failed",
        errorCode: code,
      });
      this.emit(failed);
      throw new CapabilityError(code, "Capability deactivation failed.");
    }
  }

  listActiveRuns(capabilityId: string): readonly string[] {
    return Object.freeze(
      this.dependencies.repository.listActiveRunsByCapabilityId(capabilityId),
    );
  }

  activeRunCount(capabilityId: string): number {
    return this.listActiveRuns(capabilityId).length;
  }

  async assertRunsIdle(runIds: readonly string[]): Promise<void> {
    for (const runId of runIds)
      if (!(await this.dependencies.activator.isAgentIdle(runId)))
        throw new CapabilityError(
          "activation_failed",
          "All affected capability sessions must be idle.",
        );
  }

  assertManagedCapability(capabilityId: string): void {
    if (this.getCatalog(capabilityId).source !== "npm")
      throw new CapabilityError(
        "invalid_input",
        "Bundled capabilities cannot be managed as packages.",
      );
  }

  async reloadRuns(capabilityId: string, version: string): Promise<void> {
    this.assertManagedCapability(capabilityId);
    this.getCatalog(capabilityId, version);
    const runIds = [...this.listActiveRuns(capabilityId)];
    await this.assertRunsIdle(runIds);
    const reloaded: string[] = [];
    try {
      for (const runId of runIds) {
        const activeIds = this.dependencies.repository
          .listSessionCapabilities(runId)
          .filter((record) => record.status === "active")
          .map((record) => record.capabilityId);
        const tools = await this.dependencies.hosts.setActiveCapabilities(
          runId,
          activeIds,
          this.hostSettings(activeIds),
        );
        await this.dependencies.activator.apply(runId, tools);
        reloaded.push(runId);
      }
      this.dependencies.repository.updateSessionCapabilityVersions(
        capabilityId,
        runIds,
        version,
      );
    } catch {
      for (const runId of reloaded.reverse()) {
        try {
          const activeIds = this.dependencies.repository
            .listSessionCapabilities(runId)
            .filter((record) => record.status === "active")
            .map((record) => record.capabilityId);
          const tools = await this.dependencies.hosts.setActiveCapabilities(
            runId,
            activeIds,
            this.hostSettings(activeIds),
          );
          await this.dependencies.activator.apply(runId, tools);
        } catch {
          this.dependencies.logError?.(
            "capability.package.reload.rollback.failed",
            "activation_failed",
          );
        }
      }
      throw new CapabilityError(
        "agent_reload_failed",
        "Capability sessions could not be reloaded.",
      );
    }
  }

  restoreRuns(capabilityId: string, version: string): Promise<void> {
    return this.reloadRuns(capabilityId, version);
  }

  private sessionStateMatchesDeactivation(
    capabilityId: string,
    snapshot: ReturnType<CapabilityRepository["snapshotSessionCapabilities"]>,
  ): boolean {
    const current =
      this.dependencies.repository.listSessionCapabilitiesByCapabilityId(
        capabilityId,
      );
    if (current.length !== snapshot.records.length) return false;
    return snapshot.records.every((before, index) => {
      const after = current[index];
      return (
        after?.id === before.id &&
        after.runId === before.runId &&
        after.version === before.version &&
        after.status ===
          (before.status === "active" ? "inactive" : before.status)
      );
    });
  }

  async deactivateRuns(capabilityId: string): Promise<void> {
    this.assertManagedCapability(capabilityId);
    if (this.packageSessionOperations.has(capabilityId))
      throw new CapabilityError(
        "activation_failed",
        "Capability session coordination is already in progress.",
      );
    if (this.packageSessionSnapshots.has(capabilityId))
      throw new CapabilityError(
        "activation_failed",
        "Capability session deactivation is already pending.",
      );
    this.packageSessionOperations.add(capabilityId);
    let snapshot:
      | ReturnType<CapabilityRepository["snapshotSessionCapabilities"]>
      | undefined;
    try {
      const runIds = [...this.listActiveRuns(capabilityId)];
      await this.assertRunsIdle(runIds);
      snapshot =
        this.dependencies.repository.snapshotSessionCapabilities(capabilityId);
      const marker = {
        token: randomUUID(),
        revision: ++this.packageSessionRevision,
        snapshot,
      };
      this.packageSessionSnapshots.set(capabilityId, marker);
      const deactivated: string[] = [];
      try {
        for (const runId of runIds) {
          await this.deactivateCapability(runId, capabilityId);
          deactivated.push(runId);
        }
      } catch (error) {
        for (const runId of deactivated.reverse())
          await this.activateCapability(runId, capabilityId).catch(
            () => undefined,
          );
        this.dependencies.repository.restoreSessionCapabilities(snapshot);
        const current = this.packageSessionSnapshots.get(capabilityId);
        if (
          current?.token === marker.token &&
          current.revision === marker.revision
        )
          this.packageSessionSnapshots.delete(capabilityId);
        throw error;
      }
    } finally {
      this.packageSessionOperations.delete(capabilityId);
    }
  }

  async reactivateRuns(capabilityId: string, version: string): Promise<void> {
    this.assertManagedCapability(capabilityId);
    if (this.packageSessionOperations.has(capabilityId))
      throw new CapabilityError(
        "activation_failed",
        "Capability session coordination is already in progress.",
      );
    this.packageSessionOperations.add(capabilityId);
    try {
      this.getCatalog(capabilityId, version);
      const prior = this.packageSessionSnapshots.get(capabilityId);
      if (!prior)
        throw new CapabilityError(
          "invalid_input",
          "No package session deactivation is pending.",
        );
      if (!this.sessionStateMatchesDeactivation(capabilityId, prior.snapshot))
        throw new CapabilityError(
          "activation_failed",
          "Capability session state changed after deactivation.",
        );
      const activeRunIds = new Set(
        prior.snapshot.records
          .filter((record) => record.status === "active")
          .map((record) => record.runId),
      );
      const records = this.dependencies.repository
        .listSessionCapabilitiesByCapabilityId(capabilityId)
        .filter(
          (record) =>
            record.status === "inactive" && activeRunIds.has(record.runId),
        );
      await this.assertRunsIdle(records.map((record) => record.runId));
      if (
        this.packageSessionSnapshots.get(capabilityId)?.token !== prior.token ||
        this.packageSessionSnapshots.get(capabilityId)?.revision !==
          prior.revision ||
        !this.sessionStateMatchesDeactivation(capabilityId, prior.snapshot)
      )
        throw new CapabilityError(
          "activation_failed",
          "Capability session state changed after deactivation.",
        );
      const snapshot =
        this.dependencies.repository.snapshotSessionCapabilities(capabilityId);
      const reactivated: string[] = [];
      try {
        for (const record of records) {
          await this.activateCapability(record.runId, capabilityId);
          reactivated.push(record.runId);
        }
        this.dependencies.repository.updateSessionCapabilityVersions(
          capabilityId,
          records.map((record) => record.runId),
          version,
        );
        const current = this.packageSessionSnapshots.get(capabilityId);
        if (
          current?.token !== prior.token ||
          current.revision !== prior.revision
        )
          throw new CapabilityError(
            "activation_failed",
            "Capability session coordination revision changed.",
          );
        this.packageSessionSnapshots.delete(capabilityId);
      } catch (error) {
        for (const runId of reactivated.reverse())
          await this.deactivateCapability(runId, capabilityId).catch(
            () => undefined,
          );
        this.dependencies.repository.restoreSessionCapabilities(snapshot);
        throw error;
      }
    } finally {
      this.packageSessionOperations.delete(capabilityId);
    }
  }

  subscribeToCapabilityEvents(
    listener: (event: CapabilityChangedEventDto) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async reconcileCapabilities(): Promise<void> {
    for (const record of this.dependencies.repository.listInterruptedSessionCapabilities()) {
      const failed = this.dependencies.repository.transitionSessionCapability({
        runId: record.runId,
        capabilityId: record.capabilityId,
        version: record.version,
        to: "activation_failed",
        errorCode: "activation_failed",
      });
      this.emit(failed);
    }
    const activeRunIds = [
      ...new Set(
        this.dependencies.repository
          .listActiveSessionCapabilities()
          .map((record) => record.runId),
      ),
    ];
    for (const runId of activeRunIds) {
      try {
        const agentKind = await this.dependencies.getAgentKind(runId);
        await this.dependencies.activator.prepareSession(runId, agentKind);
      } catch (error) {
        const code =
          error instanceof CapabilityError ? error.code : "activation_failed";
        this.dependencies.logError?.("capability.reconcile.failed", code);
      }
    }
  }
  stopCapabilities(): Promise<void> {
    return this.dependencies.hosts.stopAll();
  }

  async resolveSecret(
    capabilityId: string,
    settingKey: string,
  ): Promise<string | undefined> {
    const reference = this.dependencies.repository
      .getSettings(capabilityId)
      .find((setting) => setting.key === settingKey)?.secretRef;
    return reference
      ? this.dependencies.credentials.getSecret(reference)
      : undefined;
  }

  private hostSettings(
    ids: readonly string[],
  ): Record<string, Record<string, unknown>> {
    return Object.fromEntries(
      ids.map((id) => [
        id,
        Object.fromEntries(
          this.dependencies.repository
            .getSettings(id)
            .filter((setting) => setting.value !== undefined)
            .map((setting) => [setting.key, setting.value]),
        ),
      ]),
    );
  }
  private emit(record: SessionCapabilityRecord): void {
    const event = {
      ...sessionDto(record, this.getCatalog(record.capabilityId)),
      updatedAt: record.updatedAt.toISOString(),
    };
    for (const listener of this.listeners) listener(event);
  }
}
