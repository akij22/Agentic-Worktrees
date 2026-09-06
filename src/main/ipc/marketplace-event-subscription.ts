import type { CapabilityDistributionProgress } from "../../shared/packages/schemas";
import type { CapabilityDistributionService } from "../capabilities/capability-distribution-service";

export class MarketplaceEventSubscription {
  private service: CapabilityDistributionService | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly report: (code: "marketplace_event_unsubscribe_failed" | "marketplace_event_subscribe_failed") => void = (code) => console.error(code),
  ) {}

  configure(
    service: CapabilityDistributionService | null,
    listener: (event: CapabilityDistributionProgress) => void,
  ): void {
    if (this.service === service) return;
    const priorUnsubscribe = this.unsubscribe;
    this.unsubscribe = null;
    this.service = null;
    try {
      priorUnsubscribe?.();
    } catch {
      this.report("marketplace_event_unsubscribe_failed");
    }
    if (!service) return;
    try {
      const unsubscribe = service.subscribe((event) => {
        if (this.service !== service) return;
        try {
          listener(event);
        } catch {
          // Distribution observers must never destabilize startup or teardown.
        }
      });
      this.service = service;
      this.unsubscribe = unsubscribe;
    } catch {
      this.service = null;
      this.unsubscribe = null;
      this.report("marketplace_event_subscribe_failed");
    }
  }
}
