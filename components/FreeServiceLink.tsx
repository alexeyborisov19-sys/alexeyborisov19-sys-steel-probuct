"use client";
import { AttributionLink } from "@/components/AttributionLink";
import { trackLeadEvent } from "@/lib/analytics";
export function FreeServiceLink({href, service, children}: {href:string;service:string;children:React.ReactNode}) {
  return <AttributionLink prefetch={false} href={href} onClick={() => trackLeadEvent("free_service_open", {service})} className="mt-auto inline-flex min-h-12 items-center justify-center rounded-lg bg-steel-orange px-5 py-3 text-center font-semibold text-black transition hover:bg-orange-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-steel-orange">{children} →</AttributionLink>;
}
