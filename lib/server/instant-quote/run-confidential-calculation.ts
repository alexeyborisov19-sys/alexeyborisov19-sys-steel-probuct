import "server-only";

import type { ParsedDxf } from "@/lib/instant-quote/dxf";
import type { InstantQuoteProject } from "@/lib/instant-quote/domain";
import {
  createClientCalculationView,
  type ClientCalculationSignal,
  type ClientProjectCalculationView,
} from "@/lib/instant-quote/client-calculation-view";
import {
  calculateProjectFactualCost,
  type PartFactualInputs,
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
} from "@/lib/server/instant-quote/private-production-report";

export type ConfidentialCalculationInputs = {
  factualByPartId?: Record<string, PartFactualInputs>;
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
  parsedByPartId: Record<string, ParsedDxf>,
  inputs: ConfidentialCalculationInputs = {},
  now = new Date(),
): Promise<ClientProjectCalculationView> {
  const basis = await loadPrivateCalculationBasis();
  const factualByPartId = inputs.factualByPartId ?? {};

  const calculation = calculateProjectFactualCost(
    project,
    parsedByPartId,
    basis.materialPriceSnapshots,
    basis.rateBook,
    factualByPartId,
    now,
  );

  const productionParametersByPartId: Record<string, ProductionParameterSummary> = {};
  for (const part of project.parts) {
    const materialId = asMaterialId(part.configuration.materialId);
    const thicknessMm = part.configuration.thicknessMm;
    if (!materialId || !(thicknessMm && thicknessMm > 0) || !part.geometry) continue;

    const factual = factualByPartId[part.id] ?? {};
    productionParametersByPartId[part.id] = deriveProductionParameters({
      materialId,
      thicknessMm,
      quantity: part.configuration.quantity,
      geometry: part.geometry,
      weldLengthMEach: factual.weldLengthM,
      powderSides: inputs.powderSidesByPartId?.[part.id],
      explicitPowderAreaM2Each: factual.powderAreaM2,
    });
  }

  const report = createInternalProductionReport({
    projectId: project.id,
    basisVersion: basis.version,
    calculation,
    productionParametersByPartId,
    internalNotes: inputs.internalNotes,
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
