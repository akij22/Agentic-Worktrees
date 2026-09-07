import npa from "npm-package-arg";
import type { CapabilityDistributionService } from "../capabilities/capability-distribution-service";
import { packageErrorCodeSchema, packageSourceSpecSchema, type CapabilityPackageInspectionDto, type PackageErrorCode } from "../../shared/packages/schemas";
import type { PackageCliCommand } from "./arguments";
import { formatPackageProgress, type CliTerminal } from "./terminal-ui";

export type PackageCommandServices = {
  distributionService: Pick<CapabilityDistributionService,
    "subscribe" | "listMarketplaceCapabilities" | "inspect" | "install" |
    "checkForUpdates" | "update" | "inspectRemoval" | "remove">;
};

const safeErrors: Record<PackageErrorCode, string> = {
  package_not_found: "Package not found.", package_version_not_found: "Package version not found.",
  package_source_invalid: "Invalid npm package specification.", package_integrity_failed: "Package integrity verification failed.",
  package_archive_invalid: "Package archive is invalid.", package_manifest_invalid: "Capability manifest is invalid.",
  package_kind_unsupported: "This package is not a supported capability.", package_incompatible: "This capability is not compatible with this app.",
  package_blocked: "This package is blocked.", package_permission_denied: "Package permission was not accepted.",
  package_busy: "Another package operation is in progress.", package_download_failed: "Package download failed.",
  package_verification_failed: "Package verification failed.", package_install_failed: "Package installation failed.",
  package_update_failed: "Package update failed.", package_remove_failed: "Package removal failed.", package_sync_failed: "Package synchronization failed.",
};

const packageNameFromSpec = (sourceSpec: string): string => {
  if (!packageSourceSpecSchema.safeParse(sourceSpec).success) throw new Error("package_source_invalid");
  const name = npa(sourceSpec).name;
  if (!name) throw new Error("package_source_invalid");
  return name;
};

const printInspection = (inspection: CapabilityPackageInspectionDto, terminal: CliTerminal): void => {
  const capability = inspection.capability;
  terminal.writeLine(`Package: ${inspection.packageName}`);
  terminal.writeLine(`Version: ${inspection.resolvedVersion}`);
  terminal.writeLine(`Trust: ${inspection.trust}`);
  terminal.writeLine(`Review: ${inspection.reviewStatus}`);
  terminal.writeLine(`Compatibility: Codex ${capability.compatibility.codex}; OpenCode ${capability.compatibility.opencode}`);
  terminal.writeLine(`Permissions: network [${capability.permissions.network.join(", ") || "none"}]; secrets [${capability.permissions.secrets.join(", ") || "none"}]`);
  if (inspection.trust === "community")
    terminal.writeLine("WARNING: Community capabilities are unreviewed and can execute arbitrary Node code with your user permissions.");
};

const acceptance = (inspection: CapabilityPackageInspectionDto) => ({
  inspectionId: inspection.inspectionId,
  acceptedPackageName: inspection.packageName,
  acceptedVersion: inspection.resolvedVersion,
  acceptedIntegrity: inspection.integrity,
  acceptedPermissionDigest: inspection.permissionDigest,
});

const install = async (sourceSpec: string, service: PackageCommandServices["distributionService"], terminal: CliTerminal) => {
  const packageName = packageNameFromSpec(sourceSpec);
  const official = (await service.listMarketplaceCapabilities()).find(
    (item) => item.packageName === packageName && item.trust === "official",
  );
  const inspection = await service.inspect({ sourceSpec, intent: "install", ...(official ? { officialCapabilityId: official.id } : {}) });
  printInspection(inspection, terminal);
  if (inspection.releaseNotes) terminal.writeLine(`Release notes: ${inspection.releaseNotes}`);
  if (!await terminal.confirm("Install this capability? (y/N)")) return;
  const installed = await service.install(acceptance(inspection));
  terminal.writeLine(installed.id === "agentic-worktrees.web-search"
    ? "Installed Web Search. It is now available in every chat."
    : `Installed ${installed.name}. It is now available in every chat.`);
};

const updateOne = async (sourceSpec: string, service: PackageCommandServices["distributionService"], terminal: CliTerminal) => {
  const inspection = await service.inspect({ sourceSpec, intent: "update" });
  printInspection(inspection, terminal);
  if (inspection.update?.releaseNotes) terminal.writeLine(`Release notes: ${inspection.update.releaseNotes}`);
  if (!await terminal.confirm("Update this capability? (y/N)")) return;
  const updated = await service.update({ ...acceptance(inspection), packageName: inspection.packageName,
    acceptedDowngrade: inspection.update?.downgrade ?? false,
    acceptedActiveRunCount: inspection.update?.activeRunCount ?? 0 });
  terminal.writeLine(`Updated ${updated.name} to ${inspection.resolvedVersion}.`);
};

export async function runPackageCommand(command: PackageCliCommand, services: PackageCommandServices, terminal: CliTerminal): Promise<void> {
  const service = services.distributionService;
  const unsubscribe = service.subscribe((event) => terminal.writeLine(formatPackageProgress(event)));
  try {
    if (command.kind === "list") {
      const items = await service.listMarketplaceCapabilities();
      const installed = items.filter((item) => item.source === "npm" && item.installationState !== "available");
      if (!installed.length) terminal.writeLine("No managed packages installed.");
      else installed.forEach((item) => terminal.writeLine(`${item.packageName ?? item.id}\t${item.version}\t${item.installationState}`));
    } else if (command.kind === "install") await install(command.sourceSpec, service, terminal);
    else if (command.kind === "update") {
      if (command.sourceSpec) await updateOne(command.sourceSpec, service, terminal);
      else {
        const updates = await service.checkForUpdates();
        if (!updates.length) terminal.writeLine("All managed packages are up to date.");
        for (const candidate of updates) await updateOne(`${candidate.packageName}@${candidate.candidateVersion}`, service, terminal);
      }
    } else {
      const packageName = packageNameFromSpec(command.sourceSpec);
      const inspection = await service.inspectRemoval({ packageName });
      terminal.writeLine(`Package: ${inspection.packageName}`);
      terminal.writeLine(`Version: ${inspection.activeVersion}`);
      terminal.writeLine(`Active chats: ${inspection.activeRunCount}`);
      if (!await terminal.confirm("Remove this capability? (y/N)")) return;
      await service.remove({ inspectionId: inspection.inspectionId, packageName: inspection.packageName,
        acceptedActiveVersion: inspection.activeVersion, acceptedActiveRunCount: inspection.activeRunCount });
      terminal.writeLine(`Removed ${inspection.packageName}.`);
    }
    terminal.setExitCode(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "package_cancelled" || (error instanceof Error && error.name === "AbortError")) {
      terminal.writeLine("Operation cancelled."); terminal.setExitCode(130);
    } else {
      const parsed = packageErrorCodeSchema.safeParse(message);
      terminal.writeLine(parsed.success ? safeErrors[parsed.data] : "Package operation failed.");
      terminal.setExitCode(1);
    }
  } finally { unsubscribe(); }
}
