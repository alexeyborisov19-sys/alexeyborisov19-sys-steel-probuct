import { paidServicesAllowed } from "@/lib/server/quote-engine/service-policy";
import type { ReadyQuotePlan } from "@/lib/server/quote-engine/market-context";

export type MarketDiscovery = {
  status: "not-configured" | "unavailable" | "completed";
  candidates: Array<{ url: string; title: string }>;
};

/** Search only a normalized product specification, never customer messages or contact data. */
export function marketDiscoveryQuery(plan: ReadyQuotePlan): string {
  const materialLabels: Record<string, string> = {
    cold: "холоднокатаная сталь", hot: "горячекатаная сталь", zinc: "оцинкованная сталь",
    inox: "нержавеющая сталь", alu: "алюминий",
  };
  const product = plan.calculator === "metal-cassettes"
    ? `фасадная металлокассета ${plan.input.type === "open" ? "открытого" : "закрытого"} типа`
    : `плоская прямоугольная деталь ${materialLabels[plan.input.materialId] ?? "металл"}`;
  const width = plan.calculator === "metal-parts" ? plan.input.widthMm : plan.input.moduleWidthMm;
  const height = plan.calculator === "metal-parts" ? plan.input.heightMm : plan.input.moduleHeightMm;
  const thickness = plan.calculator === "metal-parts" ? plan.input.thicknessMm : Number(plan.input.thickness);
  return `${product} ${width}х${height} мм толщина ${thickness} мм ${plan.input.quantity} шт цена производитель НДС`.slice(0, 400);
}

function decode(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

/** URLs only: a search result is discovery evidence, never a verified offer. */
export function parseDiscoveredSources(xml: string): MarketDiscovery["candidates"] {
  if (xml.length > 1_048_576) return [];
  const seen = new Set<string>();
  const candidates: MarketDiscovery["candidates"] = [];
  for (const match of xml.matchAll(/<doc(?:\s[^>]*)?>([\s\S]*?)<\/doc>/g)) {
    const rawUrl = match[1].match(/<url>([\s\S]*?)<\/url>/)?.[1];
    if (!rawUrl) continue;
    try {
      const url = new URL(decode(rawUrl));
      if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || seen.has(url.href)) continue;
      seen.add(url.href);
      const title = decode(match[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").replace(/<[^>]*>/g, "").slice(0, 300);
      candidates.push({ url: url.href, title });
      if (candidates.length === 20) break;
    } catch { /* Malformed links do not reach any network client. */ }
  }
  return candidates;
}

/**
 * Official REST API: https://yandex.cloud/ru/docs/search-api/api-ref/WebSearch/search
 * Opt-in separately from chat generation. Discovered URLs are NOT fetched here;
 * no arbitrary host, redirect or prompt-controlled URL receives server requests.
 */
export async function discoverQuoteMarket(
  plan: ReadyQuotePlan,
  environment: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch,
): Promise<MarketDiscovery> {
  if (!paidServicesAllowed(environment) || environment.STEEL_PRODUCT_MARKET_SEARCH_ENABLED !== "true"
    || !environment.YANDEX_SEARCH_API_KEY || !environment.YANDEX_SEARCH_FOLDER_ID) {
    return { status: "not-configured", candidates: [] };
  }
  try {
    const response = await request("https://searchapi.api.cloud.yandex.net/v2/web/search", {
      method: "POST", redirect: "error", cache: "no-store",
      headers: { Authorization: `Api-Key ${environment.YANDEX_SEARCH_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: { searchType: "SEARCH_TYPE_RU", queryText: marketDiscoveryQuery(plan), familyMode: "FAMILY_MODE_STRICT", page: "0", fixTypoMode: "FIX_TYPO_MODE_OFF" },
        groupSpec: { groupMode: "GROUP_MODE_DEEP", groupsOnPage: "20", docsInGroup: "1" },
        folderId: environment.YANDEX_SEARCH_FOLDER_ID, responseFormat: "FORMAT_XML",
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return { status: "unavailable", candidates: [] };
    const text = await response.text();
    if (text.length > 2_000_000) return { status: "unavailable", candidates: [] };
    const payload = JSON.parse(text) as { rawData?: unknown };
    if (typeof payload.rawData !== "string") return { status: "unavailable", candidates: [] };
    return { status: "completed", candidates: parseDiscoveredSources(Buffer.from(payload.rawData, "base64").toString("utf8")) };
  } catch { return { status: "unavailable", candidates: [] }; }
}
