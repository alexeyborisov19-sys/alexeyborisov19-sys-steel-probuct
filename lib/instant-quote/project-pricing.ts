import type { InstantQuoteProject } from "@/lib/instant-quote/domain";
import type { ParsedDxf } from "@/lib/instant-quote/dxf";
import { runVerifiedLaserDfm } from "@/lib/instant-quote/dfm";
import { selectBestStoredPrice, type StoredPriceSnapshot } from "@/lib/instant-quote/material-price-feed";
import {
  calculateProvisionalPartPrice,
  type MaterialId,
  type ProvisionalPartPrice,
} from "@/lib/instant-quote/pricing";

export type ProjectPartPricingResult = {
  partId: string;
  status: "calculated" | "blocked" | "manual" | "missing-geometry" | "missing-price";
  price: ProvisionalPartPrice | null;
  blockingReasons: string[];
  reviewReasons: string[];
};

export type ProjectPricingResult = {
  parts: ProjectPartPricingResult[];
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

export function calculateProjectProvisionalPricing(
  project: InstantQuoteProject,
  parsedByPartId: Record<string, ParsedDxf>,
  snapshots: StoredPriceSnapshot[],
  now = new Date(),
): ProjectPricingResult {
  const parts = project.parts.map<ProjectPartPricingResult>((part) => {
    const parsed = parsedByPartId[part.id];
    if (!parsed || !part.geometry) {
      return {
        partId: part.id,
        status: "missing-geometry",
        price: null,
        blockingReasons: [],
        reviewReasons: ["Геометрия детали ещё не готова."],
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

    const dfm = runVerifiedLaserDfm(parsed, thicknessMm, materialId);
    if (parsed.unsupportedEntities.length) {
      dfm.push({
        code: "unsupported-dxf-entities",
        title: "Неподдерживаемая геометрия DXF",
        detail: parsed.unsupportedEntities.join(", "),
        severity: "manual",
      });
    }

    const blockingReasons = dfm.filter((item) => item.severity === "error").map((item) => item.title);
    const reviewReasons = dfm.filter((item) => item.severity === "manual" || item.severity === "warning").map((item) => item.title);

    if (blockingReasons.length) {
      return { partId: part.id, status: "blocked", price: null, blockingReasons, reviewReasons };
    }

    if (parsed.units !== "мм") {
      return {
        partId: part.id,
        status: "manual",
        price: null,
        blockingReasons,
        reviewReasons: reviewReasons.length ? reviewReasons : ["Единицы CAD требуют подтверждения."],
      };
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
      geometry: part.geometry,
      marketPrice: selection.price,
      operations: part.configuration.operations,
      materialUsageFactor: 1.15,
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
    hasReviewParts: parts.some((part) => part.status === "manual" || part.status === "missing-price" || part.status === "missing-geometry"),
  };
}
