// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PackageProgress } from "./PackageProgress";
afterEach(cleanup);
const progress = {
  operationId: "operation-1",
  action: "install" as const,
  stage: "verifying" as const,
  status: "in_progress" as const,
  updatedAt: new Date().toISOString(),
};
describe("PackageProgress", () => {
  it("reports the four stable path-free stages and cancellation", () => {
    render(<PackageProgress progress={progress} onCancel={vi.fn()} />);
    for (const stage of [
      "Resolving package",
      "Downloading package",
      "Verifying package",
      "Installing capability",
    ])
      expect(screen.getByText(stage)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Cancel operation" }),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /\/Users\/|node_modules|\.staging/,
    );
    expect(
      screen.getByRole("region", { name: "Package progress" }).className,
    ).toContain("motion-reduce:transition-none");
  });

  it("uses neutral recovery guidance after failure", () => {
    render(
      <PackageProgress
        progress={{ ...progress, status: "failed" }}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Return to the package review",
    );
    expect(
      screen.queryByRole("button", { name: "Cancel operation" }),
    ).toBeNull();
  });
});
