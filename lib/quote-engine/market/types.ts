import type { CalculatorId } from "@/lib/quote-engine/classification";
import type { MaterialId } from "@/lib/instant-quote/pricing";

export type MarketOfferPriceUnit = "per-piece" | "per-m2" | "per-kg" | "per-ton" | "per-linear-m";

/**
 * One found competitor offer, carrying every field §14 requires checking
 * before it is trusted: size, material, thickness, coating, completeness,
 * quantity, price, price unit, whether delivery/install/fasteners are
 * included, wholesale vs retail, and when and where it was found. A field
 * the offer's own text did not state is `null`, never guessed — an offer
 * with an unstated price unit cannot be normalised and is excluded from
 * statistics rather than assumed to be priced the same way as the target.
 */
export type MarketOffer = {
  id: string;
  sourceName: string;
  sourceUrl: string | null;
  /** When this offer was captured by the system. */
  capturedAt: string;
  /** The date printed on the offer itself, if the source states one — distinct from capturedAt. */
  offerDate: string | null;
  /** Raw text as found, so a human can re-check the automated reading against the source. */
  productDescription: string;
  dimensions: { widthMm: number; heightMm: number } | null;
  materialId: MaterialId | null;
  thicknessMm: number | null;
  coating: string | null;
  quantity: number | null;
  price: number;
  priceUnit: MarketOfferPriceUnit;
  pricingTier: "wholesale" | "retail" | "unknown";
  includesDelivery: boolean | null;
  includesInstallation: boolean | null;
  includesFasteners: boolean | null;
  notes?: string;
};

export type ComparabilityCaveat =
  | "material-mismatch"
  | "thickness-mismatch"
  | "dimensions-mismatch"
  | "price-unit-not-normalizable"
  | "delivery-terms-differ"
  | "installation-terms-differ"
  | "fasteners-terms-differ"
  | "stale-offer";

export type ComparabilityVerdict = {
  offerId: string;
  /** Only a comparable offer's normalized price feeds the statistics. */
  comparable: boolean;
  /** Present when comparable: the offer's price converted to ₽ per m² of the target's own material area. */
  normalizedPriceRubPerM2: number | null;
  caveats: ComparabilityCaveat[];
};

export type MarketComparisonTarget = {
  calculator: CalculatorId;
  materialId: MaterialId | null;
  thicknessMm: number | null;
  /** Area of ONE unit the target is priced by — one cassette's face, or one flat part. */
  unitAreaM2: number | null;
};

export type MarketConfidence = "low" | "medium" | "high";

export type MarketSummary = {
  comparableCount: number;
  excludedCount: number;
  outlierCount: number;
  minRubPerM2: number | null;
  maxRubPerM2: number | null;
  meanRubPerM2: number | null;
  medianRubPerM2: number | null;
  confidence: MarketConfidence;
  /** Why confidence landed where it did — surfaced to the internal record per §23, never to the client. */
  confidenceReason: string;
};
