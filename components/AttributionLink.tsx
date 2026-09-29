"use client";

import Link from "next/link";
import { type ComponentProps, useEffect, useState } from "react";

import { withAttribution } from "@/lib/attribution-link";

type AttributionLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

export function AttributionLink({ href, ...props }: AttributionLinkProps) {
  const [resolvedHref, setResolvedHref] = useState(href);

  useEffect(() => {
    setResolvedHref(withAttribution(href, window.location.href));
  }, [href]);

  return <Link href={resolvedHref} {...props} />;
}
