"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

function readChoice(): CookieChoice | null {
  try {
    const stored = window.localStorage.getItem(consentKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<CookieChoice>;
    if (parsed.version !== 2 || parsed.necessary !== true || typeof parsed.analytics !== "boolean") return null;
    return parsed as CookieChoice;
  } catch {
    // Some private-browser and embedded-browser modes disable storage access.
    // Cookie consent must never prevent the website from opening in that case.
    return null;
  }
}

function saveChoice(analytics: boolean) {
  const choice: CookieChoice = {
    version: 2,
    necessary: true,
    analytics,
    updatedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(consentKey, JSON.stringify(choice));
  } catch {
    // Keep the choice for this page visit even if persistent storage is blocked.
  }
  window.dispatchEvent(new Event(consentEvent));
}

function hasAnalyticsConsent() {
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

  useEffect(() => {
    setVisible(readChoice() === null);
    const openSettings = () => setVisible(true);
    window.addEventListener(settingsEvent, openSettings);
    return () => window.removeEventListener(settingsEvent, openSettings);
  }, []);

  function choose(analytics: boolean) {
    saveChoice(analytics);
    setVisible(false);
  }

  if (!visible) return null;

  return <aside className="fixed bottom-4 left-4 right-4 z-[90] border border-white/15 bg-[#151719]/95 p-4 shadow-2xl backdrop-blur-md sm:left-auto sm:right-6 sm:w-[min(510px,calc(100vw-48px))] sm:p-5" aria-label="Настройки cookies">
    <p className="text-sm font-semibold text-white">Настройки cookies</p>
    <p className="mt-2 text-xs leading-relaxed text-white/60">Сайт использует только необходимые технические данные до вашего выбора. Яндекс Метрика загружается исключительно после отдельного согласия. Выбор можно изменить в подвале сайта. Подробнее — в <Link className="text-steel-orange underline-offset-2 hover:underline" href={legalLinks.cookies}>политике cookies</Link> и <Link className="text-steel-orange underline-offset-2 hover:underline" href={legalLinks.privacy}>политике обработки данных</Link>.</p>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={() => choose(false)} className="border border-white/25 px-4 py-3 text-xs font-bold uppercase tracking-[.08em] text-white/80 transition hover:border-steel-orange hover:text-steel-orange">Продолжить без аналитики</button>
      <button type="button" onClick={() => choose(true)} className="clip-corner bg-steel-orange px-4 py-3 text-xs font-bold uppercase tracking-[.08em] text-white transition hover:bg-orange-600">Разрешить аналитику</button>
    </div>
  </aside>;
}

export { consentEvent, consentKey, hasAnalyticsConsent };
