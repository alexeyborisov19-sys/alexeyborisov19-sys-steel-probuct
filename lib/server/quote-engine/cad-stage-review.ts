import type { InstantQuoteProject, ProjectPart } from "@/lib/instant-quote/domain";
import type { ClientCalculationSignal } from "@/lib/instant-quote/client-calculation-view";
import type { ProjectFactualCalculationResult, ProjectFactualPartResult, ProjectCadEvidence } from "@/lib/instant-quote/project-factual-calculation";
import { CALCULATION_DISCLAIMER_SHORT } from "@/lib/instant-quote/client-labels";
import { approvedSalePriceRubFromLines, type CommercialPricingPolicy } from "@/lib/server/instant-quote/commercial-pricing";
import { reviewQuoteStages, type StageEvidence, type StageReviewCaller, type StageReviewResult } from "@/lib/server/quote-engine/stage-review";

export type CadQuoteAudit = {
  partId: string;
  calculatedRubBatch: number | null;
  publishedRubBatch: number | null;
  marketStatus: "not-connected-for-cad";
  review: StageReviewResult;
  evidence: StageEvidence | null;
};
export type CadQuoteControl = {
  version: "cad-quote-control-v1";
  signals: ClientCalculationSignal[];
  audits: CadQuoteAudit[];
};
export type CadReviewOptions = {
  /** Internal dependency injection only, never copied from public request JSON. */
  caller?: StageReviewCaller | null;
  requireAiReview?: boolean;
};

function requiredByEnvironment(): boolean {
  const value = process.env.STEEL_PRODUCT_QUOTE_AI_REVIEW_REQUIRED;
  return value === "true" || (value !== "false" && process.env.NODE_ENV === "production");
}
function issue(stage: "inputs" | "geometry" | "operations" | "calculation" | "pricing", code: string): StageReviewResult {
  return { status: "needs-review", origin: "deterministic", stages: [{ stage, status: "needs-review", codes: [code] }] };
}

/** The model receives the measured shape, not a reconstructed bounding rectangle. */
async function reviewPart(
  part: ProjectPart,
  result: ProjectFactualPartResult | undefined,
  cad: ProjectCadEvidence[string] | undefined,
  policy: CommercialPricingPolicy,
  options: CadReviewOptions,
): Promise<{ signal: ClientCalculationSignal; audit: CadQuoteAudit }> {
  const audit: CadQuoteAudit = {
    partId: part.id, calculatedRubBatch: null, publishedRubBatch: null,
    marketStatus: "not-connected-for-cad", review: { status: "not-configured", stages: [] }, evidence: null,
  };
  const hold = (review: StageReviewResult) => {
    audit.review = review;
    return { signal: { partId: part.id, status: "needs-review" as const, approvedSalePriceRub: null }, audit };
  };
  const cost = result?.calculation;
  if (result?.status !== "complete" || cost?.status !== "complete" || cost.missing.length) {
    return hold(issue("calculation", "incomplete-calculation"));
  }
  if (!part.geometry || result.dfmBlockingReasons.length || (cad?.unsupportedEntities?.length ?? 0) > 0) {
    return hold(issue("geometry", "inconsistent-geometry"));
  }
  if (cost.quantity !== part.configuration.quantity || cost.materialId !== part.configuration.materialId
    || cost.thicknessMm !== part.configuration.thicknessMm || !Number.isSafeInteger(cost.quantity) || cost.quantity <= 0) {
    return hold(issue("inputs", "missing-input"));
  }
  const codes = new Set(cost.lines.map((line) => line.code as string));
  if (!codes.has("material") || part.configuration.operations.some((operation) => !codes.has(operation))) {
    return hold(issue("operations", "unsupported-operation"));
  }
  // Model success cannot turn incomplete, negative or non-finite cost articles into a quote.
  if (!cost.lines.length || cost.lines.some((line) => !Number.isFinite(line.amountRubEach) || line.amountRubEach < 0)
    || !Number.isFinite(cost.confirmedDirectCostRubBatch) || cost.confirmedDirectCostRubBatch <= 0) {
    return hold(issue("calculation", "incomplete-calculation"));
  }
  let baseline: number;
  try { baseline = approvedSalePriceRubFromLines(cost.lines, cost.quantity, policy); }
  catch { return hold(issue("pricing", "price-below-floor")); }
  if (!Number.isFinite(baseline) || baseline <= 0 || baseline + 0.005 < cost.confirmedDirectCostRubBatch) {
    return hold(issue("pricing", "price-below-floor"));
  }
  audit.calculatedRubBatch = baseline;
  // A CAD part cannot use flat-rectangle offers just because its bounding box matches.
  // Until same-design source evidence is available, its commercial calculation is the floor and result.
  const evidence: StageEvidence = {
    classification: { calculator: "metal-parts", productType: "cad-part", format: part.format },
    inputs: { parameters: {
      materialId: cost.materialId, thicknessMm: cost.thicknessMm, quantity: cost.quantity,
      widthMm: part.geometry.widthMm, heightMm: part.geometry.heightMm,
    } },
    geometry: {
      deterministicCheckPassed: true, method: "protected-cad-analysis",
      measured: part.geometry, unresolvedReviewCount: result.dfmReviewReasons.length,
    },
    operations: { requestedScope: part.configuration.operations, pricedScope: [...codes], physicalParameters: cost.parameters },
    calculation: { complete: true, deterministicCheckPassed: true, basis: "configured-cost-and-commercial-formula" },
    market: { available: false, status: "cad-same-design-reference-not-connected", supplierCount: 0 },
    pricing: { calculatedRubBatch: baseline, finalRubBatch: baseline, rule: "calculated-floor-without-verified-market", floorProtected: true },
    disclaimer: { clientMessage: `Предварительная стоимость позиции: ${baseline.toFixed(2)} ₽. ${CALCULATION_DISCLAIMER_SHORT}` },
  };
  audit.evidence = evidence;
  // Unresolved CAD warnings are engineering evidence, not permission for an LLM to waive them.
  if (result.dfmReviewReasons.length) return hold(issue("geometry", "inconsistent-geometry"));
  audit.review = options.caller === null
    ? { status: "not-configured", stages: [] }
    : await reviewQuoteStages(evidence, options.caller);
  const required = options.requireAiReview ?? requiredByEnvironment();
  if (audit.review.status === "needs-review" || (required && audit.review.status !== "passed")) return hold(audit.review);
  audit.publishedRubBatch = baseline;
  return { signal: { partId: part.id, status: "ready", approvedSalePriceRub: baseline }, audit };
}

/** At most two model calls at once. No customer filenames, contacts or private tariffs are sent. */
export async function reviewCadProjectCalculation(
  project: InstantQuoteProject,
  calculation: ProjectFactualCalculationResult,
  evidenceByPartId: ProjectCadEvidence,
  policy: CommercialPricingPolicy,
  options: CadReviewOptions = {},
): Promise<CadQuoteControl> {
  const results = new Map(calculation.parts.map((part) => [part.partId, part]));
  const rows: Array<Awaited<ReturnType<typeof reviewPart>>> = new Array(project.parts.length);
  let cursor = 0;
  const deadline = Date.now() + 25_000;
  const worker = async () => {
    while (cursor < project.parts.length) {
      const index = cursor++;
      const part = project.parts[index];
      try {
        if (Date.now() > deadline) throw new Error("CAD review budget exhausted");
        rows[index] = await reviewPart(part, results.get(part.id), evidenceByPartId[part.id], policy, options);
      } catch {
        rows[index] = {
          signal: { partId: part.id, status: "needs-review", approvedSalePriceRub: null },
          audit: { partId: part.id, calculatedRubBatch: null, publishedRubBatch: null,
            marketStatus: "not-connected-for-cad", review: { status: "unavailable", stages: [] }, evidence: null },
        };
      }
    }
  };
  await Promise.all([worker(), worker()]);
  return { version: "cad-quote-control-v1", signals: rows.map((row) => row.signal), audits: rows.map((row) => row.audit) };
}
