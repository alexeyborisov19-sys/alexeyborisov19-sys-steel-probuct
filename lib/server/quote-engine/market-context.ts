import { readPrivateMarketRegistry } from "@/lib/server/quote-engine/private-market-registry";
import { hydrateMarketRegistry } from "@/lib/server/quote-engine/trusted-market-feeds";
import type { EngineeringLeadState } from "@/lib/assistant/types";
import type { MetalCassetteReadyInput, MetalPartsReadyInput } from "@/lib/quote-engine/plan";
import { materialLabelToId } from "@/lib/quote-engine/field-parsing";
import { validMarketSpec, type MarketQuoteSpec } from "@/lib/quote-engine/market-floor";

export type ReadyQuotePlan =
  | { calculator: "metal-parts"; input: MetalPartsReadyInput }
  | { calculator: "metal-cassettes"; input: MetalCassetteReadyInput };
export type QuoteMarketContext = {
  status: "loaded" | "not-configured" | "unavailable" | "basis-mismatch";
  target: MarketQuoteSpec | null;
  offers: readonly unknown[];
};
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** The registry describes the existing selling price's actual scope and tax basis. */
export function marketContextFromRegistry(plan: ReadyQuotePlan, state: EngineeringLeadState | undefined, raw: unknown): QuoteMarketContext {
  const unavailable: QuoteMarketContext = { status: "unavailable", target: null, offers: [] };
  const registry = record(raw);
  if (!registry || registry.version !== "verified-market-offers-v1"
    || !Array.isArray(registry.offers) || registry.offers.length > 100) return unavailable;
  const bases = record(registry.priceBasis);
  const basis = bases ? record(bases[plan.calculator]) : null;
  if (!basis) return { ...unavailable, status: "basis-mismatch" };
  const target = {
    calculator: plan.calculator,
    product: plan.calculator === "metal-parts" ? "flat-rectangle" : "facade-cassette",
    material: plan.calculator === "metal-parts" ? plan.input.materialId : basis.material,
    thicknessMm: plan.calculator === "metal-parts" ? plan.input.thicknessMm : Number(plan.input.thickness),
    widthMm: plan.calculator === "metal-parts" ? plan.input.widthMm : plan.input.moduleWidthMm,
    heightMm: plan.calculator === "metal-parts" ? plan.input.heightMm : plan.input.moduleHeightMm,
    quantity: plan.input.quantity,
    cassetteType: plan.calculator === "metal-parts" ? null : plan.input.type,
    finish: basis.finish, scope: basis.scope, vat: basis.vat, vatRatePct: basis.vatRatePct,
  };
  if (!validMarketSpec(target)) return { ...unavailable, status: "basis-mismatch" };
  // The text parts path prices a flat cut with material and already declares
  // included VAT. A registry must not silently relabel it as tax-exclusive.
  if (plan.calculator === "metal-parts" && (target.finish !== "none" || target.vat !== "included"
    || [...target.scope].sort().join(",") !== "laser-cutting,material")) return { ...unavailable, status: "basis-mismatch" };
  const requestedMaterial = materialLabelToId(state?.material);
  if (requestedMaterial && requestedMaterial !== target.material) return { ...unavailable, status: "basis-mismatch" };
  if (state?.coating) {
    if (/без\s+(?:покрытия|окраски|покраски)/iu.test(state.coating) && target.finish !== "none") return { ...unavailable, status: "basis-mismatch" };
    if (/порошк/iu.test(state.coating)) {
      const ral = state.ral?.match(/\d{4}/)?.[0];
      if (!ral || target.finish !== `powder:${ral}`) return { ...unavailable, status: "basis-mismatch" };
    }
  }
  return { status: "loaded", target, offers: registry.offers };
}

/** No browser pathname or search snippet can become a pricing reference. */
export async function loadQuoteMarketContext(
  plan: ReadyQuotePlan, state?: EngineeringLeadState, environment: NodeJS.ProcessEnv = process.env,
): Promise<QuoteMarketContext> {
  const source = await readPrivateMarketRegistry(environment);
  if (source.status !== "loaded") return { status: source.status, target: null, offers: [] };
  const registry = await hydrateMarketRegistry(source.data, environment);
  return marketContextFromRegistry(plan, state, registry);
}
