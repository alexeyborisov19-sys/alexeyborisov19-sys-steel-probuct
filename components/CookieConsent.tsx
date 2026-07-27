"use client";

import { useEffect, useState } from "react";

type Consent = { analytics?: boolean } | null;

function safeGetLocalStorage(key: string): string | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function safeSetLocalStorage(key: string, value: string): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(key, value);
  } catch (e) {
    // swallow — storage not available
  }
}

export function getStoredConsent(): Consent {
  try {
    const raw = safeGetLocalStorage("site_cookie_consent");
    if (!raw) return null;
    return JSON.parse(raw) as Consent;
  } catch (e) {
    return null;
  }
}

export function setStoredConsent(value: Consent) {
  try {
    if (value === null) {
      safeSetLocalStorage("site_cookie_consent", "");
      return;
    }
    safeSetLocalStorage("site_cookie_consent", JSON.stringify(value));
  } catch (e) {
    // ignore storage errors
  }
}

export function CookieConsent() {
  const [consent, setConsent] = useState<Consent>(null);

  useEffect(() => {
    setConsent(getStoredConsent());
  }, []);

  const accept = () => {
    const next = { analytics: true };
    setConsent(next);
    setStoredConsent(next);
  };

  const decline = () => {
    const next = { analytics: false };
    setConsent(next);
    setStoredConsent(next);
  };

  if (consent !== null) return null;

  return (
    <div className="cookie-consent">
      <p>Мы используем cookies для аналитики. Можно принять или отклонить.</p>
      <button onClick={accept}>Принять</button>
      <button onClick={decline}>Отклонить</button>
    </div>
  );
}

export default CookieConsent;
