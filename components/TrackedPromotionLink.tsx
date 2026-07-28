"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackLeadEvent } from "@/lib/analytics";

type TrackedPromotionLinkProps = {
  href: string;
  className?: string;
  eventName: "exhibition_official_click" | "exhibition_quote_click";
  params?: Record<string, string | number | boolean | undefined>;
  external?: boolean;
  children: ReactNode;
};

export function TrackedPromotionLink({
  href,
  className,
  eventName,
  params = {},
  external = false,
  children,
}: TrackedPromotionLinkProps) {
  const onClick = () => trackLeadEvent(eventName, params);

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
