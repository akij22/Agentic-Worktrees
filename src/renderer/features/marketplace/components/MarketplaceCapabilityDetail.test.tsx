// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CapabilityDetailDto } from "../../../../shared/ipc/schemas";
import { MarketplaceCapabilityDetail } from "./MarketplaceCapabilityDetail";

afterEach(cleanup);
const capability: CapabilityDetailDto = {
  id: "community.search",
  name: "Community Search",
  description: "Search the web",
  version: "1.0.0",
  category: "search",
  compatibility: { codex: "supported", opencode: "supported" },
  state: "ready",
  secretConfigured: false,
  installationState: "available",
  source: "npm",
  packageName: "@community/search",
  trust: "community",
  reviewStatus: "unreviewed",
  sdkVersion: "^1",
  author: { name: "Community" },
  license: "MIT",
  permissions: { network: ["example.com"], secrets: ["TOKEN"] },
  settings: [],
  activeRunCount: 0,
  providedTools: ["web_search"],
  permissionDigest: "permissions-1",
};
const inspection = {
  inspectionId: "inspect-1",
  packageName: "@community/search",
  requestedSpec: "@community/search@1.0.0",
  resolvedVersion: "1.0.0",
  integrity: "sha512-safe",
  contentDigest: "content-1",
  trust: "community" as const,
  reviewStatus: "unreviewed" as const,
  releaseNotes: "Initial release",
  capability,
  permissionDigest: "permissions-1",
  expiresAt: new Date().toISOString(),
};
const handlers = {
  onInstall: vi.fn(),
  onRequestUpdate: vi.fn(),
  onUpdate: vi.fn(),
  onRequestRemoval: vi.fn(),
  onConfirmRemoval: vi.fn(),
  onCancelRemoval: vi.fn(),
  onCancel: vi.fn(),
};

describe("MarketplaceCapabilityDetail", () => {
  it("shows exact Community trust review before executable consent", () => {
    render(
      <MarketplaceCapabilityDetail
        capability={capability}
        inspection={inspection}
        {...handlers}
      />,
    );
    expect(
      screen.getByText(/contains executable code that has not been reviewed/i),
    ).toBeTruthy();
    expect(screen.getByText("@community/search")).toBeTruthy();
    expect(screen.getByText("sha512-safe")).toBeTruthy();
    expect(screen.getByText("permissions-1")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Install capability" }),
    ).toBeTruthy();
    expect(
      screen.queryByText(/Try now|See what it does|Vedi cosa fa|Prova ora/i),
    ).toBeNull();
  });

  it("shows setup preservation, permission changes, and downgrade consent", () => {
    const update = {
      packageName: "@community/search",
      capabilityId: capability.id,
      currentVersion: "2.0.0",
      candidateVersion: "1.0.0",
      releaseNotes: "Compatibility release",
      permissionChanged: true,
      downgrade: true,
      activeRunCount: 2,
    };
    render(
      <MarketplaceCapabilityDetail
        capability={{ ...capability, installationState: "needs_setup" }}
        inspection={{ ...inspection, update }}
        {...handlers}
      />,
    );
    expect(screen.getByText(/Setup is required/)).toBeTruthy();
    expect(screen.getByText(/Permissions changed/)).toBeTruthy();
    expect(screen.getByText(/older version/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm update" })).toBeTruthy();
  });

  it("renders an accessible removal review with immutable facts and back/confirm actions", () => {
    const removalReview = {
      inspectionId: "remove-1",
      packageName: "@community/search",
      capabilityId: capability.id,
      activeVersion: "1.0.0",
      activeIntegrity: "sha512-safe",
      activeContentDigest: "content",
      activeRunCount: 3,
      expiresAt: new Date().toISOString(),
    };
    render(
      <MarketplaceCapabilityDetail
        capability={{ ...capability, installationState: "installed" }}
        removalReview={removalReview}
        {...handlers}
      />,
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Review capability removal",
    });
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain("@community/search");
    expect(dialog.textContent).toContain("1.0.0");
    expect(dialog.textContent).toContain("3");
    screen.getByRole("button", { name: "Confirm removal" }).click();
    screen.getByRole("button", { name: "Back" }).click();
    expect(handlers.onConfirmRemoval).toHaveBeenCalledOnce();
    expect(handlers.onCancelRemoval).toHaveBeenCalledOnce();
  });

  it.each(["blocked", "incompatible", "migration_pending"] as const)(
    "renders %s as blocked",
    (installationState) => {
      render(
        <MarketplaceCapabilityDetail
          capability={{ ...capability, installationState }}
          {...handlers}
        />,
      );
      expect(screen.getByRole("alert").textContent).toMatch(
        /cannot be installed or selected/i,
      );
    },
  );
});
