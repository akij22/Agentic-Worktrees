import { describe, expect, it } from "vitest";
import { InstalledCapabilityCatalog } from "./installed-catalog";

describe("InstalledCapabilityCatalog", () => {
  it("starts with an immutable empty snapshot", () => {
    const catalog = new InstalledCapabilityCatalog({} as never, { list: () => [] } as never);
    expect(catalog.list()).toEqual([]);
    expect(Object.isFrozen(catalog.list())).toBe(true);
  });
});
