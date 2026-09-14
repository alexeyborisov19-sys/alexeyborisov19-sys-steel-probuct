import type { NormalizedCadModel } from "@/lib/instant-quote/cad-model";
import type { InstantQuoteProject } from "@/lib/instant-quote/domain";
import { runVerifiedLaserDfm } from "@/lib/instant-quote/dfm";
import { selectBestStoredPrice, type StoredPriceSnapshot } from "@/lib/instant-quote/material-price-feed";
import { calculateProvisionalPartPrice, type MaterialId, type ProvisionalPartPrice } from "@/lib/instant-quote/pricing";

export type ModelPartPricingStatus =
  | "calculated"
  | "blocked"
  | "manual"
  | "missing-geometry"
  | "missing-price";

export type ModelPartPricingResult = {
  partId: string;
  status: ModelPartPricingStatus;
  price: ProvisionalPartPrice | null;
  blockingReasons: string[];
  reviewReasons: string[];
};

export type ModelProjectPricingResult = {
  parts: ModelPartPricingResult[];
  calculatedParts: number;
  totalParts: number;
  totalRub: number;
  hasBlockingParts: boolean;
  hasReviewParts: boolean;
};

function materialIdOf(value: string | null): MaterialId | null {
  if (value === "hot" || value === "cold" || value === "zinc" || value === "inox" || value === "alu" || value === "copper" || value === "brass") return value;
  return null;
}

export function calculateModelProjectPricing(
  project: InstantQuoteProject,
  modelsByPartId: Record<string, NormalizedCadModel>,
  snapshots: StoredPriceSnapshot[],
  now = new Date(),
): ModelProjectPricingResult {
  const parts = project.parts.map<ModelPartPricingResult>((part) => {
    const model = modelsByPartId[part.id];
    if (!model || !part.geometry) {
      return {
        partId: part.id,
        status: "missing-geometry",
        price: null,
        blockingReasons: [],
        reviewReasons: ["CAD-модель ещё не нормализована."],
      };
    }

    const materialId = materialIdOf(part.configuration.materialId);
    const thicknessMm = part.configuration.thicknessMm;
    if (!materialId || !thicknessMm || thicknessMm <= 0) {
      return {
        partId: part.id,
        status: "manual",
        price: null,
        blockingReasons: [],
        reviewReasons: ["Материал или толщина не заданы."],
      };
    }

    const widthMm = model.geometry.widthMm ?? 0;
    const heightMm = model.geometry.heightMm ?? 0;
    if (!(widthMm > 0 && heightMm > 0)) {
      return {
        partId: part.id,
        status: "manual",
        price: null,
        blockingReasons: [],
        reviewReasons: ["Не удалось получить расчётные габариты CAD."],
      };
    }

    const rawStepNeedsUnfold = (model.format === "step" || model.format === "stp")
      && !(model.geometry.cutLengthMm && model.geometry.blankAreaMm2);

    // Never treat a 3D STEP bounding box as a flat laser blank. Until a trusted
    // sheet-metal unfold exists, STEP can be inspected/measured but not auto-priced.
    if (rawStepNeedsUnfold) {
      return {
        partId: part.id,
        status: "manual",
        price: null,
        blockingReasons: [],
        reviewReasons: [
          ...model.warnings,
          "STEP распознан в 3D. Для автоматической цены нужна подтверждённая листовая развёртка и линия лазерного реза.",
        ],
      };
    }

    const dfm = runVerifiedLaserDfm({ width: widthMm, height: heightMm, units: "мм" }, thicknessMm, materialId);
    const blockingReasons = dfm.filter((item) => item.severity === "error").map((item) => item.title);
    const reviewReasons = [
      ...dfm.filter((item) => item.severity === "manual" || item.severity === "warning").map((item) => item.title),
      ...model.warnings,
    ];

    if (blockingReasons.length) {
      return { partId: part.id, status: "blocked", price: null, blockingReasons, reviewReasons };
    }

    const selection = selectBestStoredPrice(snapshots, materialId, thicknessMm, now);
    if (!selection.price) {
      return {
        partId: part.id,
        status: "missing-price",
        price: null,
        blockingReasons,
        reviewReasons: [...reviewReasons, "Нет подтверждённой цены металла."],
      };
    }

    const price = calculateProvisionalPartPrice({
      materialId,
      thicknessMm,
      quantity: part.configuration.quantity,
      geometry: model.geometry,
      marketPrice: selection.price,
      operations: part.configuration.operations,
    });

    if (selection.stale) reviewReasons.push("Прайс металла требует обновления.");

    return {
      partId: part.id,
      status: reviewReasons.length ? "manual" : "calculated",
      price,
      blockingReasons,
      reviewReasons,
    };
  });

  return {
    parts,
    calculatedParts: parts.filter((part) => part.price !== null).length,
    totalParts: parts.length,
    totalRub: parts.reduce((sum, part) => sum + (part.price?.totalRub ?? 0), 0),
    hasBlockingParts: parts.some((part) => part.status === "blocked"),
    hasReviewParts: parts.some((part) => part.status !== "calculated"),
  };
}
