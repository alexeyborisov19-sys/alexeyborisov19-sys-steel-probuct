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
} from "@/lib/instant-quote/project-factual-calculation";
import {
  deriveProductionParameters,
  type ProductionParameterSummary,
} from "@/lib/instant-quote/production-parameters";
import type { MaterialId } from "@/lib/instant-quote/pricing";
import { loadPrivateCalculationBasis } from "@/lib/server/instant-quote/private-calculation-basis";
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
  internalNotes?: string[];
};

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
 * Complete confidential calculation boundary.
 *
 * 1. Loads rates and supplier-price snapshots from protected server storage.
 * 2. Calculates internal production cost and physical production parameters.
 * 3. Writes the full confidential report outside the public web tree.
 * 4. Returns only the explicitly client-safe projection.
 *
 * The persisted report filename/id/path is intentionally NOT returned from this
 * function, so a public route cannot accidentally serialize an internal report
 * locator together with the customer response.
 */
export async function runConfidentialCalculationForClient(
  project: InstantQuoteProject,
  evidenceByPartId: ProjectCadEvidence,
  inputs: ConfidentialCalculationInputs = {},
  now = new Date(),
): Promise<ClientProjectCalculationView> {
  const basis = await loadPrivateCalculationBasis();
  const explicitFactualByPartId = inputs.factualByPartId ?? {};
  const authoritativeFactualByPartId = inputs.authoritativeFactualByPartId ?? {};
  const powderSidesByPartId = inputs.powderSidesByPartId ?? {};
  const effectiveFactualByPartId = resolveEffectiveFactualInputs(
    project,
    explicitFactualByPartId,
    powderSidesByPartId,
    authoritativeFactualByPartId,
  );

  const calculation = calculateProjectFactualCost(
    project,
    evidenceByPartId,
    basis.materialPriceSnapshots,
    basis.rateBook,
    effectiveFactualByPartId,
    now,
  );

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
  await writeInternalProductionReport(report);

  const signals: ClientCalculationSignal[] = calculation.parts.map((part) => ({
    partId: part.partId,
    status: signalStatus(part.status),
    approvedSalePriceRub: null,
  }));

  return createClientCalculationView(project, signals);
}