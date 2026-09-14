import type { InstantQuoteProject } from "@/lib/instant-quote/domain";
import { runVerifiedLaserDfm } from "@/lib/instant-quote/dfm";
import {
  calculateFactualProductionCost,
  type FactualCalculationResult,
  type FactualRateBook,
} from "@/lib/instant-quote/factual-calculation";
import { selectBestStoredPriceForStock, type StoredPriceSnapshot } from "@/lib/instant-quote/material-price-feed";
import type { MaterialId } from "@/lib/instant-quote/pricing";

export type PartFactualInputs = {
  bendCount?: number;
  weldLengthM?: number;
  powderAreaM2?: number;
  assemblyMinutes?: number;
  surfacePreparationAreaM2?: number;
};

export type ProjectFactualPartResult = {
  partId: string;
  status: "complete" | "partial" | "blocked" | "missing-geometry" | "missing-configuration";
  calculation: FactualCalculationResult | null;
  dfmBlockingReasons: string[];
  dfmReviewReasons: string[];
};

export type ProjectFactualCalculationResult = {
  kind: "project-factual-direct-cost";
  parts: ProjectFactualPartResult[];
  completeParts: number;
  partialParts: number;
  blockedParts: number;
  totalParts: number;
  confirmedDirectCostRub: number;
  allCostArticlesComplete: boolean;
  commercialPriceReady: false;
};

export type PartCadEvidence = {
  unsupportedEntities?: string[];
  reviewReasons?: string[];
};

export type ProjectCadEvidence = Record<string, PartCadEvidence>;
/** Backward-compatible name for existing immutable report snapshots. */
export type ProjectDxfEvidence = ProjectCadEvidence;

function materialIdOf(value: string | null): MaterialId | null {
  if (value === "hot" || value === "cold" || value === "zinc" || value === "inox" || value === "alu" || value === "copper" || value === "brass") return value;
  return null;
}

/**
 * Project-level internal factual calculation. The caller must provide a rate
 * book and material-price snapshots loaded from protected server-side storage.
 * This result is internal-only and must be projected before anything is sent to
 * a public browser/API.
 */
export function calculateProjectFactualCost(
  project: InstantQuoteProject,
  evidenceByPartId: ProjectCadEvidence,
  snapshots: StoredPriceSnapshot[],
  rateBook: FactualRateBook,
  factualInputsByPartId: Record<string, PartFactualInputs> = {},
  now = new Date(),
): ProjectFactualCalculationResult {
  const parts = project.parts.map<ProjectFactualPartResult>((part) => {
    const evidence = evidenceByPartId[part.id] ?? {};
    if (!part.geometry?.widthMm || !part.geometry.heightMm) {
      return {
        partId: part.id,
        status: "missing-geometry",
        calculation: null,
        dfmBlockingReasons: [],
        dfmReviewReasons: ["Нормализованная производственная геометрия детали ещё не готова.", ...(evidence.reviewReasons ?? [])],
      };
    }

    const materialId = materialIdOf(part.configuration.materialId);
    const thicknessMm = part.configuration.thicknessMm;
    if (!materialId || !thicknessMm || thicknessMm <= 0) {
      return {
        partId: part.id,
        status: "missing-configuration",
        calculation: null,
        dfmBlockingReasons: [],
        dfmReviewReasons: ["Материал или толщина не заданы.", ...(evidence.reviewReasons ?? [])],
      };
    }

    const dfm = runVerifiedLaserDfm(
      { width: part.geometry.widthMm, height: part.geometry.heightMm, units: "мм" },
      thicknessMm,
      materialId,
    );
    if ((evidence.unsupportedEntities?.length ?? 0) > 0) {
      dfm.push({
        code: "unsupported-dxf-entities",
        title: "Неподдерживаемая геометрия DXF",
        detail: evidence.unsupportedEntities!.join(", "),
        severity: "manual",
      });
    }

    const dfmBlockingReasons = dfm.filter((item) => item.severity === "error").map((item) => item.title);
    const dfmReviewReasons = [
      ...dfm.filter((item) => item.severity === "manual" || item.severity === "warning").map((item) => item.title),
      ...(evidence.reviewReasons ?? []),
    ];
    if (dfmBlockingReasons.length) {
      return {
        partId: part.id,
        status: "blocked",
        calculation: null,
        dfmBlockingReasons,
        dfmReviewReasons,
      };
    }

    const selection = selectBestStoredPriceForStock(
      snapshots,
      materialId,
      thicknessMm,
      { widthMm: part.geometry.widthMm, heightMm: part.geometry.heightMm },
      now,
    );
    const factualInputs = factualInputsByPartId[part.id] ?? {};
    const calculation = calculateFactualProductionCost({
      materialId,
      thicknessMm,
      quantity: part.configuration.quantity,
      geometry: part.geometry,
      marketPrice: selection.price,
      materialPriceSourceId: selection.sourceId,
      materialPriceStale: selection.stale,
      operations: part.configuration.operations,
      rateBook,
      bendCount: factualInputs.bendCount,
      weldLengthM: factualInputs.weldLengthM,
      powderAreaM2: factualInputs.powderAreaM2,
      assemblyMinutes: factualInputs.assemblyMinutes,
      surfacePreparationAreaM2: factualInputs.surfacePreparationAreaM2,
    });

    return {
      partId: part.id,
      status: calculation.status,
      calculation,
      dfmBlockingReasons,
      dfmReviewReasons,
    };
  });

  const completeParts = parts.filter((part) => part.status === "complete").length;
  const partialParts = parts.filter((part) => part.status === "partial" || part.status === "missing-configuration" || part.status === "missing-geometry").length;
  const blockedParts = parts.filter((part) => part.status === "blocked").length;
  const confirmedDirectCostRub = Math.round((parts.reduce(
    (sum, part) => sum + (part.calculation?.confirmedDirectCostRubBatch ?? 0),
    0,
  ) + Number.EPSILON) * 100) / 100;

  return {
    kind: "project-factual-direct-cost",
    parts,
    completeParts,
    partialParts,
    blockedParts,
    totalParts: parts.length,
    confirmedDirectCostRub,
    allCostArticlesComplete: parts.length > 0 && completeParts === parts.length && blockedParts === 0,
    commercialPriceReady: false,
  };
}