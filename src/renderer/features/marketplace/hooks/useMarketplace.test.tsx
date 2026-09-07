// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CapabilityChangedEventDto,
  CapabilityDetailDto,
} from "../../../../shared/ipc/schemas";
import type { CapabilityDistributionProgress } from "../../../../shared/packages/schemas";
import { useMarketplace } from "./useMarketplace";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const detail: CapabilityDetailDto = {
  id: "agentic.web",
  name: "Web Search",
  description: "Search",
  version: "1.0.0",
  category: "search",
  compatibility: { codex: "supported", opencode: "supported" },
  state: "ready",
  secretConfigured: false,
  installationState: "available",
  source: "npm",
  packageName: "@agentic/web",
  trust: "official",
  reviewStatus: "official-reviewed",
  sdkVersion: "^1",
  author: { name: "Agentic" },
  license: "MIT",
  permissions: { network: [], secrets: [] },
  settings: [],
  activeRunCount: 0,
  providedTools: ["search"],
  permissionDigest: "permissions",
};
const installedDetail = { ...detail, installationState: "installed" as const };
const item = { kind: "capability" as const, capability: detail };
const installedItem = {
  kind: "capability" as const,
  capability: installedDetail,
};
const otherDetail = {
  ...installedDetail,
  id: "agentic.other",
  name: "Other",
  version: "3.0.0",
  packageName: "@agentic/other",
};
const otherItem = { kind: "capability" as const, capability: otherDetail };
const update = {
  packageName: "@agentic/web",
  capabilityId: detail.id,
  currentVersion: "1.0.0",
  candidateVersion: "2.0.0",
  releaseNotes: "Safer permissions",
  permissionChanged: true,
  downgrade: false,
  activeRunCount: 2,
};
const inspection = {
  inspectionId: "inspection",
  packageName: "@agentic/web",
  requestedSpec: "@agentic/web",
  resolvedVersion: "1.0.0",
  integrity: "sha512-ok",
  contentDigest: "content",
  trust: "official" as const,
  reviewStatus: "official-reviewed" as const,
  releaseNotes: "",
  capability: detail,
  permissionDigest: "permissions",
  expiresAt: new Date().toISOString(),
};
const removalReview = {
  inspectionId: "removal",
  packageName: "@agentic/web",
  capabilityId: detail.id,
  activeVersion: "1.0.0",
  activeIntegrity: "sha512-old",
  activeContentDigest: "old-content",
  activeRunCount: 2,
  expiresAt: new Date().toISOString(),
};

function api() {
  return {
    marketplace: {
      list: vi.fn().mockResolvedValue([item]),
      inspect: vi.fn().mockResolvedValue(inspection),
      install: vi.fn().mockResolvedValue(installedDetail),
      update: vi.fn().mockResolvedValue(installedDetail),
      inspectRemoval: vi.fn().mockResolvedValue(removalReview),
      remove: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      retryPendingMigrations: vi.fn().mockResolvedValue(undefined),
      onPackageChanged: vi.fn(
        (_callback: (progress: CapabilityDistributionProgress) => void) =>
          vi.fn(),
      ),
    },
    capabilities: {
      get: vi.fn().mockResolvedValue(installedDetail),
      onChanged: vi.fn(
        (_callback: (event: CapabilityChangedEventDto) => void) => vi.fn(),
      ),
    },
    skills: { get: vi.fn(), install: vi.fn(), remove: vi.fn() },
  };
}

function Probe() {
  const market = useMarketplace();
  return (
    <>
      <span>{market.loading ? "loading" : market.phase}</span>
      <span>
        {market.items.map((entry) => entry.kind).join(",") || "empty"}
      </span>
      <span>{market.error}</span>
      <span>
        {market.removalReview ? "removal-review" : "no-removal-review"}
      </span>
      <span>{market.selected ? "selected" : "not-selected"}</span>
      <span>
        {market.detail && !("instructionPreview" in market.detail)
          ? `detail-${market.detail.id}-${market.detail.version}`
          : "no-detail"}
      </span>
      <input
        aria-label="query"
        value={market.query}
        onChange={(event) => market.setQuery(event.target.value)}
      />
      <button onClick={() => void market.select(item)}>select</button>
      <button onClick={() => void market.select(installedItem)}>
        select installed
      </button>
      <button onClick={() => void market.select(otherItem)}>
        select other
      </button>
      <button onClick={() => void market.inspectPackage(market.query)}>
        inspect
      </button>
      <button onClick={() => void market.installCapability()}>install</button>
      <button onClick={() => void market.requestUpdate()}>
        request update
      </button>
      <button onClick={() => void market.updateCapability()}>
        confirm update
      </button>
      <button onClick={() => void market.requestRemoval()}>
        request removal
      </button>
      <button onClick={() => void market.confirmRemoval()}>
        confirm removal
      </button>
      <button onClick={() => market.cancelRemoval()}>cancel removal</button>
      <button onClick={() => void market.cancelOperation()}>
        cancel operation
      </button>
    </>
  );
}

function installApi(mock: ReturnType<typeof api>) {
  Object.defineProperty(window, "api", { configurable: true, value: mock });
}

async function selectInstalled() {
  fireEvent.click(screen.getByRole("button", { name: "select installed" }));
  await waitFor(() => expect(screen.getByText("ready")).toBeTruthy());
}

describe("useMarketplace", () => {
  it("inspects an available Official item and passes the exact install acceptance tuple", async () => {
    const mock = api();
    installApi(mock);
    render(<Probe />);
    await screen.findByText("capability");
    fireEvent.click(screen.getByRole("button", { name: "select" }));
    await waitFor(() =>
      expect(mock.marketplace.inspect).toHaveBeenCalledWith({
        sourceSpec: "@agentic/web",
        officialCapabilityId: "agentic.web",
        intent: "install",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "install" }));
    await waitFor(() =>
      expect(mock.marketplace.install).toHaveBeenCalledWith({
        inspectionId: "inspection",
        acceptedPackageName: "@agentic/web",
        acceptedVersion: "1.0.0",
        acceptedIntegrity: "sha512-ok",
        acceptedPermissionDigest: "permissions",
      }),
    );
  });

  it.each([
    { downgrade: false, permissionChanged: true },
    { downgrade: true, permissionChanged: false },
  ])(
    "reviews and confirms an update with downgrade=$downgrade",
    async ({ downgrade, permissionChanged }) => {
      const mock = api();
      mock.marketplace.inspect.mockResolvedValue({
        ...inspection,
        resolvedVersion: downgrade ? "0.9.0" : "2.0.0",
        update: { ...update, downgrade, permissionChanged },
      });
      installApi(mock);
      render(<Probe />);
      await screen.findByText("capability");
      await selectInstalled();
      fireEvent.click(screen.getByRole("button", { name: "request update" }));
      await screen.findByText("review");
      fireEvent.click(screen.getByRole("button", { name: "confirm update" }));
      await waitFor(() =>
        expect(mock.marketplace.update).toHaveBeenCalledWith(
          expect.objectContaining({
            acceptedDowngrade: downgrade,
            acceptedActiveRunCount: 2,
            acceptedPermissionDigest: "permissions",
          }),
        ),
      );
    },
  );

  it("inspects removal, supports cancel without mutation, then removes with the exact review tuple", async () => {
    const mock = api();
    installApi(mock);
    render(<Probe />);
    await screen.findByText("capability");
    await selectInstalled();
    fireEvent.click(screen.getByRole("button", { name: "request removal" }));
    await screen.findByText("removal-review");
    expect(mock.marketplace.inspectRemoval).toHaveBeenCalledWith({
      packageName: "@agentic/web",
    });
    fireEvent.click(screen.getByRole("button", { name: "cancel removal" }));
    expect(mock.marketplace.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "request removal" }));
    await screen.findByText("removal-review");
    fireEvent.click(screen.getByRole("button", { name: "confirm removal" }));
    await waitFor(() =>
      expect(mock.marketplace.remove).toHaveBeenCalledWith({
        inspectionId: "removal",
        packageName: "@agentic/web",
        acceptedActiveVersion: "1.0.0",
        acceptedActiveRunCount: 2,
      }),
    );
  });

  it("tracks progress phases and cancels the active operation", async () => {
    const mock = api();
    let changed:
      ((progress: CapabilityDistributionProgress) => void) | undefined;
    mock.marketplace.onPackageChanged.mockImplementation((callback) => {
      changed = callback;
      return vi.fn();
    });
    installApi(mock);
    render(<Probe />);
    await screen.findByText("capability");
    changed?.({
      operationId: "op-1",
      action: "update",
      stage: "verifying",
      status: "in_progress",
      updatedAt: new Date().toISOString(),
    });
    await screen.findByText("updating");
    fireEvent.click(screen.getByRole("button", { name: "cancel operation" }));
    await waitFor(() =>
      expect(mock.marketplace.cancel).toHaveBeenCalledWith({
        operationId: "op-1",
      }),
    );
    await screen.findByText("ready");
  });

  it.each([false, true])(
    "handles pending migration retry failure=%s",
    async (fails) => {
      const mock = api();
      if (fails)
        mock.marketplace.retryPendingMigrations.mockRejectedValue(
          new Error("private"),
        );
      installApi(mock);
      render(<Probe />);
      await screen.findByText("capability");
      window.dispatchEvent(new Event("online"));
      await waitFor(() =>
        expect(mock.marketplace.retryPendingMigrations).toHaveBeenCalledOnce(),
      );
      if (fails)
        expect(
          await screen.findByText(/package operation could not be completed/i),
        ).toBeTruthy();
      else
        await waitFor(() =>
          expect(mock.marketplace.list).toHaveBeenCalledTimes(2),
        );
    },
  );

  it("refreshes selected capability detail on catalog changes and clears a removed selection", async () => {
    const mock = api();
    let catalogChanged:
      ((event: CapabilityChangedEventDto) => void) | undefined;
    mock.capabilities.onChanged.mockImplementation((callback) => {
      catalogChanged = callback;
      return vi.fn();
    });
    mock.marketplace.list.mockResolvedValue([installedItem]);
    installApi(mock);
    render(<Probe />);
    await screen.findByText("capability");
    await selectInstalled();
    expect(screen.getByText("detail-agentic.web-1.0.0")).toBeTruthy();

    mock.capabilities.get.mockResolvedValue({
      ...installedDetail,
      version: "2.0.0",
      permissionDigest: "permissions-2",
    });
    catalogChanged?.({
      scope: "catalog",
      capabilityId: detail.id,
      change: "updated",
      updatedAt: new Date().toISOString(),
    });
    expect(await screen.findByText("detail-agentic.web-2.0.0")).toBeTruthy();
    expect(screen.getByText("selected")).toBeTruthy();

    mock.marketplace.list.mockResolvedValue([]);
    catalogChanged?.({
      scope: "catalog",
      capabilityId: detail.id,
      change: "removed",
      updatedAt: new Date().toISOString(),
    });
    expect(await screen.findByText("no-detail")).toBeTruthy();
    expect(screen.getByText("not-selected")).toBeTruthy();
  });

  it("does not let an old catalog refresh overwrite a newer selection", async () => {
    const mock = api();
    let catalogChanged:
      ((event: CapabilityChangedEventDto) => void) | undefined;
    mock.capabilities.onChanged.mockImplementation((callback) => {
      catalogChanged = callback;
      return vi.fn();
    });
    mock.marketplace.list.mockResolvedValue([installedItem, otherItem]);
    mock.capabilities.get.mockImplementation(async ({ capabilityId }) =>
      capabilityId === otherDetail.id ? otherDetail : installedDetail,
    );
    installApi(mock);
    render(<Probe />);
    await screen.findByText("capability,capability");
    await selectInstalled();

    let resolveList!: (items: (typeof installedItem)[]) => void;
    mock.marketplace.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    catalogChanged?.({
      scope: "catalog",
      capabilityId: detail.id,
      change: "updated",
      updatedAt: new Date().toISOString(),
    });
    fireEvent.click(screen.getByRole("button", { name: "select other" }));
    expect(await screen.findByText("detail-agentic.other-3.0.0")).toBeTruthy();
    resolveList([installedItem]);
    await waitFor(() =>
      expect(screen.getByText("detail-agentic.other-3.0.0")).toBeTruthy(),
    );
    expect(mock.capabilities.get).toHaveBeenCalledTimes(2);
  });

  it("does not update state when unmounted during a catalog refresh", async () => {
    const mock = api();
    let catalogChanged:
      ((event: CapabilityChangedEventDto) => void) | undefined;
    mock.capabilities.onChanged.mockImplementation((callback) => {
      catalogChanged = callback;
      return vi.fn();
    });
    mock.marketplace.list.mockResolvedValue([installedItem]);
    installApi(mock);
    const view = render(<Probe />);
    await screen.findByText("capability");
    await selectInstalled();
    let resolveList!: (items: (typeof installedItem)[]) => void;
    mock.marketplace.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    catalogChanged?.({
      scope: "catalog",
      capabilityId: detail.id,
      change: "updated",
      updatedAt: new Date().toISOString(),
    });
    const detailCalls = mock.capabilities.get.mock.calls.length;
    view.unmount();
    resolveList([installedItem]);
    await Promise.resolve();
    await Promise.resolve();
    expect(mock.capabilities.get).toHaveBeenCalledTimes(detailCalls);
  });

  it("cleans up subscriptions and uses a safe load error", async () => {
    const mock = api();
    mock.marketplace.list.mockRejectedValue(
      new Error("/Users/private/.staging/token"),
    );
    installApi(mock);
    const view = render(<Probe />);
    expect(
      await screen.findByText(/Could not load Marketplace items/),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("/Users/private");
    view.unmount();
    expect(
      mock.marketplace.onPackageChanged.mock.results[0]?.value,
    ).toHaveBeenCalled();
    expect(
      mock.capabilities.onChanged.mock.results[0]?.value,
    ).toHaveBeenCalled();
  });
});
