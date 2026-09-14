import type { InstantQuoteProject, PartConfiguration, PartGeometrySummary } from "@/lib/instant-quote/domain";
import type { ProjectPartPriceSource, ProjectPricingResult } from "@/lib/instant-quote/project-pricing";
import type { ProvisionalPartPrice } from "@/lib/instant-quote/pricing";

export const PROVISIONAL_PRICING_FORMULA_VERSION = "steel-product-online-provisional-v2";

export type QuoteSnapshotLine = {
  partId: string;
  fileName: string;
  format: string;
  status: "calculated" | "blocked" | "manual" | "missing-geometry" | "missing-price";
  configuration: PartConfiguration;
  geometry: PartGeometrySummary | null;
  price: ProvisionalPartPrice | null;
  priceSource: ProjectPartPriceSource | null;
  blockingReasons: string[];
  reviewReasons: string[];
};

export type ProvisionalQuoteSnapshot = {
  id: string;
  kind: "provisional";
  projectId: string;
  projectTitle: string;
  currency: "RUB";
  createdAt: string;
  pricingFormulaVersion: string;
  automaticOrderReady: boolean;
  totalRub: number;
  calculatedParts: number;
  totalParts: number;
  lines: QuoteSnapshotLine[];
};

export function createProvisionalQuoteSnapshot(
  project: InstantQuoteProject,
  pricing: ProjectPricingResult,
  now = new Date(),
): ProvisionalQuoteSnapshot {
  const pricingByPartId = new Map(pricing.parts.map((part) => [part.partId, part]));
  const lines: QuoteSnapshotLine[] = project.parts.map((part) => {
    const priced = pricingByPartId.get(part.id);
    return {
      partId: part.id,
      fileName: part.fileName,
      format: part.format,
      status: priced?.status ?? "missing-geometry",
      configuration: {
        ...part.configuration,
        operations: [...part.configuration.operations],
      },
      geometry: part.geometry ? { ...part.geometry } : null,
      price: priced?.price ? { ...priced.price, warnings: [...priced.price.warnings] } : null,
      priceSource: priced?.priceSource ? { ...priced.priceSource } : null,
      blockingReasons: [...(priced?.blockingReasons ?? [])],
      reviewReasons: [...(priced?.reviewReasons ?? ["Позиция не вошла в текущий расчёт."])],
    };
  });

  const automaticOrderReady = lines.length > 0
    && pricing.calculatedParts === pricing.totalParts
    && !pricing.hasBlockingParts
    && !pricing.hasReviewParts
    && lines.every((line) => line.status === "calculated" && line.price !== null && line.priceSource !== null && !line.priceSource.stale);

  return {
    id: `quote-${project.id}-${now.getTime()}`,
    kind: "provisional",
    projectId: project.id,
    projectTitle: project.title,
    currency: "RUB",
    createdAt: now.toISOString(),
    pricingFormulaVersion: PROVISIONAL_PRICING_FORMULA_VERSION,
    automaticOrderReady,
    totalRub: pricing.totalRub,
    calculatedParts: pricing.calculatedParts,
    totalParts: pricing.totalParts,
    lines,
  };
}
