"use client";

import Link from "next/link";
import { type ComponentProps, useEffect, useState } from "react";

const attributionKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "yclid",
] as const;

type AttributionLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

export function AttributionLink({ href, ...props }: AttributionLinkProps) {
  const [resolvedHref, setResolvedHref] = useState(href);

  useEffect(() => {
    try {
      const current = new URL(window.location.href);
      const target = new URL(href, current.origin);
      for (const key of attributionKeys) {
        const value = current.searchParams.get(key);
        if (value && !target.searchParams.has(key)) target.searchParams.set(key, value);
      }
      setResolvedHref(`${target.pathname}${target.search}${target.hash}`);
    } catch {
      setResolvedHref(href);
    }
  }, [href]);

  return <Link href={resolvedHref} {...props} />;
}
