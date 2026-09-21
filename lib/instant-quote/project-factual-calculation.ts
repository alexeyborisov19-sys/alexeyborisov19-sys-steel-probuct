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
  /** SHA-256 of actual inspected upload bytes, computed by the server. */
  sourceSha256?: string;
  unsupportedEntities?: string[];
  reviewReasons?: string[];
  /** Annotation layers the DXF parser excluded from the priced geometry. */
  skippedServiceLayers?: string[];
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
  options: { materialMarketUpliftPct?: number } = {},
): ProjectFactualCalculationResult {
  const parts = project.parts.map<ProjectFactualPartResult>((part) => {
    const evidence = evidenceByPartId[part.id] ?? {};
    if (!part.geometry?.widthMm || !part.geometry.heightMm) {
      // The analysis already said why it has no geometry — units the drawing
      // never declares, a thickness the solid contradicts, a blank it could not
      // prove. Only one of these reasons is shown to the customer, and it was
      // the generic sentence: the part that told them what to do came second
      // and was never read.
      const measured = evidence.reviewReasons ?? [];
      return {
        partId: part.id,
        status: "missing-geometry",
        calculation: null,
        dfmBlockingReasons: [],
        dfmReviewReasons: measured.length
          ? [...measured]
          : ["Производственную геометрию детали не удалось получить из файла."],
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
      // Blocking, not advisory. Every unread entity is geometry that may carry
      // cut length, pierces or area the price is built from, so a part whose
      // drawing was only partly understood must not reach a published price —
      // an under-read contour would be quoted cheaper than it can be made.
      // Annotation is not counted here: the parser records notes, dimensions,
      // leaders and viewport frames as read, so what remains is geometry.
      const unread = evidence.unsupportedEntities!.join(", ");
      dfm.push({
        code: "unsupported-dxf-entities",
        title: `Чертёж прочитан не полностью: ${unread}. Расчлените блоки (РАСЧЛЕНИТЬ / EXPLODE) и сохраните контуры линиями, полилиниями, дугами или окружностями — тогда деталь рассчитается автоматически.`,
        detail: unread,
        severity: "error",
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
      materialMarketUpliftPct: options.materialMarketUpliftPct,
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