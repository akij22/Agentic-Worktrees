import type { CapabilityManifest } from "@agentic-worktrees/capability-sdk";
import type { CapabilitySettingRecord } from "./capability-repository";

export interface CapabilityUpdateConfiguration {
  readonly configured: boolean;
  readonly settings: readonly CapabilitySettingRecord[];
  readonly obsoleteSecretRefs: readonly string[];
}

/** Pure planning; secret references stay encrypted and are only deleted after commit. */
export function planCapabilityUpdateConfiguration(
  previous: CapabilityManifest,
  next: CapabilityManifest,
  existing: readonly CapabilitySettingRecord[],
): CapabilityUpdateConfiguration {
  let configured = true;
  const settings: CapabilitySettingRecord[] = [];
  for (const [key, definition] of Object.entries(next.settings)) {
    const prior =
      previous.settings[key]?.type === definition.type
        ? existing.find((item) => item.key === key)
        : undefined;
    if (definition.type === "secret") {
      if (prior?.secretRef) settings.push({ key, secretRef: prior.secretRef });
      else if (definition.required) configured = false;
      continue;
    }
    const valid = (value: unknown): boolean => {
      if (definition.type === "string")
        return (
          typeof value === "string" &&
          (!definition.enum || definition.enum.includes(value))
        );
      if (definition.type === "boolean") return typeof value === "boolean";
      return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        (definition.min === undefined || value >= definition.min) &&
        (definition.max === undefined || value <= definition.max)
      );
    };
    const value = valid(prior?.value) ? prior?.value : definition.default;
    if (value !== undefined && valid(value)) settings.push({ key, value });
    else if (definition.required) configured = false;
  }
  const kept = new Set(
    settings.flatMap((item) => (item.secretRef ? [item.secretRef] : [])),
  );
  return Object.freeze({
    configured,
    settings: Object.freeze(settings.map((item) => Object.freeze(item))),
    obsoleteSecretRefs: Object.freeze([
      ...new Set(
        existing.flatMap((item) =>
          item.secretRef && !kept.has(item.secretRef) ? [item.secretRef] : [],
        ),
      ),
    ]),
  });
}
