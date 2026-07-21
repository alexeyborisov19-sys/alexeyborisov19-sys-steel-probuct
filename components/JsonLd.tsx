import type { JsonLd as JsonLdType } from "@/lib/schema";

export function JsonLd({ data }: { data: JsonLdType | JsonLdType[] }) {
  const safeJson = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson }} />;
}
