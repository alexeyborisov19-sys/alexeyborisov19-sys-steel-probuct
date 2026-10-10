"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushPendingAnalyticsGoals, trackLeadEvent, yandexCounterIds } from "@/lib/analytics";
import { createMetrikaLifecycle, type MetrikaCommand, type MetrikaRuntime } from "@/lib/analytics-runtime-control";
import { consentEvent, hasAnalyticsConsent } from "./CookieConsent";

const counterIds = yandexCounterIds();
const webvisorEnabled = process.env.NEXT_PUBLIC_YM_WEBVISOR === "true";
const lifecycle = createMetrikaLifecycle(counterIds, {
  ssr: true, clickmap: true, trackLinks: true, accurateTrackBounce: true,
  webvisor: webvisorEnabled, ecommerce: "dataLayer",
});

function ensureMetrikaTag(runtime: Window & MetrikaRuntime) {
  if (!counterIds.length) return;
  if (!runtime.ym) {
    const queue: MetrikaCommand = (...args) => { (queue.a ??= []).push(args); };
    queue.l = Date.now();
    runtime.ym = queue;
  }
  const metrikaTagUrl = `https://mc.yandex.ru/metrika/tag.js?id=${counterIds[0]}`;
  if (Array.from(document.scripts).some(script => script.src === metrikaTagUrl)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = metrikaTagUrl;
  const first = document.getElementsByTagName("script")[0];
  if (first?.parentNode) first.parentNode.insertBefore(script, first);
  else document.head.appendChild(script);
}

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
  const mounted = useRef(true);
  const readyRevision = useRef(0);

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

  const analyticsReady = useCallback(() => {
    // Next's inline Script calls onReady before appending/executing its body.
    // Preserve that microtask boundary, but insert the vendor tag only here,
    // after rechecking live consent, so even a stale Script effect cannot load it.
    // Cached Script remounts use the same guarded initialization path.
    const revision = readyRevision.current;
    queueMicrotask(() => {
      if (!mounted.current || revision !== readyRevision.current) return;
      const runtime = window as Window & MetrikaRuntime;
      if (!hasAnalyticsConsent()) { lifecycle.stop(runtime); return; }
      try { ensureMetrikaTag(runtime); } catch { return; }
      if (!lifecycle.start(runtime, true)) return;
      lastPath.current = window.location.pathname;
      setRuntimeReady(true);
      flushPendingAnalyticsGoals();
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    function syncConsent() {
      let allowed = false;
      try { allowed = hasAnalyticsConsent(); } catch { /* Fail closed. */ }
      if (!allowed) {
        readyRevision.current += 1;
        lifecycle.stop(window as Window & MetrikaRuntime);
        setRuntimeReady(false);
        lastPath.current = null;
      }
      setAnalyticsAllowed(allowed);
      // Rapid revoke/regrant can be batched without remounting Next's cached
      // Script. Its onReady callback then does not run again.
      if (allowed && typeof (window as Window & MetrikaRuntime).ym === "function") analyticsReady();
    }

    syncConsent();
    window.addEventListener(consentEvent, syncConsent);
    return () => {
      mounted.current = false;
      readyRevision.current += 1;
      lifecycle.stop(window as Window & MetrikaRuntime);
      window.removeEventListener(consentEvent, syncConsent);
    };
  }, [analyticsReady]);

  if (!analyticsAllowed) return null;

  return <>
    {counterIds.length ? <Script id="yandex-metrica" strategy="afterInteractive" onReady={analyticsReady}>{`
      window.dataLayer = window.dataLayer || [];
    `}</Script> : null}
  </>;
}
