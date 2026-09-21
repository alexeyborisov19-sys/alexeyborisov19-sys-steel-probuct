import "server-only";

import type { InstantQuoteProject } from "@/lib/instant-quote/domain";
import { createClientCalculationView, type ClientProjectCalculationView } from "@/lib/instant-quote/client-calculation-view";
import { resolveEffectiveFactualInputs } from "@/lib/instant-quote/factual-input-resolution";
import { calculateProjectFactualCost, type PartFactualInputs, type ProjectCadEvidence } from "@/lib/instant-quote/project-factual-calculation";
import { deriveProductionParameters, type ProductionParameterSummary } from "@/lib/instant-quote/production-parameters";
import type { MaterialId } from "@/lib/instant-quote/pricing";
import { loadPrivateCalculationBasis } from "@/lib/server/instant-quote/private-calculation-basis";
import { metalMarketUpliftPct } from "@/lib/server/instant-quote/metal-market-uplift";
import { loadCommercialPricingPolicy } from "@/lib/server/instant-quote/commercial-pricing";
import { createInternalProductionReport, writeInternalProductionReport, type InternalCalculationInputSnapshot } from "@/lib/server/instant-quote/private-production-report";
import { reviewCadProjectCalculation } from "@/lib/server/quote-engine/cad-stage-review";

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

/**
 * Private rates -> factual cost -> actual CAD/operation review -> private report
 * -> public projection. A review failure never publishes the pre-review total.
 * No same-design CAD market feed is configured by this code; an unverified
 * competitor snippet is never substituted for the calculated commercial floor.
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
    project, explicitFactualByPartId, powderSidesByPartId,
    authoritativeFactualByPartId, surfacePreparationSidesByPartId,
  );
  calculationStage("FACTUAL_INPUTS_OK");
  calculationStage("FACTUAL_CALCULATION_START");
  const calculation = calculateProjectFactualCost(
    project, evidenceByPartId, basis.materialPriceSnapshots, basis.rateBook,
    effectiveFactualByPartId, now, { materialMarketUpliftPct: metalMarketUpliftPct() },
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
      materialId, thicknessMm, quantity: part.configuration.quantity, geometry: part.geometry,
      weldLengthMEach: factual.weldLengthM,
      powderSides: powderSidesByPartId[part.id],
      explicitPowderAreaM2Each: factual.powderAreaM2,
      assemblyMinutesEach: factual.assemblyMinutes,
      surfacePreparationAreaM2Each: factual.surfacePreparationAreaM2,
      packagingSelected: part.configuration.operations.includes("packaging"),
    });
  }
  calculationStage("PRODUCTION_PARAMETERS_OK");

  calculationStage("QUOTE_REVIEW_START");
  const quoteControl = await reviewCadProjectCalculation(project, calculation, evidenceByPartId, commercialPolicy);
  // This event means the review finished, not that every part passed.
  calculationStage("QUOTE_REVIEW_COMPLETE");

  calculationStage("REPORT_CREATE_START");
  const unsupportedEntitiesByPartId = Object.fromEntries(
    Object.entries(evidenceByPartId).map(([partId, evidence]) => [partId, [...(evidence.unsupportedEntities ?? [])]]),
  );
  const calculationInputSnapshot: InternalCalculationInputSnapshot = {
    project, factualByPartId: explicitFactualByPartId, authoritativeFactualByPartId,
    powderSidesByPartId, unsupportedEntitiesByPartId,
  };
  // The additional audit is serialized into the same confidential report, not
  // returned by the public DTO. Legacy reports remain readable without it.
  const report = {
    ...createInternalProductionReport({
      projectId: project.id, basisVersion: basis.version, calculation,
      productionParametersByPartId, internalNotes: inputs.internalNotes,
      calculationInputSnapshot, now,
    }),
    quoteControl,
  };
  calculationStage("REPORT_CREATE_OK");
  calculationStage("REPORT_WRITE_START");
  await writeInternalProductionReport(report);
  calculationStage("REPORT_WRITE_OK");

  calculationStage("CLIENT_RESULT_START");
  const result = createClientCalculationView(project, quoteControl.signals);
  calculationStage("CLIENT_RESULT_OK");
  return result;
}
