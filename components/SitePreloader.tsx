"use client";

import { useEffect, useState } from "react";

const FIRST_VISIT_DURATION = 420;
const EXIT_DURATION = 220;
const SESSION_KEY = "steelprodukt-preloader-shown";

export function SitePreloader() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const startedAt = performance.now();
    const reducedMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let alreadyShown = false;
    try {
      alreadyShown = window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      alreadyShown = false;
    }
    if (alreadyShown) {
      setVisible(false);
      return;
    }
    const minimumDuration = reducedMotion ? 80 : FIRST_VISIT_DURATION;
    let finished = false;
    let exitTimer: number | undefined;
    let removeTimer: number | undefined;

    const finish = () => {
      if (finished) return;
      finished = true;
      const remaining = Math.max(0, minimumDuration - (performance.now() - startedAt));

      exitTimer = window.setTimeout(() => {
        try {
          window.sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          // A blocked sessionStorage must not hold the page behind the overlay.
        }
        setLeaving(true);
        removeTimer = window.setTimeout(() => setVisible(false), EXIT_DURATION);
      }, remaining);
    };

    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish, { once: true });
    }

    const fallbackTimer = window.setTimeout(finish, 1200);

    return () => {
      window.removeEventListener("load", finish);
      window.clearTimeout(fallbackTimer);
      if (exitTimer) window.clearTimeout(exitTimer);
      if (removeTimer) window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`site-preloader${leaving ? " site-preloader--leaving" : ""}`} aria-hidden="true">
      <div className="site-preloader__grid" />
      <div className="site-preloader__glow" />
      <div className="site-preloader__fold-line" />
      <div className="site-preloader__sheet site-preloader__sheet--left" />
      <div className="site-preloader__sheet site-preloader__sheet--right" />
      <div className="site-preloader__content">
        <img className="site-preloader__logo" src="/logo/steel-product.png" alt="" width={1851} height={402} loading="eager" decoding="async" />
        <p>Инженерные решения из листового металла</p>
      </div>
    </div>
  );
}
