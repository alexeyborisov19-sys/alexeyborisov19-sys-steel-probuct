import "server-only";

import type { InstantQuoteProject } from "@/lib/instant-quote/domain";
import {
  createClientCalculationView,
  type ClientCalculationSignal,
  type ClientProjectCalculationView,
} from "@/lib/instant-quote/client-calculation-view";
import { resolveEffectiveFactualInputs } from "@/lib/instant-quote/factual-input-resolution";
import {
  calculateProjectFactualCost,
  type PartFactualInputs,
  type ProjectCadEvidence,
  type ProjectFactualPartResult,
} from "@/lib/instant-quote/project-factual-calculation";
import {
  deriveProductionParameters,
  type ProductionParameterSummary,
} from "@/lib/instant-quote/production-parameters";
import type { MaterialId } from "@/lib/instant-quote/pricing";
import { loadPrivateCalculationBasis } from "@/lib/server/instant-quote/private-calculation-basis";
import { metalMarketUpliftPct } from "@/lib/server/instant-quote/metal-market-uplift";
import {
  approvedSalePriceRubFromLines,
  loadCommercialPricingPolicy,
  type CommercialPricingPolicy,
} from "@/lib/server/instant-quote/commercial-pricing";
import {
  createInternalProductionReport,
  writeInternalProductionReport,
  type InternalCalculationInputSnapshot,
} from "@/lib/server/instant-quote/private-production-report";

export type ConfidentialCalculationInputs = {
  factualByPartId?: Record<string, PartFactualInputs>;
  /** Physical values confirmed by protected server-side CAD analysis. */
  authoritativeFactualByPartId?: Record<string, PartFactualInputs>;
  powderSidesByPartId?: Record<string, 1 | 2>;
  surfacePreparationSidesByPartId?: Record<string, 1 | 2>;
  internalNotes?: string[];
};

function calculationStage(stage: string) {
  console.info(JSON.stringify({ event: "online_calc_stage", stage }));
}

function asMaterialId(value: string | null): MaterialId | null {
  if (value === "cold" || value === "hot" || value === "zinc" || value === "inox" || value === "alu" || value === "copper" || value === "brass") return value;
  return null;
}

function signalStatus(status: string): ClientCalculationSignal["status"] {
  if (status === "complete") return "ready";
  if (status === "blocked") return "blocked";
  if (status === "partial" || status === "missing-geometry" || status === "missing-configuration") return "needs-review";
  return "pending";
}

/**
 * Applies the approved commercial policy server-side. Only the resulting sale
 * total may cross the public boundary; material/operation rates and direct cost
 * remain in the private production report. The formula itself lives in
 * `commercial-pricing.ts`; this keeps only the per-part completeness gate
 * that is specific to this multi-part project pipeline.
 */
function approvedSalePriceRub(part: ProjectFactualPartResult, policy: CommercialPricingPolicy) {
  if (part.status !== "complete" || !part.calculation) return null;
  return approvedSalePriceRubFromLines(part.calculation.lines, part.calculation.quantity, policy);
}

/**
 * Complete confidential calculation boundary.
 *
 * 1. Loads rates and supplier-price snapshots from protected server storage.
 * 2. Calculates internal production cost and physical production parameters.
 * 3. Applies the protected commercial pricing policy.
 * 4. Writes the full confidential report outside the public web tree.
 * 5. Returns only the explicitly client-safe projection and approved total.
 */
export async function runConfidentialCalculationForClient(
  project: InstantQuoteProject,
  evidenceByPartId: ProjectCadEvidence,
  inputs: ConfidentialCalculationInputs = {},
  now = new Date(),
): Promise<ClientProjectCalculationView> {
  calculationStage("BASIS_START");
  const basis = await loadPrivateCalculationBasis();
  calculationStage("BASIS_OK");

  calculationStage("PRICING_POLICY_START");
  const commercialPolicy = loadCommercialPricingPolicy();
  calculationStage("PRICING_POLICY_OK");

  const explicitFactualByPartId = inputs.factualByPartId ?? {};
  const authoritativeFactualByPartId = inputs.authoritativeFactualByPartId ?? {};
  const powderSidesByPartId = inputs.powderSidesByPartId ?? {};
  const surfacePreparationSidesByPartId = inputs.surfacePreparationSidesByPartId ?? {};

  calculationStage("FACTUAL_INPUTS_START");
  const effectiveFactualByPartId = resolveEffectiveFactualInputs(
    project,
    explicitFactualByPartId,
    powderSidesByPartId,
    authoritativeFactualByPartId,
    surfacePreparationSidesByPartId,
  );
  calculationStage("FACTUAL_INPUTS_OK");

  calculationStage("FACTUAL_CALCULATION_START");
  const calculation = calculateProjectFactualCost(
    project,
    evidenceByPartId,
    basis.materialPriceSnapshots,
    basis.rateBook,
    effectiveFactualByPartId,
    now,
    { materialMarketUpliftPct: metalMarketUpliftPct() },
  );
  calculationStage("FACTUAL_CALCULATION_OK");

  calculationStage("PRODUCTION_PARAMETERS_START");
  const productionParametersByPartId: Record<string, ProductionParameterSummary> = {};
  for (const part of project.parts) {
    const materialId = asMaterialId(part.configuration.materialId);
    const thicknessMm = part.configuration.thicknessMm;
    if (!materialId || !(thicknessMm && thicknessMm > 0) || !part.geometry) continue;

    const factual = effectiveFactualByPartId[part.id] ?? {};
    productionParametersByPartId[part.id] = deriveProductionParameters({
      materialId,
      thicknessMm,
      quantity: part.configuration.quantity,
      geometry: part.geometry,
      weldLengthMEach: factual.weldLengthM,
      powderSides: powderSidesByPartId[part.id],
      explicitPowderAreaM2Each: factual.powderAreaM2,
      assemblyMinutesEach: factual.assemblyMinutes,
      surfacePreparationAreaM2Each: factual.surfacePreparationAreaM2,
      packagingSelected: part.configuration.operations.includes("packaging"),
    });
  }
  calculationStage("PRODUCTION_PARAMETERS_OK");

  calculationStage("REPORT_CREATE_START");
  const unsupportedEntitiesByPartId = Object.fromEntries(
    Object.entries(evidenceByPartId).map(([partId, evidence]) => [partId, [...(evidence.unsupportedEntities ?? [])]]),
  );
  const calculationInputSnapshot: InternalCalculationInputSnapshot = {
    project,
    factualByPartId: explicitFactualByPartId,
    authoritativeFactualByPartId,
    powderSidesByPartId,
    unsupportedEntitiesByPartId,
  };

  const report = createInternalProductionReport({
    projectId: project.id,
    basisVersion: basis.version,
    calculation,
    productionParametersByPartId,
    internalNotes: inputs.internalNotes,
    calculationInputSnapshot,
    now,
  });
  calculationStage("REPORT_CREATE_OK");

  calculationStage("REPORT_WRITE_START");
  await writeInternalProductionReport(report);
  calculationStage("REPORT_WRITE_OK");

  calculationStage("CLIENT_RESULT_START");
  const signals: ClientCalculationSignal[] = calculation.parts.map((part) => ({
    partId: part.partId,
    status: signalStatus(part.status),
    approvedSalePriceRub: approvedSalePriceRub(part, commercialPolicy),
  }));
  const result = createClientCalculationView(project, signals);
  calculationStage("CLIENT_RESULT_OK");
  return result;
}