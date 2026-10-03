"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { flushPendingAnalyticsGoals, trackLeadEvent, yandexCounterIds } from "@/lib/analytics";
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
  const [runtimeReady, setRuntimeReady] = useState(false);
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  // Init records the current document. Next client navigation does not reload
  // that document, so record subsequent paths only while consent remains valid.
  useEffect(() => {
    if (!runtimeReady || !analyticsAllowed || !hasAnalyticsConsent() || !pathname) return;
    if (lastPath.current === pathname) return;
    const previousPath = lastPath.current;
    lastPath.current = pathname;
    if (!previousPath) return;
    const runtime = window as Window & { ym?: (id: number, command: string, path: string, options: { referer: string }) => void };
    for (const id of counterIds) runtime.ym?.(id, "hit", pathname, { referer: previousPath });
  }, [pathname, runtimeReady, analyticsAllowed]);

  // A tap on any phone link is a lead signal. One delegated listener covers the
  // header, footer, hero and contact blocks; the number itself is never sent.
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
    // Next's inline Script calls onReady before appending/executing its body.
    // Wait until that synchronous insertion creates ym and queues init; otherwise
    // goals collected during startup remain stranded with no later flush.
    queueMicrotask(() => {
      const runtime = window as Window & { ym?: unknown };
      if (!hasAnalyticsConsent() || typeof runtime.ym !== "function") return;
      lastPath.current = window.location.pathname;
      setRuntimeReady(true);
      flushPendingAnalyticsGoals();
    });
  }

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
    {counterIds.length ? <Script id="yandex-metrica" strategy="afterInteractive" onReady={analyticsReady}>{`
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
