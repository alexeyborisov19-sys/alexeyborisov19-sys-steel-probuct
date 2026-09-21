import { validMarketSpec, type MarketQuoteSpec } from "@/lib/quote-engine/market-floor";
import type { QuoteMarketContext } from "@/lib/server/quote-engine/market-context";
import { readPrivateMarketRegistry } from "@/lib/server/quote-engine/private-market-registry";
import { hydrateMarketRegistry } from "@/lib/server/quote-engine/trusted-market-feeds";

export type SpecializedQuote = {
  kind: "cad-part" | "facade-area";
  material?: string;
  thicknessMm: number;
  widthMm: number;
  heightMm: number;
  quantity: number;
  scope?: string[];
  drawingSha256?: string;
  processSignature?: string;
  pricedAreaM2?: number;
  cassetteType?: "open" | "closed";
};
function object(raw: unknown): Record<string, unknown> | null {
  return raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
}

/** CAD requires the same file and processes; area estimates require a declared area-price basis. */
export function specializedMarketContextFromRegistry(input: SpecializedQuote, raw: unknown): QuoteMarketContext {
  const fail: QuoteMarketContext = { status: "basis-mismatch", target: null, offers: [] };
  const registry = object(raw), bases = object(registry?.priceBasis), basis = object(bases?.[input.kind]);
  if (registry?.version !== "verified-market-offers-v1" || !Array.isArray(registry.offers)
    || registry.offers.length > 100 || !basis) return fail;
  const target = {
    calculator: input.kind === "cad-part" ? "metal-parts" : "metal-cassettes",
    product: input.kind, material: input.kind === "cad-part" ? input.material : basis.material,
    thicknessMm: input.thicknessMm, widthMm: input.widthMm, heightMm: input.heightMm,
    quantity: input.quantity, cassetteType: input.kind === "cad-part" ? null : input.cassetteType,
    scope: input.kind === "cad-part" ? input.scope : basis.scope,
    finish: basis.finish, vat: basis.vat, vatRatePct: basis.vatRatePct,
    ...(input.kind === "cad-part" ? { drawingSha256: input.drawingSha256, processSignature: input.processSignature }
      : { pricedAreaM2: input.pricedAreaM2 }),
  };
  if (!validMarketSpec(target)) return fail;
  // CAD does not collect a coating colour today; do not match a specific RAL by guess.
  if (input.kind === "cad-part" && (target.finish !== "none" || target.vat !== "included"
    || target.scope.includes("powder-coating"))) return fail;
  return { status: "loaded", target: target as MarketQuoteSpec, offers: registry.offers };
}
export async function loadSpecializedMarketContext(input: SpecializedQuote): Promise<QuoteMarketContext> {
  const registry = await readPrivateMarketRegistry();
  if (registry.status !== "loaded") return { status: registry.status, target: null, offers: [] };
  return specializedMarketContextFromRegistry(input, await hydrateMarketRegistry(registry.data));
}
