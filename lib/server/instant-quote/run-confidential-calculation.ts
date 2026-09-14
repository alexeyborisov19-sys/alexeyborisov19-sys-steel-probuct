import "server-only";

import type { InstantQuoteProject, ManufacturingOperation, ProjectPart } from "@/lib/instant-quote/domain";
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
import {
  calculateApprovedSalePriceRub,
  type PrivateCommercialPricing,
} from "@/lib/server/instant-quote/private-commercial-pricing";
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

function withRequiredLaserCutting(project: InstantQuoteProject): InstantQuoteProject {
  return {
    ...project,
    parts: project.parts.map((part) => {
      const operations: ManufacturingOperation[] = part.configuration.operations.includes("laser-cutting")
        ? [...part.configuration.operations]
        : ["laser-cutting", ...part.configuration.operations];
      return {
        ...part,
        configuration: {
          ...part.configuration,
          operations,
        },
      };
    }),
  };
}

function formattedRub(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

function safeClientMessage(
  result: ProjectFactualPartResult,
  sourcePart: ProjectPart | undefined,
  approvedSalePriceRub: number | null,
  commercialPricing: PrivateCommercialPricing | null,
) {
  if (approvedSalePriceRub != null && approvedSalePriceRub > 0) {
    return `Предварительная стоимость: ${formattedRub(approvedSalePriceRub)} ₽.`;
  }

  if (
    sourcePart
    && (sourcePart.format === "step" || sourcePart.format === "stp")
    && (result.status === "missing-geometry" || result.status === "partial")
  ) {
    return "Для автоматической цены по гнутой STEP-модели нужна подтверждённая производственная развёртка DXF.";
  }

  if (result.status === "complete" && !commercialPricing) {
    return "Производственный расчёт завершён. Итоговая цена ожидает публикации серверной коммерческой конфигурации.";
  }

  if (result.status === "blocked") return "Для этой детали требуется технологическая проверка перед расчётом цены.";
  if (result.status === "missing-configuration") return "Уточните материал и толщину детали.";
  if (result.status === "missing-geometry") return "Не удалось подтвердить производственную геометрию для автоматической цены.";
  return "Расчёт выполнен частично. Для итоговой цены требуется уточнение производственных данных.";
}

/**
 * Complete confidential calculation boundary.
 *
 * 1. Loads rates, commercial terms and supplier-price snapshots from protected server storage.
 * 2. Calculates internal production cost and physical production parameters.
 * 3. Writes the full confidential report outside the public web tree.
 * 4. Returns only the explicitly client-safe projection and, when every cost
 *    article is complete, the final approved selling amount.
 *
 * The persisted report filename/id/path and every internal tariff remain
 * intentionally absent from the public result.
 */
export async function runConfidentialCalculationForClient(
  project: InstantQuoteProject,
  evidenceByPartId: ProjectCadEvidence,
  inputs: ConfidentialCalculationInputs = {},
  now = new Date(),
): Promise<ClientProjectCalculationView> {
  const basis = await loadPrivateCalculationBasis();
  const commercialPricing = basis.commercialPricing ?? null;

  const projectForCalculation = withRequiredLaserCutting(project);
  const explicitFactualByPartId = inputs.factualByPartId ?? {};
  const authoritativeFactualByPartId = inputs.authoritativeFactualByPartId ?? {};
  const powderSidesByPartId = inputs.powderSidesByPartId ?? {};
  const effectiveFactualByPartId = resolveEffectiveFactualInputs(
    projectForCalculation,
    explicitFactualByPartId,
    powderSidesByPartId,
    authoritativeFactualByPartId,
  );

  const calculation = calculateProjectFactualCost(
    projectForCalculation,
    evidenceByPartId,
    basis.materialPriceSnapshots,
    basis.rateBook,
    effectiveFactualByPartId,
    now,
  );

  const productionParametersByPartId: Record<string, ProductionParameterSummary> = {};
  for (const part of projectForCalculation.parts) {
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
    project: projectForCalculation,
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

  const publicPartById = new Map(project.parts.map((part) => [part.id, part]));
  const signals: ClientCalculationSignal[] = calculation.parts.map((part) => {
    const approvedSalePriceRub = commercialPricing
      ? calculateApprovedSalePriceRub(part.calculation, commercialPricing)
      : null;
    return {
      partId: part.partId,
      status: signalStatus(part.status),
      approvedSalePriceRub,
      message: safeClientMessage(part, publicPartById.get(part.partId), approvedSalePriceRub, commercialPricing),
    };
  });

  return createClientCalculationView(project, signals);
}
