"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { flushPendingAnalyticsGoals, trackLeadEvent, yandexCounterIds } from "@/lib/analytics";
import { createMetrikaLifecycle, type MetrikaRuntime } from "@/lib/analytics-runtime-control";
import { consentEvent, hasAnalyticsConsent } from "./CookieConsent";

const counterIds = yandexCounterIds();
const webvisorEnabled = process.env.NEXT_PUBLIC_YM_WEBVISOR === "true";
const lifecycle = createMetrikaLifecycle(counterIds, {
  ssr: true,
  clickmap: true,
  trackLinks: true,
  accurateTrackBounce: true,
  webvisor: webvisorEnabled,
  ecommerce: "dataLayer",
});

/** No vendor script, preconnect or tracking pixel is loaded before consent.
 * Initialization rechecks the live preference; revocation also destroys an
 * already running counter when blocked storage makes a reload unsafe. */
export function Analytics() {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!runtimeReady || !analyticsAllowed || !hasAnalyticsConsent() || !pathname) return;
    if (lastPath.current === pathname) return;
    const previousPath = lastPath.current;
    lastPath.current = pathname;
    if (!previousPath) return;
    const runtime = window as Window & MetrikaRuntime;
    for (const id of counterIds) runtime.ym?.(id, "hit", pathname, { referer: previousPath });
  }, [pathname, runtimeReady, analyticsAllowed]);

  // A contact tap is not an accepted lead; never send the telephone number.
  useEffect(() => {
    function trackPhoneClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest('a[href^="tel:"]');
      if (!link) return;
      const area = link.closest("header") ? "header" : link.closest("footer") ? "footer" : "page";
      trackLeadEvent("phone_click", { link_location: area, page_path: window.location.pathname });
    }
    document.addEventListener("click", trackPhoneClick, { capture: true });
    return () => document.removeEventListener("click", trackPhoneClick, { capture: true });
  }, []);

  function analyticsReady() {
    // Next Script invokes onReady again on remount. The lifecycle deduplicates
    // normal mounts and permits a fresh initialization after an explicit regrant.
    if (!lifecycle.start(window as Window & MetrikaRuntime, hasAnalyticsConsent())) {
      setRuntimeReady(false);
      return;
    }
    lastPath.current = window.location.pathname;
    setRuntimeReady(true);
    flushPendingAnalyticsGoals();
  }

  useEffect(() => {
    function syncConsent() {
      let allowed = false;
      try { allowed = hasAnalyticsConsent(); } catch { /* Fail closed. */ }
      if (!allowed) {
        lifecycle.stop(window as Window & MetrikaRuntime);
        setRuntimeReady(false);
        lastPath.current = null;
      }
      setAnalyticsAllowed(allowed);
    }
    syncConsent();
    window.addEventListener(consentEvent, syncConsent);
    return () => window.removeEventListener(consentEvent, syncConsent);
  }, []);

  if (!analyticsAllowed) return null;

  return <>
    {counterIds.length ? <Script id="yandex-metrica" strategy="afterInteractive" onReady={analyticsReady}>{`
      window.dataLayer = window.dataLayer || [];
      var metrikaTagUrl = 'https://mc.yandex.ru/metrika/tag.js?id=${counterIds[0]}';
      (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);
      })(window,document,'script',metrikaTagUrl,'ym');
    `}</Script> : null}
  </>;
}
