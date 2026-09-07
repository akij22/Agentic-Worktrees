// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CapabilityDetailDto } from "../../../../shared/ipc/schemas";
import { MarketplaceCapabilityDetail } from "./MarketplaceCapabilityDetail";

afterEach(cleanup);
const capability: CapabilityDetailDto = { id: "community.search", name: "Community Search", description: "Search the web", version: "1.0.0", category: "search", compatibility: { codex: "supported", opencode: "supported" }, state: "ready", secretConfigured: false, installationState: "available", source: "npm", packageName: "@community/search", trust: "community", reviewStatus: "unreviewed", sdkVersion: "^1", author: { name: "Community" }, license: "MIT", permissions: { network: ["example.com"], secrets: ["TOKEN"] }, settings: [], activeRunCount: 0, providedTools: ["web_search"], permissionDigest: "permissions-1" };
const inspection = { inspectionId: "inspect-1", packageName: "@community/search", requestedSpec: "@community/search@1.0.0", resolvedVersion: "1.0.0", integrity: "sha512-safe", contentDigest: "content-1", trust: "community" as const, reviewStatus: "unreviewed" as const, releaseNotes: "Initial release", capability, permissionDigest: "permissions-1", expiresAt: new Date().toISOString() };
const handlers = { onInstall: vi.fn(), onRequestUpdate: vi.fn(), onUpdate: vi.fn(), onRemove: vi.fn(), onCancel: vi.fn() };

describe("MarketplaceCapabilityDetail", () => {
  it("shows exact Community trust review before executable consent", () => {
    render(<MarketplaceCapabilityDetail capability={capability} inspection={inspection} {...handlers} />);
    expect(screen.getByText(/contains executable code that has not been reviewed/i)).toBeTruthy();
    expect(screen.getByText("@community/search")).toBeTruthy();
    expect(screen.getByText("sha512-safe")).toBeTruthy();
    expect(screen.getByText("permissions-1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Install capability" })).toBeTruthy();
    expect(screen.queryByText(/Try now|See what it does|Vedi cosa fa|Prova ora/i)).toBeNull();
  });

  it.each(["blocked", "incompatible", "migration_pending"] as const)("renders %s as blocked", (installationState) => {
    render(<MarketplaceCapabilityDetail capability={{ ...capability, installationState }} {...handlers} />);
    expect(screen.getByRole("alert").textContent).toMatch(/cannot be installed or selected/i);
  });
});
