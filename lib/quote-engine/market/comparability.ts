import type {
  ComparabilityCaveat,
  ComparabilityVerdict,
  MarketComparisonTarget,
  MarketOffer,
} from "@/lib/quote-engine/market/types";

/**
 * §14/§15: every found offer is checked before it can influence a price, and
 * an offer that cannot be correctly matched is excluded rather than used
 * "with a guess". Every tolerance below is a named, documented policy
 * constant — easy for the business to retune — not a number picked to make
 * a particular test pass.
 */
const THICKNESS_TOLERANCE_FLOOR_MM = 0.15;
const THICKNESS_TOLERANCE_PCT = 0.1;
/** A listing within ±30% of the target's own unit area is the same product tier for a budget-level market read. */
const AREA_TOLERANCE_PCT = 0.3;
const STALE_OFFER_MAX_AGE_DAYS = 60;

function unitAreaM2(dimensions: { widthMm: number; heightMm: number } | null): number | null {
  if (!dimensions) return null;
  return (dimensions.widthMm * dimensions.heightMm) / 1_000_000;
}

/**
 * Checks one offer against the part/cassette being priced and, only when
 * every check passes, converts its price to ₽ per m² so it can sit on the
 * same axis as every other comparable offer. Neither calculator's cost
 * model includes delivery, installation or fasteners, so an offer that
 * bundles any of those is priced on a different basis and is excluded
 * rather than corrected by an invented discount — unstated (`null`) is
 * read as the industry-standard ex-works quote, not as a mismatch.
 */
export function classifyOfferComparability(
  offer: MarketOffer,
  target: MarketComparisonTarget,
  now: Date = new Date(),
): ComparabilityVerdict {
  const caveats: ComparabilityCaveat[] = [];

  if (target.materialId != null && offer.materialId !== target.materialId) {
    caveats.push("material-mismatch");
  }

  if (target.thicknessMm != null) {
    if (offer.thicknessMm == null) {
      caveats.push("thickness-mismatch");
    } else {
      const tolerance = Math.max(THICKNESS_TOLERANCE_FLOOR_MM, target.thicknessMm * THICKNESS_TOLERANCE_PCT);
      if (Math.abs(offer.thicknessMm - target.thicknessMm) > tolerance) caveats.push("thickness-mismatch");
    }
  }

  const offerAreaM2 = unitAreaM2(offer.dimensions);
  if (target.unitAreaM2 != null) {
    if (offerAreaM2 == null) {
      caveats.push("dimensions-mismatch");
    } else {
      const ratio = offerAreaM2 / target.unitAreaM2;
      if (ratio < 1 - AREA_TOLERANCE_PCT || ratio > 1 + AREA_TOLERANCE_PCT) caveats.push("dimensions-mismatch");
    }
  }

  let normalizedPriceRubPerM2: number | null = null;
  if (offer.priceUnit === "per-m2") {
    normalizedPriceRubPerM2 = offer.price;
  } else if (offer.priceUnit === "per-piece" && offerAreaM2 != null && offerAreaM2 > 0) {
    normalizedPriceRubPerM2 = offer.price / offerAreaM2;
  } else {
    // ₽/кг, ₽/т and ₽/пог.м cannot be converted to ₽/м² without assuming a
    // density or a run length the offer never stated — that assumption
    // would itself be invented data, so these are excluded rather than
    // approximately converted.
    caveats.push("price-unit-not-normalizable");
  }

  if (offer.includesDelivery) caveats.push("delivery-terms-differ");
  if (offer.includesInstallation) caveats.push("installation-terms-differ");
  if (offer.includesFasteners) caveats.push("fasteners-terms-differ");

  const capturedAtMs = Date.parse(offer.capturedAt);
  if (Number.isFinite(capturedAtMs)) {
    const ageDays = (now.getTime() - capturedAtMs) / (1000 * 60 * 60 * 24);
    if (ageDays > STALE_OFFER_MAX_AGE_DAYS) caveats.push("stale-offer");
  }

  return {
    offerId: offer.id,
    comparable: caveats.length === 0,
    normalizedPriceRubPerM2: caveats.length === 0 ? normalizedPriceRubPerM2 : null,
    caveats,
  };
}
