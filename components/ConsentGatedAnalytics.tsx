"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { consentEvent, hasAnalyticsConsent } from "./CookieConsent";

type AnalyticsComponent = ComponentType;

/** Keep vendor code out of the initial bundle and ignore obsolete imports
 * when the preference changes while a module is still downloading. */
export function ConsentGatedAnalytics() {
  const [AnalyticsComponent, setAnalyticsComponent] = useState<AnalyticsComponent | null>(null);

  useEffect(() => {
    let active = true;
    let revision = 0;

    async function syncConsent() {
      const requestRevision = ++revision;
      let allowed = false;
      try { allowed = hasAnalyticsConsent(); } catch { /* Fail closed. */ }

      if (!allowed) {
        if (active) setAnalyticsComponent(null);
        return;
      }

      try {
        const analyticsModule = await import("./Analytics");
        if (active && requestRevision === revision && hasAnalyticsConsent()) {
          setAnalyticsComponent(() => analyticsModule.Analytics);
        }
      } catch {
        // A failed optional analytics import must not break the website/forms.
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
