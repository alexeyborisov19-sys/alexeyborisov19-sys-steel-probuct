const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "yclid", "gclid"] as const;

/** Carry existing campaign parameters only through same-origin links; no storage. */
export function withAttribution(href: string, currentUrl: string): string {
  try {
    const current = new URL(currentUrl);
    const target = new URL(href, current.origin);
    if (target.origin !== current.origin) return href;
    for (const key of keys) {
      const value = current.searchParams.get(key);
      if (value && !target.searchParams.has(key)) target.searchParams.set(key, value.slice(0, 200));
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch { return href; }
}
