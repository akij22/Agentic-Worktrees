import type { CapabilityDistributionProgress } from "../../shared/packages/schemas";
import type { CapabilityDistributionService } from "../capabilities/capability-distribution-service";

export class MarketplaceEventSubscription {
  private service: CapabilityDistributionService | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly report: (code: "marketplace_event_unsubscribe_failed" | "marketplace_event_subscribe_failed" | "marketplace_event_callback_failed") => void = (code) => console.error(code),
  ) {}

  private safeReport(code: "marketplace_event_unsubscribe_failed" | "marketplace_event_subscribe_failed" | "marketplace_event_callback_failed"): void {
    try {
      this.report(code);
    } catch {
      // Reporting is observability-only and must not affect listener ownership.
    }
  }

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
      this.safeReport("marketplace_event_unsubscribe_failed");
    }
    if (!service) return;
    try {
      const unsubscribe = service.subscribe((event) => {
        if (this.service !== service) return;
        try {
          listener(event);
        } catch {
          this.safeReport("marketplace_event_callback_failed");
        }
      });
      this.service = service;
      this.unsubscribe = unsubscribe;
    } catch {
      this.service = null;
      this.unsubscribe = null;
      this.safeReport("marketplace_event_subscribe_failed");
    }
  }
}
