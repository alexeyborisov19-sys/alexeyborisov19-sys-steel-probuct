"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { yandexCounterIds } from "@/lib/analytics";
import { consentEvent, hasAnalyticsConsent } from "./CookieConsent";

const counterIds = yandexCounterIds();

// Webvisor remains intentionally disabled in code. The published cookies and
// privacy policies state that enabling session recording requires a separate
// data-scope assessment and a policy update first, so an environment variable
// must not be able to switch it on silently.
const webvisorEnabled = false;

/**
 * Analytics remains completely inactive until the corresponding public IDs are
 * supplied in the deployment environment. This prevents accidental requests to
 * a third party during local development and before consent is configured.
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
      (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);
      })(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
${counterIds.map((counterId) => `      ym(${counterId}, 'init', {
        ssr:true,
        clickmap:true,
        trackLinks:true,
        accurateTrackBounce:true,
        webvisor:${webvisorEnabled ? "true" : "false"}
      });`).join("\n")}
    `}</Script> : null}
  </>;
}
