import type { MaterialId, MaterialMarketPrice } from "@/lib/instant-quote/pricing";

/**
 * The deterministic gate in front of any automatically read supplier price.
 *
 * Automatic price updates already run on a timer, but they depend on one
 * enabled source and one layout-specific parser: when that parser stops
 * recognising the document, there are no prices, and every quote blocks. A
 * reader that can cope with an unexpected layout is therefore useful — and is
 * also the last thing that should ever be trusted on its word, because what it
 * produces is money.
 *
 * So nothing here asks whether a number looks right. Each proposed row has to
 * survive four independent checks, and a row failing any one of them is
 * refused rather than rounded, guessed or averaged:
 *
 * 1. Grounding. The quoted fragment must occur verbatim in the source
 *    document AND must itself contain both the thickness and the price being
 *    claimed. Requiring the two together is the point: a fragment that merely
 *    exists somewhere proves nothing about which thickness a price belongs to,
 *    and a plausible-looking row attached to the wrong thickness is exactly
 *    the error that is impossible to notice in a finished quote.
 * 2. Known material. Never a new material id invented from a document.
 * 3. Plausibility. Sheet thickness and ₽/t have physical bounds; a value
 *    outside them is a misread, not a bargain.
 * 4. Drift. A price that moved further than the configured limit since the
 *    last confirmed row for the same material and thickness is held back for
 *    a human, whatever produced it. This is the check that catches a broken
 *    parse and a bad automatic read alike, including the case where every
 *    other check passes because the number is real but belongs elsewhere in
 *    the document.
 */

export type ProposedPriceRow = {
  materialId: string;
  thicknessMm: number;
  rubPerTon: number;
  size?: string;
  /** The exact fragment of the source document this row was read from. */
  quote: string;
};

export type PriceRowRejectionReason =
  | "ungrounded-quote"
  | "quote-missing-thickness"
  | "quote-missing-price"
  | "unknown-material"
  | "implausible-thickness"
  | "implausible-price"
  | "price-drift";

export type PriceRowRejection = {
  materialId: string;
  thicknessMm: number;
  rubPerTon: number;
  reason: PriceRowRejectionReason;
  detail?: string;
};

export type PriceVerificationLimits = {
  minThicknessMm: number;
  maxThicknessMm: number;
  minRubPerTon: number;
  maxRubPerTon: number;
  /** Largest accepted move against the last confirmed row for the same material and thickness. */
  maxDriftPct: number;
};

export const DEFAULT_PRICE_VERIFICATION_LIMITS: PriceVerificationLimits = {
  // Sheet metal this shop actually buys and cuts.
  minThicknessMm: 0.3,
  maxThicknessMm: 50,
  // Wide on purpose: this is a misread detector, not a market opinion.
  minRubPerTon: 10_000,
  maxRubPerTon: 1_000_000,
  maxDriftPct: 25,
};

const KNOWN_MATERIALS = new Set<MaterialId>(["cold", "hot", "zinc", "inox", "alu", "copper", "brass"]);

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Digits as they may appear in a Russian price list: "61 000", "61000,5", "1,2". */
function containsNumber(haystack: string, value: number) {
  const digits = [...haystack.matchAll(/\d+(?:[\s ]\d{3})*(?:[.,]\d+)?/g)]
    .map((match) => Number(match[0].replace(/[\s ]/g, "").replace(",", ".")))
    .filter((parsed) => Number.isFinite(parsed));
  return digits.some((parsed) => Math.abs(parsed - value) < 0.005);
}

export type PriceVerificationResult = {
  accepted: ProposedPriceRow[];
  rejected: PriceRowRejection[];
};

export function verifyProposedPriceRows(input: {
  proposed: readonly ProposedPriceRow[];
  /** The source document's own text, as fetched — the only thing a quote may be grounded in. */
  documentText: string;
  /** The last confirmed rows, for the drift check. Empty on a first ever import. */
  previous?: readonly MaterialMarketPrice[];
  limits?: PriceVerificationLimits;
}): PriceVerificationResult {
  const { proposed, documentText, previous = [], limits = DEFAULT_PRICE_VERIFICATION_LIMITS } = input;
  const haystack = normalize(documentText);
  const accepted: ProposedPriceRow[] = [];
  const rejected: PriceRowRejection[] = [];

  const previousByKey = new Map<string, number>();
  for (const row of previous) {
    previousByKey.set(`${row.materialId}@${row.thicknessMm}`, row.rubPerTon);
  }

  for (const row of proposed) {
    const reject = (reason: PriceRowRejectionReason, detail?: string) => {
      rejected.push({ materialId: row.materialId, thicknessMm: row.thicknessMm, rubPerTon: row.rubPerTon, reason, detail });
    };

    if (!KNOWN_MATERIALS.has(row.materialId as MaterialId)) {
      reject("unknown-material");
      continue;
    }
    if (!Number.isFinite(row.thicknessMm) || row.thicknessMm < limits.minThicknessMm || row.thicknessMm > limits.maxThicknessMm) {
      reject("implausible-thickness");
      continue;
    }
    if (!Number.isFinite(row.rubPerTon) || row.rubPerTon < limits.minRubPerTon || row.rubPerTon > limits.maxRubPerTon) {
      reject("implausible-price");
      continue;
    }

    const quote = normalize(row.quote ?? "");
    if (!quote || !haystack.includes(quote)) {
      reject("ungrounded-quote");
      continue;
    }
    // The fragment has to tie this thickness to this price itself. Without
    // both, the row is a guess about which column belonged to which row.
    if (!containsNumber(quote, row.thicknessMm)) {
      reject("quote-missing-thickness");
      continue;
    }
    if (!containsNumber(quote, row.rubPerTon)) {
      reject("quote-missing-price");
      continue;
    }

    const earlier = previousByKey.get(`${row.materialId}@${row.thicknessMm}`);
    if (earlier != null && earlier > 0) {
      const driftPct = Math.abs(row.rubPerTon - earlier) / earlier * 100;
      if (driftPct > limits.maxDriftPct) {
        reject("price-drift", `${earlier} → ${row.rubPerTon} ₽/т (${driftPct.toFixed(1)} %)`);
        continue;
      }
    }

    accepted.push(row);
  }

  return { accepted, rejected };
}
