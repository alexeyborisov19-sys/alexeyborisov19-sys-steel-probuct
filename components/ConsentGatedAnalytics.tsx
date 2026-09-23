"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
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

    async function syncConsent() {
      let allowed = false;
      try {
        allowed = hasAnalyticsConsent();
      } catch {
        allowed = false;
      }

      if (!allowed) {
        if (active) setAnalyticsComponent(null);
        return;
      }

      const analyticsModule = await import("./Analytics");
      if (active) setAnalyticsComponent(() => analyticsModule.Analytics);
    }

    void syncConsent();
    window.addEventListener(consentEvent, syncConsent);
    return () => {
      active = false;
      window.removeEventListener(consentEvent, syncConsent);
    };
  }, []);

  return AnalyticsComponent ? <AnalyticsComponent /> : null;
}
