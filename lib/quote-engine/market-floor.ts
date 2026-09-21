/** Server-side pricing evidence contract. No source prices or credentials live here. */
export type MarketQuoteSpec = {
  calculator: "metal-parts" | "metal-cassettes";
  product: "flat-rectangle" | "facade-cassette";
  material: string;
  thicknessMm: number;
  widthMm: number;
  heightMm: number;
  quantity: number;
  /** Explicit billing basis prevents confusing facade area with cassette face area. */
  areaBasis?: "cassette-face" | "net-facade";
  netFacadeAreaM2?: number;
  finish: string;
  cassetteType: "open" | "closed" | null;
  scope: string[];
  vat: "included" | "excluded" | "exempt";
  vatRatePct: number;
};

export type VerifiedMarketOffer = {
  supplierId: string;
  sourceUrl: string;
  capturedAt: string;
  sourceDate: string;
  checkedAt: string;
  /** An internal source-check reference, never an AI confidence score. */
  checkedBy: string;
  evidence: string;
  specification: MarketQuoteSpec;
  minQuantity: number;
  maxQuantity: number;
  minFacadeAreaM2?: number;
  maxFacadeAreaM2?: number;
  priceRub: number;
  priceUnit: "per-piece" | "per-m2";
  minimumBatchRub: number;
  currency: "RUB";
  priceKind: "exact";
  includesDelivery: false;
  includesInstallation: false;
};

export type MarketFloorDecision = {
  policy: "verified-mean-not-below-calculation-v1";
  status: "market-used" | "calculated-floor" | "market-unavailable" | "market-review-required";
  calculatedRubBatch: number;
  finalRubBatch: number;
  marketMeanRubBatch: number | null;
  supplierCount: number;
  checkedAt: string;
  sources: Array<{ supplierId: string; url: string; sourceDate: string; batchRub: number }>;
  exclusions: Array<{ index: number; reason: string }>;
};

const DAY_MS = 86_400_000;
/** Product policy, not a claim about statistical representativeness. */
export const MARKET_MIN_SUPPLIERS = 3;
export const MARKET_MAX_CAPTURE_AGE_DAYS = 7;
export const MARKET_MAX_SOURCE_AGE_DAYS = 60;
export const MARKET_MAX_SPREAD_RATIO = 2;
const MAX_MONEY_RUB = 1_000_000_000_000;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function money(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_MONEY_RUB;
}
function text(value: unknown, max = 200): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}
function fresh(value: unknown, days: number, now: number): boolean {
  if (!text(value, 40)) return false;
  const date = Date.parse(value);
  return Number.isFinite(date) && date <= now && now - date <= days * DAY_MS;
}
function sourceUrl(value: unknown): URL | null {
  if (!text(value, 2000)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      && (!url.port || url.port === "443") && url.hostname.includes(".")
      && !/^[\d.]+$/.test(url.hostname) && !url.hostname.endsWith(".local") ? url : null;
  } catch { return null; }
}

export function validMarketSpec(value: unknown): value is MarketQuoteSpec {
  const spec = object(value);
  if (!spec || !["metal-parts", "metal-cassettes"].includes(String(spec.calculator))
    || !["flat-rectangle", "facade-cassette"].includes(String(spec.product))) return false;
  if ((spec.calculator === "metal-parts") !== (spec.product === "flat-rectangle")) return false;
  if (!text(spec.material) || !text(spec.finish)
    || ![spec.widthMm, spec.heightMm, spec.thicknessMm].every(positive)
    || !Number.isSafeInteger(spec.quantity) || Number(spec.quantity) <= 0
    || !Array.isArray(spec.scope) || !spec.scope.length || spec.scope.length > 20
    || !spec.scope.every((item) => text(item, 80)) || new Set(spec.scope).size !== spec.scope.length
    || !["included", "excluded", "exempt"].includes(String(spec.vat))
    || !money(spec.vatRatePct) || Number(spec.vatRatePct) > 100) return false;
  if (spec.areaBasis != null && spec.areaBasis !== "cassette-face" && spec.areaBasis !== "net-facade") return false;
  if (spec.areaBasis === "net-facade" && (spec.calculator !== "metal-cassettes" || !positive(spec.netFacadeAreaM2))) return false;
  if (spec.vat === "exempt" && spec.vatRatePct !== 0) return false;
  return spec.calculator === "metal-cassettes"
    ? spec.cassetteType === "open" || spec.cassetteType === "closed"
    : spec.cassetteType === null;
}

/** Exact supplied specification; area-only similarity is not product equivalence. */
function sameSpec(a: MarketQuoteSpec, b: MarketQuoteSpec): boolean {
  return a.calculator === b.calculator && a.product === b.product && a.material === b.material
    && a.thicknessMm === b.thicknessMm && a.widthMm === b.widthMm && a.heightMm === b.heightMm
    && a.finish === b.finish && a.cassetteType === b.cassetteType && a.vat === b.vat
    && (a.areaBasis ?? "cassette-face") === (b.areaBasis ?? "cassette-face")
    && a.vatRatePct === b.vatRatePct
    && [...a.scope].sort().join("\u0000") === [...b.scope].sort().join("\u0000");
}
function roundUpCent(value: number): number {
  return Math.ceil(value * 100 - 1e-7) / 100;
}

/**
 * Called with server-owned source snapshots, never request-body market numbers.
 * Every public price is >= the complete calculated COMMERCIAL price, not merely
 * its direct cost. The arithmetic mean is recomputed from eligible independent
 * suppliers; caller-supplied summaries and model-generated means are ignored.
 */
export function decideMarketFloor(
  calculatedRubBatch: number,
  target: MarketQuoteSpec | null,
  rawOffers: readonly unknown[],
  now: Date = new Date(),
): MarketFloorDecision {
  if (!money(calculatedRubBatch) || calculatedRubBatch <= 0 || !Number.isFinite(now.getTime())) {
    throw new Error("Invalid calculated price or assessment date");
  }
  const floor = roundUpCent(calculatedRubBatch);
  const result: MarketFloorDecision = {
    policy: "verified-mean-not-below-calculation-v1", status: "market-unavailable",
    calculatedRubBatch: floor, finalRubBatch: floor, marketMeanRubBatch: null,
    supplierCount: 0, checkedAt: now.toISOString(), sources: [], exclusions: [],
  };
  if (!validMarketSpec(target)) return result;
  const candidates: Array<{ index: number; offer: VerifiedMarketOffer; host: string; total: number }> = [];
  for (const [index, raw] of rawOffers.slice(0, 100).entries()) {
    const offer = object(raw);
    const reject = (reason: string) => { result.exclusions.push({ index, reason }); };
    if (!offer || !validMarketSpec(offer.specification) || !sameSpec(offer.specification, target)) {
      reject("specification-mismatch-or-unknown"); continue;
    }
    const url = sourceUrl(offer.sourceUrl);
    if (!url || !text(offer.supplierId) || !text(offer.checkedBy) || !text(offer.evidence, 8000)) {
      reject("missing-source-verification"); continue;
    }
    if (!fresh(offer.capturedAt, MARKET_MAX_CAPTURE_AGE_DAYS, now.getTime())
      || !fresh(offer.checkedAt, MARKET_MAX_CAPTURE_AGE_DAYS, now.getTime())
      || !fresh(offer.sourceDate, MARKET_MAX_SOURCE_AGE_DAYS, now.getTime())
      || Date.parse(String(offer.checkedAt)) < Date.parse(String(offer.capturedAt))) {
      reject("stale-future-or-invalid-date"); continue;
    }
    if (offer.currency !== "RUB" || offer.priceKind !== "exact"
      || offer.includesDelivery !== false || offer.includesInstallation !== false
      || !money(offer.priceRub) || offer.priceRub <= 0 || !money(offer.minimumBatchRub)
      || !["per-piece", "per-m2"].includes(String(offer.priceUnit))) {
      reject("price-or-terms-unknown"); continue;
    }
    let total: number;
    if (target.areaBasis === "net-facade") {
      if (offer.priceUnit !== "per-m2" || !positive(offer.minFacadeAreaM2) || !positive(offer.maxFacadeAreaM2)
        || offer.minFacadeAreaM2 > offer.maxFacadeAreaM2 || target.netFacadeAreaM2! < offer.minFacadeAreaM2
        || target.netFacadeAreaM2! > offer.maxFacadeAreaM2) {
        reject("facade-area-tier-or-billing-basis-mismatch"); continue;
      }
      total = Math.max(offer.priceRub * target.netFacadeAreaM2!, offer.minimumBatchRub);
    } else {
      if (!Number.isSafeInteger(offer.minQuantity) || !Number.isSafeInteger(offer.maxQuantity)
        || Number(offer.minQuantity) <= 0 || Number(offer.maxQuantity) < Number(offer.minQuantity)
        || target.quantity < Number(offer.minQuantity) || target.quantity > Number(offer.maxQuantity)) {
        reject("quantity-tier-mismatch"); continue;
      }
      const unitFactor = offer.priceUnit === "per-piece" ? 1 : target.widthMm * target.heightMm / 1_000_000;
      total = Math.max(offer.priceRub * unitFactor * target.quantity, offer.minimumBatchRub);
    }
    if (!money(total) || total <= 0) { reject("price-overflow"); continue; }
    candidates.push({ index, offer: offer as unknown as VerifiedMarketOffer, host: url.hostname.replace(/^www\./, ""), total });
  }
  const usedSuppliers = new Set<string>();
  const usedHosts = new Set<string>();
  // Latest source check wins for a supplier. Each supplier and exact host has one vote.
  candidates.sort((a, b) => Date.parse(b.offer.checkedAt) - Date.parse(a.offer.checkedAt));
  for (const candidate of candidates) {
    const supplierId = candidate.offer.supplierId.trim().toLowerCase();
    if (usedSuppliers.has(supplierId) || usedHosts.has(candidate.host)) {
      result.exclusions.push({ index: candidate.index, reason: "duplicate-supplier-or-host" }); continue;
    }
    usedSuppliers.add(supplierId); usedHosts.add(candidate.host);
    result.sources.push({ supplierId, url: candidate.offer.sourceUrl, sourceDate: candidate.offer.sourceDate, batchRub: candidate.total });
  }
  result.supplierCount = result.sources.length;
  if (result.supplierCount < MARKET_MIN_SUPPLIERS) return result;
  const totals = result.sources.map((source) => source.batchRub);
  if (Math.max(...totals) / Math.min(...totals) > MARKET_MAX_SPREAD_RATIO) {
    result.status = "market-review-required";
    return result; // Do not silently drop an inconvenient extreme price.
  }
  const mean = totals.reduce((sum, value) => sum + value / totals.length, 0);
  result.marketMeanRubBatch = roundUpCent(mean);
  result.finalRubBatch = Math.max(floor, result.marketMeanRubBatch);
  result.status = result.marketMeanRubBatch > floor ? "market-used" : "calculated-floor";
  return result;
}