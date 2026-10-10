"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { discardPendingAnalyticsGoals } from "@/lib/analytics";
import { consentEvent, hasAnalyticsConsent } from "./CookieConsent";

type AnalyticsComponent = ComponentType;

/**
 * Keeps the vendor-specific analytics implementation out of the initial client
 * bundle. The Analytics module is requested only while analytics is allowed by
 * the visitor's explicit cookie preference. With no saved preference, analytics
 * stays disabled and the vendor module remains unloaded.
 */
export function ConsentGatedAnalytics() {
  const [AnalyticsComponent, setAnalyticsComponent] = useState<AnalyticsComponent | null>(null);

  useEffect(() => {
    let active = true;
    let revision = 0;

    async function syncConsent() {
      const requestRevision = ++revision;
      let allowed = false;
      try {
        allowed = hasAnalyticsConsent();
      } catch {
        allowed = false;
      }

      if (!allowed) {
        discardPendingAnalyticsGoals();
        if (active) setAnalyticsComponent(null);
        return;
      }

      try {
        const analyticsModule = await import("./Analytics");
        if (active && requestRevision === revision && hasAnalyticsConsent()) {
          setAnalyticsComponent(() => analyticsModule.Analytics);
        }
      } catch {
        // An optional analytics download must not break forms or the site.
        if (active && requestRevision === revision) setAnalyticsComponent(null);
      }
    }

    void syncConsent();
    window.addEventListener(consentEvent, syncConsent);
    return () => {
      active = false;
      revision += 1;
      window.removeEventListener(consentEvent, syncConsent);
    };
  }, []);

  return AnalyticsComponent ? <AnalyticsComponent /> : null;
}
