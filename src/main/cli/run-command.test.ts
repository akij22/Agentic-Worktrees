import { describe, expect, it, vi } from "vitest";
import { runPackageCommand } from "./run-command";

const inspection = { inspectionId: "inspection-1", packageName: "@agentic-worktrees/web-search", requestedSpec: "@agentic-worktrees/web-search@0.1.0", resolvedVersion: "0.1.0", integrity: "sha512-safe", contentDigest: "digest", trust: "community", reviewStatus: "unreviewed", releaseNotes: "notes", permissionDigest: "permissions", expiresAt: new Date().toISOString(), capability: { id: "agentic-worktrees.web-search", name: "Web Search", version: "0.1.0", description: "Search", category: "web", compatibility: { codex: "supported", opencode: "supported" }, state: "needs_setup", secretConfigured: false, installationState: "installed", source: "npm", packageName: "@agentic-worktrees/web-search", trust: "community", reviewStatus: "unreviewed", sdkVersion: "1", author: { name: "AW" }, license: "MIT", permissions: { network: ["example.com"], secrets: ["API_KEY"] }, settings: [], activeRunCount: 0, providedTools: ["web_search"], permissionDigest: "permissions" } } as const;

const setup = (confirmed = true) => {
  const unsubscribe = vi.fn();
  const service = { subscribe: vi.fn(() => unsubscribe), listMarketplaceCapabilities: vi.fn().mockResolvedValue([]), inspect: vi.fn().mockResolvedValue(inspection), install: vi.fn().mockResolvedValue(inspection.capability), checkForUpdates: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue(inspection.capability), inspectRemoval: vi.fn().mockResolvedValue({ inspectionId: "remove-1", packageName: inspection.packageName, capabilityId: inspection.capability.id, activeVersion: "0.1.0", activeIntegrity: "sha512-safe", activeContentDigest: "digest", activeRunCount: 2, expiresAt: new Date().toISOString() }), remove: vi.fn() };
  const lines: string[] = []; const terminal = { writeLine: vi.fn((line: string) => lines.push(line)), confirm: vi.fn().mockResolvedValue(confirmed), setExitCode: vi.fn() };
  return { service, terminal, lines, unsubscribe };
};

describe("runPackageCommand", () => {
  it("reviews Community code and installs only the exact inspected tuple", async () => {
    const { service, terminal, lines, unsubscribe } = setup();
    await runPackageCommand({ kind: "install", sourceSpec: inspection.requestedSpec }, { distributionService: service as never }, terminal);
    expect(lines.join("\n")).toContain("arbitrary Node code");
    expect(lines.join("\n")).toContain("Compatibility: Codex supported; OpenCode supported");
    expect(service.install).toHaveBeenCalledWith({ inspectionId: "inspection-1", acceptedPackageName: inspection.packageName, acceptedVersion: "0.1.0", acceptedIntegrity: "sha512-safe", acceptedPermissionDigest: "permissions" });
    expect(lines).toContain("Installed Web Search. It is now available in every chat.");
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
  it("passes the catalog capability id for an Official inspection", async () => {
    const { service, terminal } = setup();
    service.listMarketplaceCapabilities.mockResolvedValue([{ ...inspection.capability, trust: "official", reviewStatus: "official-reviewed" }]);
    await runPackageCommand({ kind: "install", sourceSpec: inspection.requestedSpec }, { distributionService: service as never }, terminal);
    expect(service.inspect).toHaveBeenCalledWith({ sourceSpec: inspection.requestedSpec, intent: "install", officialCapabilityId: inspection.capability.id });
  });
  it("prints subscribed progress without exposing event internals", async () => {
    const { service, terminal, lines } = setup(false);
    service.subscribe.mockImplementation((listener) => { listener({ operationId: "secret-op", action: "install", stage: "downloading", status: "in_progress", updatedAt: new Date().toISOString() }); return vi.fn(); });
    await runPackageCommand({ kind: "install", sourceSpec: inspection.requestedSpec }, { distributionService: service as never }, terminal);
    expect(lines.some((line) => line.includes("Downloading package"))).toBe(true);
    expect(lines.join("\n")).not.toContain("secret-op");
  });
  it("does not mutate after rejected confirmation", async () => {
    const { service, terminal } = setup(false);
    await runPackageCommand({ kind: "install", sourceSpec: inspection.requestedSpec }, { distributionService: service as never }, terminal);
    expect(service.install).not.toHaveBeenCalled(); expect(terminal.setExitCode).toHaveBeenCalledWith(0);
  });
  it("checks all updates and reports an empty result", async () => {
    const { service, terminal, lines } = setup();
    await runPackageCommand({ kind: "update" }, { distributionService: service as never }, terminal);
    expect(service.checkForUpdates).toHaveBeenCalledWith(); expect(lines).toContain("All managed packages are up to date.");
  });
  it("removes the reviewed package/version/run-count tuple", async () => {
    const { service, terminal } = setup();
    await runPackageCommand({ kind: "remove", sourceSpec: inspection.packageName }, { distributionService: service as never }, terminal);
    expect(service.remove).toHaveBeenCalledWith({ inspectionId: "remove-1", packageName: inspection.packageName, acceptedActiveVersion: "0.1.0", acceptedActiveRunCount: 2 });
  });
  it("maps service failures safely and always unsubscribes", async () => {
    const { service, terminal, lines, unsubscribe } = setup(); service.listMarketplaceCapabilities.mockRejectedValue(new Error("/private/token"));
    await runPackageCommand({ kind: "list" }, { distributionService: service as never }, terminal);
    expect(lines).toEqual(["Package operation failed."]); expect(terminal.setExitCode).toHaveBeenCalledWith(1); expect(unsubscribe).toHaveBeenCalledOnce();
  });
  it("maps cancellation to 130", async () => {
    const { service, terminal } = setup(); service.listMarketplaceCapabilities.mockRejectedValue(Object.assign(new Error("stopped"), { name: "AbortError" }));
    await runPackageCommand({ kind: "list" }, { distributionService: service as never }, terminal);
    expect(terminal.setExitCode).toHaveBeenCalledWith(130);
  });
});
