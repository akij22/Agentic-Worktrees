import { Blocks } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type {
  CapabilityDetailDto,
  CapabilitySummaryDto,
  CodingAgentKindDto,
} from "../../../../shared/ipc/schemas";
import {
  PickerMenu,
  type PickerOption,
} from "../../coding-agent/components/PickerMenu";
import { CapabilitySetupDialog } from "./CapabilitySetupDialog";

const label = (state: string) =>
  state.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const activeStates = new Set([
  "active",
  "pending_activation",
  "pending_deactivation",
  "reloading",
]);

const blockedInstallations = new Set([
  "blocked",
  "invalid",
  "incompatible",
  "migration_pending",
]);

function groupFor(
  capability: CapabilitySummaryDto,
  agentKind: CodingAgentKindDto,
): string {
  if (
    blockedInstallations.has(capability.installationState) ||
    capability.compatibility[agentKind] !== "supported" ||
    capability.state === "unavailable"
  )
    return "Unavailable";
  if (activeStates.has(capability.state)) return "Active";
  if (
    capability.installationState === "needs_setup" ||
    capability.state === "needs_setup"
  )
    return "Needs setup";
  return "Ready";
}

export function CapabilityPicker({
  runId,
  agentKind,
  capabilities,
  disabled,
  onActivate,
  onDeactivate,
}: {
  runId: string;
  agentKind: CodingAgentKindDto;
  capabilities: CapabilitySummaryDto[];
  disabled?: boolean;
  onActivate(id: string): Promise<unknown>;
  onDeactivate(id: string): Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [setup, setSetup] = useState<CapabilityDetailDto>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const groups = ["Active", "Ready", "Needs setup", "Unavailable"];
  const options: PickerOption[] = capabilities
    .filter(
      (capability) =>
        capability.installationState !== "available" &&
        capability.installationState !== "installing" &&
        capability.installationState !== "removing",
    )
    .map((capability) => {
      const group = groupFor(capability, agentKind);
      const hint = blockedInstallations.has(capability.installationState)
        ? label(capability.installationState)
        : capability.state === "activation_failed"
          ? "Retry"
          : label(capability.state);
      return {
        id: capability.id,
        label: capability.name,
        hint,
        group,
        disabled:
          group === "Unavailable" ||
          ![
            "active",
            "ready",
            "inactive",
            "activation_failed",
            "needs_setup",
          ].includes(capability.state),
      };
    })
    .sort(
      (left, right) =>
        groups.indexOf(left.group ?? "") - groups.indexOf(right.group ?? "") ||
        left.label.localeCompare(right.label),
    );

  const choose = async (id: string) => {
    const capability = capabilities.find((item) => item.id === id);
    if (!capability || groupFor(capability, agentKind) === "Unavailable")
      return;
    setError(undefined);
    if (capability.state === "needs_setup") {
      try {
        setSetup(
          await window.api.capabilities.get({ capabilityId: id, runId }),
        );
      } catch {
        setError("Could not open capability setup.");
      }
      return;
    }
    setBusy(true);
    try {
      if (capability.state === "active") {
        if (window.confirm(`Deactivate ${capability.name}?`))
          await onDeactivate(id);
      } else if (
        ["ready", "inactive", "activation_failed"].includes(capability.state)
      ) {
        await onActivate(id);
      }
    } catch {
      setError(`Could not apply ${capability.name}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex items-center gap-1.5">
      <Blocks className="size-3.5 text-muted-foreground" />
      <PickerMenu
        ariaLabel="Capabilities"
        open={open}
        onOpenChange={setOpen}
        options={options}
        value=""
        onChange={(id) => void choose(id)}
        display="Capabilities"
        disabled={disabled || busy}
        searchable
        searchPlaceholder="Search capabilities…"
      />
      <Link
        to="/capabilities"
        state={{ runId }}
        className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
      >
        Browse Capability Library
      </Link>
      {error ? (
        <span role="alert" className="text-[10px] text-destructive">
          {error}
        </span>
      ) : null}
      {setup ? (
        <CapabilitySetupDialog
          capability={setup}
          open
          onOpenChange={(next) => {
            if (!next) setSetup(undefined);
          }}
          onConfigure={async (request) => {
            await window.api.capabilities.configure(request);
            await onActivate(setup.id);
          }}
        />
      ) : null}
    </div>
  );
}
