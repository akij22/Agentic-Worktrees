// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CapabilityDetailDto } from "../../../../shared/ipc/schemas";
import { useMarketplace } from "./useMarketplace";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const detail: CapabilityDetailDto = { id: "agentic.web", name: "Web Search", description: "Search", version: "1.0.0", category: "search", compatibility: { codex: "supported", opencode: "supported" }, state: "ready", secretConfigured: false, installationState: "available", source: "npm", packageName: "@agentic/web", trust: "official", reviewStatus: "official-reviewed", sdkVersion: "^1", author: { name: "Agentic" }, license: "MIT", permissions: { network: [], secrets: [] }, settings: [], activeRunCount: 0, providedTools: ["search"], permissionDigest: "permissions" };
const item = { kind: "capability" as const, capability: detail };
const inspection = { inspectionId: "inspection", packageName: "@agentic/web", requestedSpec: "@agentic/web", resolvedVersion: "1.0.0", integrity: "sha512-ok", contentDigest: "content", trust: "official" as const, reviewStatus: "official-reviewed" as const, releaseNotes: "", capability: detail, permissionDigest: "permissions", expiresAt: new Date().toISOString() };
function api() {
  return { marketplace: { list: vi.fn().mockResolvedValue([item]), inspect: vi.fn().mockResolvedValue(inspection), install: vi.fn().mockResolvedValue({ ...detail, installationState: "installed" }), update: vi.fn(), inspectRemoval: vi.fn(), remove: vi.fn(), cancel: vi.fn(), retryPendingMigrations: vi.fn().mockResolvedValue(undefined), onPackageChanged: vi.fn(() => vi.fn()) }, capabilities: { get: vi.fn().mockResolvedValue(detail), onChanged: vi.fn(() => vi.fn()) }, skills: { get: vi.fn(), install: vi.fn(), remove: vi.fn() } };
}
function Probe() {
  const market = useMarketplace();
  return <><span>{market.loading ? "loading" : market.phase}</span><span>{market.items.map((entry) => entry.kind).join(",") || "empty"}</span><span>{market.error}</span><input aria-label="query" value={market.query} onChange={(event) => market.setQuery(event.target.value)} /><button onClick={() => void market.select(item)}>select</button><button onClick={() => void market.inspectPackage(market.query)}>inspect</button><button onClick={() => void market.installCapability()}>install</button></>;
}

describe("useMarketplace", () => {
  it("loads the marketplace API and inspects an available Official item as data", async () => {
    const mock = api(); Object.defineProperty(window, "api", { configurable: true, value: mock });
    render(<Probe />); await screen.findByText("capability"); fireEvent.click(screen.getByRole("button", { name: "select" }));
    await waitFor(() => expect(mock.marketplace.inspect).toHaveBeenCalledWith({ sourceSpec: "@agentic/web", officialCapabilityId: "agentic.web", intent: "install" }));
  });

  it("passes the exact acceptance tuple and cleans up subscriptions", async () => {
    const mock = api(); Object.defineProperty(window, "api", { configurable: true, value: mock });
    const view = render(<Probe />); await screen.findByText("capability"); fireEvent.change(screen.getByLabelText("query"), { target: { value: "@agentic/web@1.0.0" } }); fireEvent.click(screen.getByRole("button", { name: "inspect" })); await screen.findByText("review"); fireEvent.click(screen.getByRole("button", { name: "install" }));
    await waitFor(() => expect(mock.marketplace.install).toHaveBeenCalledWith({ inspectionId: "inspection", acceptedPackageName: "@agentic/web", acceptedVersion: "1.0.0", acceptedIntegrity: "sha512-ok", acceptedPermissionDigest: "permissions" }));
    view.unmount(); expect(mock.marketplace.onPackageChanged.mock.results[0]?.value).toHaveBeenCalled(); expect(mock.capabilities.onChanged.mock.results[0]?.value).toHaveBeenCalled();
  });

  it("retries pending migrations when connectivity returns", async () => {
    const mock = api(); Object.defineProperty(window, "api", { configurable: true, value: mock }); render(<Probe />); await screen.findByText("capability"); window.dispatchEvent(new Event("online")); await waitFor(() => expect(mock.marketplace.retryPendingMigrations).toHaveBeenCalledOnce());
  });

  it("uses a safe load error without leaking backend details", async () => {
    const mock = api(); mock.marketplace.list.mockRejectedValue(new Error("/Users/private/.staging/token")); Object.defineProperty(window, "api", { configurable: true, value: mock }); render(<Probe />); expect(await screen.findByText(/Could not load Marketplace items/)).toBeTruthy(); expect(document.body.textContent).not.toContain("/Users/private");
  });
});
