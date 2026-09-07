import { AlertTriangle, Check, PackageCheck, ShieldCheck } from "lucide-react";
import type { CapabilityDetailDto } from "../../../../shared/ipc/schemas";
import type {
  CapabilityDistributionProgress,
  CapabilityPackageInspectionDto,
  CapabilityRemovalInspection,
} from "../../../../shared/packages/schemas";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { capabilityNetworkPermissionLabel } from "../../capabilities/lib/capability-form";
import { PackageProgress } from "./PackageProgress";

const title = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-border py-2.5 last:border-0 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-mono text-xs">{children}</dd>
    </div>
  );
}

type Props = {
  capability: CapabilityDetailDto;
  inspection?: CapabilityPackageInspectionDto;
  removalReview?: CapabilityRemovalInspection;
  progress?: CapabilityDistributionProgress;
  onInstall(): void;
  onRequestUpdate(): void;
  onUpdate(): void;
  onRequestRemoval(): void;
  onConfirmRemoval(): void;
  onCancelRemoval(): void;
  onCancel(): void;
};

export function MarketplaceCapabilityDetail({
  capability,
  inspection,
  removalReview,
  progress,
  onInstall,
  onRequestUpdate,
  onUpdate,
  onRequestRemoval,
  onConfirmRemoval,
  onCancelRemoval,
  onCancel,
}: Props) {
  const community = (inspection?.trust ?? capability.trust) === "community";
  const installed =
    capability.installationState === "installed" ||
    capability.installationState === "needs_setup";
  const blocked = [
    "blocked",
    "invalid",
    "incompatible",
    "migration_pending",
  ].includes(capability.installationState);

  return (
    <article
      aria-labelledby="package-title"
      className="h-full min-w-0 overflow-auto p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{title(inspection?.trust ?? capability.trust)}</Badge>
        <Badge variant="outline">
          {title(inspection?.reviewStatus ?? capability.reviewStatus)}
        </Badge>
        <span className="font-mono text-xs text-muted-foreground">
          v{inspection?.resolvedVersion ?? capability.version}
        </span>
      </div>
      <h2
        id="package-title"
        className="mt-3 min-w-0 overflow-wrap-anywhere text-2xl font-bold tracking-tight"
      >
        {capability.name}
      </h2>
      <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground">
        {capability.description}
      </p>

      {community ? (
        <div
          role="note"
          className="mt-5 border border-warning/40 bg-warning-surface p-4 text-xs leading-5 text-warning-foreground"
        >
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" />
            Community executable warning
          </p>
          <p className="mt-2">
            This package contains executable code that has not been reviewed by
            Agentic Worktrees. It may access files, processes, credentials, and
            network resources available to your user account.
          </p>
        </div>
      ) : null}

      {progress ? (
        <PackageProgress progress={progress} onCancel={onCancel} />
      ) : null}

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-2">
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-primary" />
            Permission ledger
          </h3>
          <dl className="mt-3 border-y border-border">
            <Row label="Network">
              {capability.permissions.network.length
                ? capability.permissions.network
                    .map(capabilityNetworkPermissionLabel)
                    .join(", ")
                : "None"}
            </Row>
            <Row label="Optional secrets">
              {capability.permissions.secrets.join(", ") || "None"}
            </Row>
            <Row label="Provided tools">
              {capability.providedTools.join(", ") || "None"}
            </Row>
            <Row label="Permission digest">
              {inspection?.permissionDigest ?? capability.permissionDigest}
            </Row>
          </dl>
        </section>
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <PackageCheck className="size-4 text-primary" />
            Package record
          </h3>
          <dl className="mt-3 border-y border-border">
            <Row label="Package">
              {inspection?.packageName ?? capability.packageName ?? "Built in"}
            </Row>
            <Row label="Integrity">
              {inspection?.integrity ?? "Managed with installation"}
            </Row>
            <Row label="Publisher">{capability.author.name}</Row>
            <Row label="Codex">{title(capability.compatibility.codex)}</Row>
            <Row label="OpenCode">
              {title(capability.compatibility.opencode)}
            </Row>
            <Row label="License">{capability.license}</Row>
          </dl>
        </section>
      </div>

      {inspection?.update ? (
        <section
          aria-label="Update review"
          className="mt-5 border-y border-border py-3"
        >
          <h3 className="text-xs font-semibold">Update review</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {inspection.update.releaseNotes || "No release notes provided."}
          </p>
          {inspection.update.permissionChanged ? (
            <p className="mt-2 text-xs text-warning-foreground">
              Permissions changed. Review the permission ledger before
              confirming.
            </p>
          ) : null}
          {inspection.update.downgrade ? (
            <p className="mt-2 text-xs text-warning-foreground">
              This change installs an older version and requires explicit
              confirmation.
            </p>
          ) : null}
        </section>
      ) : null}

      {removalReview ? (
        <section
          role="alertdialog"
          aria-labelledby="removal-review-title"
          aria-describedby="removal-review-consequence"
          className="mt-5 border border-destructive/50 p-4"
        >
          <h3 id="removal-review-title" className="text-sm font-semibold">
            Review capability removal
          </h3>
          <dl className="mt-3 border-y border-border">
            <Row label="Package">{removalReview.packageName}</Row>
            <Row label="Active version">{removalReview.activeVersion}</Row>
            <Row label="Active runs">{removalReview.activeRunCount}</Row>
          </dl>
          <p
            id="removal-review-consequence"
            className="mt-3 text-xs text-destructive"
          >
            Removing this capability makes it unavailable to new runs and
            interrupts its use in the affected active runs.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="destructive" onClick={onConfirmRemoval}>
              Confirm removal
            </Button>
            <Button variant="outline" onClick={onCancelRemoval}>
              Back
            </Button>
          </div>
        </section>
      ) : null}

      {capability.installationState === "needs_setup" ? (
        <p role="status" className="mt-5 text-xs text-warning-foreground">
          Setup is required before this capability can be selected in chat.
        </p>
      ) : null}
      {capability.warningCode ? (
        <p role="status" className="mt-5 text-xs text-warning-foreground">
          Offline fallback is active. Catalog data may be out of date.
        </p>
      ) : null}
      {blocked ? (
        <p role="alert" className="mt-5 text-xs text-destructive">
          {title(capability.installationState)}. This capability cannot be
          installed or selected.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {inspection && !blocked ? (
          <Button onClick={inspection.update ? onUpdate : onInstall}>
            {inspection.update ? "Confirm update" : "Install capability"}
          </Button>
        ) : null}
        {installed &&
        capability.source === "npm" &&
        !inspection &&
        !removalReview ? (
          <Button variant="outline" onClick={onRequestUpdate}>
            Review update
          </Button>
        ) : null}
        {installed && capability.source === "npm" && !removalReview ? (
          <Button variant="destructive" onClick={onRequestRemoval}>
            Review removal
          </Button>
        ) : null}
        {installed ? (
          <span className="inline-flex items-center gap-2 text-xs text-chart-3">
            <Check className="size-4" />
            Installed
          </span>
        ) : null}
      </div>
    </article>
  );
}
