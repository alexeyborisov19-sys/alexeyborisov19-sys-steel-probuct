import type { JsonLd as JsonLdType } from "@/lib/schema";

const firstPartyHosts = new Set(["steelprodukt.ru", "www.steelprodukt.ru"]);

function isThirdPartyHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !firstPartyHosts.has(url.hostname);
  } catch {
    return false;
  }
}

function sanitizeJsonLdValue(value: unknown, key?: string): unknown {
  if (key === "image" && typeof value === "string" && isThirdPartyHttpUrl(value)) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeJsonLdValue(item, key))
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([entryKey, entryValue]) => [entryKey, sanitizeJsonLdValue(entryValue, entryKey)] as const)
        .filter(([, entryValue]) => entryValue !== undefined),
    );
  }

  return value;
}

export function JsonLd({ data }: { data: JsonLdType | JsonLdType[] }) {
  const sanitizedData = sanitizeJsonLdValue(data);
  const safeJson = JSON.stringify(sanitizedData).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson }} />;
}
