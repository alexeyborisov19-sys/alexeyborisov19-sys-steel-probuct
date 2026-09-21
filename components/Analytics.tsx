"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { yandexCounterIds } from "@/lib/analytics";
import { consentEvent, hasAnalyticsConsent } from "./CookieConsent";

const counterIds = yandexCounterIds();
const webvisorEnabled = process.env.NEXT_PUBLIC_YM_WEBVISOR === "true";

/**
 * Analytics remains inactive unless the canonical public counter ID is supplied
 * in the deployment environment AND the visitor explicitly permits analytics.
 * No vendor script, preconnect or tracking pixel is loaded before consent.
 * The counter-specific tag URL matches the code returned by Metrika Management
 * API for the ssr-enabled counter. Configuration must not expose contact data.
 */
export function Analytics() {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    function syncConsent() {
      try {
        setAnalyticsAllowed(hasAnalyticsConsent());
      } catch {
        // Storage can be blocked in private or embedded browser modes.
        // In that case analytics stays disabled and the site remains usable.
        setAnalyticsAllowed(false);
      }
    }

    syncConsent();
    window.addEventListener(consentEvent, syncConsent);
    return () => window.removeEventListener(consentEvent, syncConsent);
  }, []);

  if (!analyticsAllowed) return null;

  return <>
    {counterIds.length ? <Script id="yandex-metrica" strategy="afterInteractive">{`
      window.dataLayer = window.dataLayer || [];
      var metrikaTagUrl = 'https://mc.yandex.ru/metrika/tag.js?id=${counterIds[0]}';
      (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);
      })(window,document,'script',metrikaTagUrl,'ym');
${counterIds.map((counterId) => `      ym(${counterId}, 'init', {
        ssr:true,
        clickmap:true,
        trackLinks:true,
        accurateTrackBounce:true,
        webvisor:${webvisorEnabled ? "true" : "false"},
        ecommerce:"dataLayer"
      });`).join("\n")}
    `}</Script> : null}
  </>;
}
