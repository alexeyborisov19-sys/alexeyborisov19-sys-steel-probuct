"use client";

import { useEffect, useState } from "react";

const DISPLAY_DURATION = 1750;
const EXIT_DURATION = 420;

export function SitePreloader() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const startedAt = performance.now();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minimumDuration = reducedMotion ? 240 : DISPLAY_DURATION;
    let finished = false;
    let exitTimer: number | undefined;
    let removeTimer: number | undefined;

    const finish = () => {
      if (finished) return;
      finished = true;
      const remaining = Math.max(0, minimumDuration - (performance.now() - startedAt));

      exitTimer = window.setTimeout(() => {
        setLeaving(true);
        removeTimer = window.setTimeout(() => setVisible(false), EXIT_DURATION);
      }, remaining);
    };

    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish, { once: true });
    }

    const fallbackTimer = window.setTimeout(finish, 3200);

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
        <img className="site-preloader__logo" src="/logo/steel-product.png" alt="" />
        <p>Инженерные решения из листового металла</p>
      </div>
    </div>
  );
}
