"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { legalLinks } from "@/lib/legal";
import { createCookieChoiceStore, observeCookieChoiceStorage } from "@/lib/cookie-consent-state";

const consentKey = "steelprodukt-cookie-consent-v2";
const consentEvent = "steelprodukt-cookie-consent";
const settingsEvent = "steelprodukt-cookie-settings";

const choiceStore = createCookieChoiceStore(consentKey);
const getStorage = () => window.localStorage;

function readChoice() {
  return choiceStore.read(getStorage);
}

function saveChoice(analytics: boolean) {
  const persisted = choiceStore.write(analytics, getStorage);
  window.dispatchEvent(new Event(consentEvent));
  return persisted;
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
    Настройки файлов cookie
  </button>;
}

export function CookieConsent({ inline = false }: { inline?: boolean } = {}) {
  const [visible, setVisible] = useState(inline);
  const bannerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const calculatorPage = pathname === "/online-order" || pathname === "/calculator-metallokassety";
  const showHere = inline || !calculatorPage;

  useEffect(() => {
    const openSettings = () => {
      if (inline) document.getElementById("calculator-cookie-slot")?.removeAttribute("data-cookie-stored");
      setVisible(true);
      window.requestAnimationFrame(() => {
        bannerRef.current?.scrollIntoView({ block: "center" });
        bannerRef.current?.focus({ preventScroll: true });
      });
    };
    const syncChoice = () => {
      const missing = readChoice() === null;
      if (inline && missing) document.getElementById("calculator-cookie-slot")?.removeAttribute("data-cookie-stored");
      setVisible(missing);
    };
    syncChoice();
    const stopObservingStorage = observeCookieChoiceStorage({
      target: window, key: consentKey, consentEvent, getStorage,
    });
    window.addEventListener(settingsEvent, openSettings);
    window.addEventListener(consentEvent, syncChoice);
    return () => {
      stopObservingStorage();
      window.removeEventListener(settingsEvent, openSettings);
      window.removeEventListener(consentEvent, syncChoice);
    };
  }, [inline]);

  // The banner is how analytics consent is collected, so it has to stay visible and
  // clickable and must never be covered. So that the sticky quote bar does not end up
  // hidden underneath it, the banner publishes the height it occupies and the bar lifts
  // by exactly that much. The value is cleared the moment the banner leaves, and the bar
  // returns to the bottom edge.
  useEffect(() => {
    const root = document.documentElement;
    const clear = () => root.style.removeProperty("--cookie-consent-space");

    if (!visible || inline || !showHere) {
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
  }, [visible, inline, showHere]);

  function choose(analytics: boolean) {
    const analyticsWasAllowed = hasAnalyticsConsent();
    const persisted = saveChoice(analytics);
    setVisible(false);

    // The consent event stops the runtime first. Preserve the existing clean
    // reload only after verifying the refusal persisted; never reload into a
    // stale grant when storage is unavailable or rejected the change.
    if (analyticsWasAllowed && !analytics && persisted && choiceStore.canReloadAfterRevocation(getStorage)) {
      window.location.reload();
    }
  }

  if (!visible || !showHere) return null;

  const banner = <aside ref={bannerRef} tabIndex={-1} className={inline
    ? "cookie-consent-bar my-5 rounded-xl border border-white/20 bg-[#202831] p-4 sm:p-5"
    : "cookie-consent-bar fixed bottom-4 left-4 right-4 z-[90] border border-white/15 bg-[#151719]/95 p-4 shadow-2xl backdrop-blur-md sm:left-auto sm:right-6 sm:w-[min(510px,calc(100vw-48px))] sm:p-5"} aria-label="Настройки файлов cookie">
    <p className="text-sm font-semibold text-white">Настройки файлов cookie</p>
    <p className="mt-2 text-sm leading-relaxed text-white/80">Сайт использует необходимые технические файлы cookie и локальное хранилище браузера для работы форм и настроек. До вашего выбора аналитика выключена. Яндекс Метрика и Вебвизор включаются только после отдельного разрешения. Нажимая «Разрешить аналитику», вы даёте <Link prefetch={false} className="text-[#ff8a3d] underline underline-offset-2" href={legalLinks.analyticsConsent}>согласие на обработку данных для веб-аналитики</Link>. Вы можете продолжить без аналитики и в любой момент изменить выбор в подвале сайта. Подробнее — в <Link prefetch={false} className="text-[#ff8a3d] underline underline-offset-2" href={legalLinks.cookies}>политике файлов cookie</Link> и <Link prefetch={false} className="text-[#ff8a3d] underline underline-offset-2" href={legalLinks.privacy}>политике обработки данных</Link>.</p>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={() => choose(false)} className="border border-white/25 px-4 py-3 text-xs font-bold uppercase tracking-[.08em] text-white/80 transition hover:border-steel-orange hover:text-steel-orange">Продолжить без аналитики</button>
      <button type="button" onClick={() => choose(true)} className="clip-corner bg-steel-orange-deep px-4 py-3 text-xs font-bold uppercase tracking-[.08em] text-white transition hover:bg-steel-orange-deeper">Разрешить аналитику</button>
    </div>
  </aside>;
  return banner;
}

export { consentEvent, consentKey, hasAnalyticsConsent };
