import { describe, expect, it, vi } from "vitest";
import { CapabilityDistributionService } from "./capability-distribution-service";

describe("CapabilityDistributionService", () => {
  it("does not invoke executable verification before consent", async () => {
    const verify = vi.fn();
    const service = new CapabilityDistributionService({ layout: {} as never, verifier: { verify }, repository: {} as never, installer: {} as never });
    expect(verify).not.toHaveBeenCalled();
    await expect(service.install({ inspectionId: "missing", acceptedPackageName: "example", acceptedVersion: "1.0.0", acceptedIntegrity: "i", acceptedPermissionDigest: "p" })).rejects.toThrow();
    expect(verify).not.toHaveBeenCalled();
  });
});
