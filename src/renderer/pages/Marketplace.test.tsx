// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const select = vi.fn();
const setFilter = vi.fn();
const setQuery = vi.fn();
const installSkill = vi.fn();
const capability = {
  id: "web", name: "Web Search", description: "Search", version: "1", category: "search", source: "npm",
  compatibility: { codex: "supported", opencode: "supported" }, state: "ready", installationState: "available",
  trust: "official", packageName: "@agentic/web",
};
const skill = { id: "review", name: "Review", description: "Review code", version: "1", source: "local", compatibility: { codex: "supported", opencode: "supported" }, installationState: "installed", automaticInvocation: true };

vi.mock("../features/marketplace/hooks/useMarketplace", () => ({
  useMarketplace: () => ({
    items: [{ kind: "capability", capability }, { kind: "skill", skill }], selected: undefined, detail: undefined,
    loading: false, filter: "all", query: "", isExactSpec: false, error: undefined,
    select, setFilter, setQuery, installSkill, refresh: vi.fn(), inspectPackage: vi.fn(),
  }),
}));

import { Marketplace } from "./Marketplace";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Marketplace", () => {
  it("shows distinct item badges and exposes all filters", () => {
    render(<MemoryRouter><Marketplace /></MemoryRouter>);
    expect(screen.getByText("capability")).toBeTruthy();
    expect(screen.getByText("skill")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skills" }));
    expect(setFilter).toHaveBeenCalledWith("skill");
    expect(screen.getByRole("button", { name: "Installed" })).toBeTruthy();
  });

  it("imports a local Skill through the pathless API action", () => {
    render(<MemoryRouter><Marketplace /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Import local Skill" }));
    expect(installSkill).toHaveBeenCalled();
  });

  it("delegates Marketplace search input to the hook", () => {
    render(<MemoryRouter><Marketplace /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Search Official items or enter an npm package"), { target: { value: "missing" } });
    expect(setQuery).toHaveBeenCalledWith("missing");
  });

  it("keeps the header compact before an item is selected", () => {
    render(<MemoryRouter><Marketplace /></MemoryRouter>);
    const marketplace = screen.getByRole("region", { name: "Marketplace" });
    expect(marketplace.className).toContain("lg:grid-rows-[auto_minmax(0,1fr)]");
  });
});
