import type { CapabilityDistributionProgress } from "../../shared/packages/schemas";
import type { CapabilityDistributionService } from "../capabilities/capability-distribution-service";

export class MarketplaceEventSubscription {
  private service: CapabilityDistributionService | null = null;
  private unsubscribe: (() => void) | null = null;

  configure(
    service: CapabilityDistributionService | null,
    listener: (event: CapabilityDistributionProgress) => void,
  ): void {
    if (this.service === service) return;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.service = service;
    if (service) this.unsubscribe = service.subscribe(listener);
  }
}
