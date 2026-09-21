import { createHash } from "node:crypto";
import type { InstantQuoteProject, ProjectPart } from "@/lib/instant-quote/domain";
import type { ClientCalculationSignal } from "@/lib/instant-quote/client-calculation-view";
import type { ProjectFactualCalculationResult, ProjectFactualPartResult, ProjectCadEvidence } from "@/lib/instant-quote/project-factual-calculation";
import { CALCULATION_DISCLAIMER_SHORT } from "@/lib/instant-quote/client-labels";
import { approvedSalePriceRubFromLines, type CommercialPricingPolicy } from "@/lib/server/instant-quote/commercial-pricing";
import { reviewQuoteStages, type StageEvidence, type StageReviewCaller, type StageReviewResult } from "@/lib/server/quote-engine/stage-review";
import { verifyStageEvidence } from "@/lib/server/quote-engine/stage-evidence";
import { quoteAiReviewRequired } from "@/lib/server/quote-engine/review-policy";

import { decideMarketFloor, type MarketFloorDecision } from "@/lib/quote-engine/market-floor";
import { loadSpecializedMarketContext } from "@/lib/server/quote-engine/specialized-market-context";

export type CadQuoteAudit = {
  partId: string;
  calculatedRubBatch: number | null;
  publishedRubBatch: number | null;
  marketStatus: "not-connected-for-cad" | "loaded" | "not-configured" | "unavailable" | "basis-mismatch";
  priceDecision?: MarketFloorDecision;
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
    const status: ClientCalculationSignal["status"] = result?.status === "blocked" ? "blocked" : "needs-review";
    return { signal: { partId: part.id, status, approvedSalePriceRub: null }, audit };
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
  if (!cost.lines.length || cost.lines.some((line) => !Number.isFinite(line.amountRubEach) || line.amountRubEach < 0)
    || !Number.isFinite(cost.confirmedDirectCostRubBatch) || cost.confirmedDirectCostRubBatch <= 0) {
    return hold(issue("calculation", "incomplete-calculation"));
  }
  if (![policy.metalMultiplier, policy.roundStepRub].every((value) => Number.isFinite(value) && value > 0)
    || ![policy.drawingPercentOfWorks, policy.finalPercent, policy.fixedAddRubEach].every((value) => Number.isFinite(value) && value >= 0)
    || typeof policy.fixedAddEnabled !== "boolean") return hold(issue("pricing", "price-below-floor"));
  let baseline: number;
  try { baseline = approvedSalePriceRubFromLines(cost.lines, cost.quantity, policy); }
  catch { return hold(issue("pricing", "price-below-floor")); }
  if (!Number.isFinite(baseline) || baseline <= 0 || baseline + 0.005 < cost.confirmedDirectCostRubBatch) {
    return hold(issue("pricing", "price-below-floor"));
  }
  audit.calculatedRubBatch = baseline;
  if (result.dfmReviewReasons.length || (cad?.reviewReasons?.length ?? 0) > 0) return hold(issue("geometry", "inconsistent-geometry"));
  const processSignature = createHash("sha256").update(JSON.stringify({
    material: cost.materialId, thickness: cost.thicknessMm,
    operations: [...part.configuration.operations].sort(), parameters: cost.parameters,
  })).digest("hex");
  const context = cad?.sourceSha256 ? await loadSpecializedMarketContext({
    kind: "cad-part", material: cost.materialId, thicknessMm: cost.thicknessMm,
    widthMm: part.geometry.widthMm!, heightMm: part.geometry.heightMm!, quantity: cost.quantity,
    scope: ["material", ...part.configuration.operations], drawingSha256: cad.sourceSha256, processSignature,
  }) : { status: "not-configured" as const, target: null, offers: [] };
  if (cad?.sourceSha256) audit.marketStatus = context.status;
  const decision = decideMarketFloor(baseline, context.target, context.offers);
  audit.priceDecision = decision;
  const final = decision.finalRubBatch;
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
    market: { available: decision.marketMeanRubBatch !== null, status: decision.status,
      supplierCount: decision.supplierCount, meanRubBatch: decision.marketMeanRubBatch,
      sourcePricesRubBatch: decision.sources.map((source) => source.batchRub), comparison: context.target },
    pricing: { calculatedRubBatch: baseline, finalRubBatch: final, rule: "max(calculated,verified-arithmetic-mean)", floorProtected: final >= baseline },
    disclaimer: { clientMessage: `Предварительная стоимость позиции: ${final.toFixed(2)} ₽. ${CALCULATION_DISCLAIMER_SHORT}` },
  };
  audit.evidence = evidence;
  // Unresolved CAD warnings are engineering evidence, not permission for an LLM to waive them.
  if (result.dfmReviewReasons.length || (cad?.reviewReasons?.length ?? 0) > 0) return hold(issue("geometry", "inconsistent-geometry"));
  audit.review = verifyStageEvidence(evidence) ?? (options.caller === null
    ? { status: "not-configured", stages: [] }
    : await reviewQuoteStages(evidence, options.caller));
  const required = options.requireAiReview ?? quoteAiReviewRequired();
  if (audit.review.status === "needs-review" || (required && audit.review.status !== "passed")) return hold(audit.review);
  audit.publishedRubBatch = final;
  return { signal: { partId: part.id, status: "ready", approvedSalePriceRub: final,
    aiReviewed: audit.review.status === "passed", marketVerified: decision.marketMeanRubBatch !== null }, audit };
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
