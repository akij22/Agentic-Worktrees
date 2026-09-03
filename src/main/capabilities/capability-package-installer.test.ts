import { describe, expect, it } from "vitest";
import { CapabilityPackageInstaller } from "./capability-package-installer";

describe("CapabilityPackageInstaller", () => {
  it("fails closed when executable verification does not match staged content", async () => {
    const installer = new CapabilityPackageInstaller({} as never, {} as never);
    const inspected = { staged: { contentDigest: "a" }, descriptor: { manifest: { id: "x", version: "1.0.0" } } } as never;
    await expect(installer.commitFresh(inspected, { capabilityId: "x", version: "1.0.0", contentDigest: "b", toolNames: [] })).rejects.toThrow("package_verification_failed");
  });
});
