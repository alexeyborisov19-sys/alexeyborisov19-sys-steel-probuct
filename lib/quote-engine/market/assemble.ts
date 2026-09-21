import { classifyOfferComparability } from "@/lib/quote-engine/market/comparability";
import { summarizeMarket } from "@/lib/quote-engine/market/statistics";
import type { ComparabilityVerdict, MarketComparisonTarget, MarketOffer } from "@/lib/quote-engine/market/types";
import type { MetalCassetteReadyInput, MetalPartsReadyInput } from "@/lib/quote-engine/plan";

/**
 * The missing link between the market module and the price. Comparability and
 * statistics were already built and tested, but nothing turned a set of found
 * offers into the `MarketInput` the calculation accepts, so none of it was
 * reachable in production. This does exactly that step and nothing more — it
 * finds no offers itself and changes no price; what it produces is the
 * evidence §23 requires the internal record to be able to show.
 */

export type AssembledMarket = {
  summary: ReturnType<typeof summarizeMarket>;
  unitAreaM2: number;
  /** Source snapshots are internal only; a median alone is not auditable evidence. */
  evidence?: {
    assessedAt: string;
    offers: Array<{ offer: MarketOffer; verdict: ComparabilityVerdict }>;
  };
};

/**
 * Where found offers come from. Left unimplemented on purpose: this project
 * brings external data in through an explicit allowlist of named, trusted
 * sources (see `TRUSTED_METAL_PRICE_SOURCES` and the Atlantik price reader),
 * never open web search, and which competitors may be used as a market
 * reference is the owner's decision, not this module's. Without a provider
 * the pipeline runs exactly as it does today — no offers, no market data, no
 * effect on the price.
 */
export type MarketOfferProvider = (target: MarketComparisonTarget) => Promise<readonly MarketOffer[]>;

/** What a found offer has to be comparable *to*, derived from the plan already agreed with the customer. */
export function marketTargetFromPlan(
  plan:
    | { calculator: "metal-parts"; input: MetalPartsReadyInput }
    | { calculator: "metal-cassettes"; input: MetalCassetteReadyInput },
): MarketComparisonTarget {
  if (plan.calculator === "metal-cassettes") {
    const areaM2 = (plan.input.moduleWidthMm * plan.input.moduleHeightMm) / 1_000_000;
    return {
      calculator: "metal-cassettes",
      // The cassette calculator prices by its own published rate and never
      // asks which alloy, so there is no material to match an offer against.
      materialId: null,
      thicknessMm: Number(plan.input.thickness),
      unitAreaM2: areaM2 > 0 ? areaM2 : null,
    };
  }

  const areaM2 = (plan.input.widthMm * plan.input.heightMm) / 1_000_000;
  return {
    calculator: "metal-parts",
    materialId: plan.input.materialId,
    thicknessMm: plan.input.thicknessMm,
    unitAreaM2: areaM2 > 0 ? areaM2 : null,
  };
}

/**
 * Screens every offer against the target, then reduces what survives to one
 * summary. Returns null whenever the result could not honestly inform
 * anything — no offers, no usable unit area, or nothing comparable enough to
 * produce a median — which is the same state as "no market data" that the
 * pricing rules and the verification layer already handle safely.
 */
export function assembleMarketInput(
  offers: readonly MarketOffer[],
  target: MarketComparisonTarget,
  now: Date = new Date(),
): AssembledMarket | null {
  const unitAreaM2 = target.unitAreaM2;
  if (unitAreaM2 == null || !Number.isFinite(unitAreaM2) || unitAreaM2 <= 0) return null;
  if (offers.length === 0) return null;

  const evidence = {
    assessedAt: now.toISOString(),
    offers: offers.map((offer) => ({
      // Keep the snapshot independent of a provider's mutable response object.
      offer: { ...offer, dimensions: offer.dimensions ? { ...offer.dimensions } : null },
      verdict: classifyOfferComparability(offer, target, now),
    })),
  };
  const summary = summarizeMarket(evidence.offers.map((item) => item.verdict));
  if (summary.medianRubPerM2 == null) return null;

  return { summary, unitAreaM2, evidence };
}
