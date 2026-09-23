"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { legalLinks } from "@/lib/legal";

const consentKey = "steelprodukt-cookie-consent-v2";
const consentEvent = "steelprodukt-cookie-consent";
const settingsEvent = "steelprodukt-cookie-settings";

type CookieChoice = {
  version: 2;
  necessary: true;
  analytics: boolean;
  updatedAt: string;
};

// Private/embedded browsers can deny localStorage. Keep the visitor's explicit
// choice for the lifetime of the current document so the banner and analytics
// behaviour still match the button they pressed, without inventing persistence.
let transientChoice: CookieChoice | null = null;

function readChoice(): CookieChoice | null {
  try {
    const stored = window.localStorage.getItem(consentKey);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<CookieChoice>;
      if (parsed.version === 2 && parsed.necessary === true && typeof parsed.analytics === "boolean") {
        return parsed as CookieChoice;
      }
    }
  } catch {
    // Some private-browser and embedded-browser modes disable storage access.
  }
  return transientChoice;
}

function saveChoice(analytics: boolean) {
  const choice: CookieChoice = {
    version: 2,
    necessary: true,
    analytics,
    updatedAt: new Date().toISOString(),
  };
  transientChoice = choice;
  try {
    window.localStorage.setItem(consentKey, JSON.stringify(choice));
  } catch {
    // The in-memory choice above keeps consent consistent for this page visit.
  }
  window.dispatchEvent(new Event(consentEvent));
}

function hasAnalyticsConsent() {
  // The published policy requires an explicit choice. Missing, malformed or
  // unavailable storage is not permission to load analytics or Webvisor.
  return readChoice()?.analytics === true;
}

export function CookieSettingsButton({ className = "" }: { className?: string }) {
  return <button
    type="button"
    className={className}
    onClick={() => window.dispatchEvent(new Event(settingsEvent))}
  >
    Настройки cookies
  </button>;
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const bannerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setVisible(readChoice() === null);
    const openSettings = () => setVisible(true);
    window.addEventListener(settingsEvent, openSettings);
    return () => window.removeEventListener(settingsEvent, openSettings);
  }, []);

  // The banner is how analytics consent is collected, so it has to stay visible and
  // clickable and must never be covered. So that the sticky quote bar does not end up
  // hidden underneath it, the banner publishes the height it occupies and the bar lifts
  // by exactly that much. The value is cleared the moment the banner leaves, and the bar
  // returns to the bottom edge.
  useEffect(() => {
    const root = document.documentElement;
    const clear = () => root.style.removeProperty("--cookie-consent-space");

    if (!visible) {
      clear();
      return;
    }

    const node = bannerRef.current;
    if (!node) return;

    // The banner height plus its own bottom offset and a gap before the bar.
    const publish = () => root.style.setProperty("--cookie-consent-space", `${node.offsetHeight + 28}px`);
    publish();

    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(publish) : null;
    observer?.observe(node);
    window.addEventListener("resize", publish);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", publish);
      clear();
    };
  }, [visible]);

  function choose(analytics: boolean) {
    const analyticsWasAllowed = hasAnalyticsConsent();
    saveChoice(analytics);
    setVisible(false);

    // If analytics was active during this page session, unmounting the Script
    // component cannot undo JavaScript that the vendor tag has already executed.
    // Reload after an opt-out so the next document starts without the tag.
    if (analyticsWasAllowed && analytics === false) {
      window.location.reload();
    }
  }

  if (!visible) return null;

  return <aside ref={bannerRef} className="cookie-consent-bar fixed bottom-4 left-4 right-4 z-[90] border border-white/15 bg-[#151719]/95 p-4 shadow-2xl backdrop-blur-md sm:left-auto sm:right-6 sm:w-[min(510px,calc(100vw-48px))] sm:p-5" aria-label="Настройки cookies">
    <p className="text-sm font-semibold text-white">Настройки cookies</p>
    <p className="mt-2 text-xs leading-relaxed text-white/60">Сайт использует необходимые cookies для работы форм и настроек. До вашего выбора аналитика выключена. Яндекс Метрика и Вебвизор включаются только после отдельного разрешения. Вы можете продолжить без аналитики и в любой момент изменить выбор в подвале сайта. Подробнее — в <Link prefetch={false} className="text-steel-orange underline-offset-2 hover:underline" href={legalLinks.cookies}>политике cookies</Link> и <Link prefetch={false} className="text-steel-orange underline-offset-2 hover:underline" href={legalLinks.privacy}>политике обработки данных</Link>.</p>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={() => choose(false)} className="border border-white/25 px-4 py-3 text-xs font-bold uppercase tracking-[.08em] text-white/80 transition hover:border-steel-orange hover:text-steel-orange">Продолжить без аналитики</button>
      <button type="button" onClick={() => choose(true)} className="clip-corner bg-steel-orange-deep px-4 py-3 text-xs font-bold uppercase tracking-[.08em] text-white transition hover:bg-steel-orange-deeper">Разрешить аналитику</button>
    </div>
  </aside>;
}

export { consentEvent, consentKey, hasAnalyticsConsent };
