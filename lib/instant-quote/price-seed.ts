import type { StoredPriceSnapshot } from "@/lib/instant-quote/material-price-feed";

// Fallback snapshot migrated from the latest internal metalworking calculator.
// It is intentionally dated and must never be presented as a live supplier price.
export const FALLBACK_METAL_PRICE_SNAPSHOTS: StoredPriceSnapshot[] = [
  {
    sourceId: "atlantik-smolensk",
    fetchedAt: "2026-08-04T12:00:00.000Z",
    sourceDate: "2026-08-04",
    status: "stale",
    rows: [
      { materialId: "hot", thicknessMm: 2, rubPerTon: 68_900, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1250×2500" },
      { materialId: "hot", thicknessMm: 3, rubPerTon: 68_900, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1250×2500" },
      { materialId: "hot", thicknessMm: 4, rubPerTon: 66_900, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1500×6000" },
      { materialId: "hot", thicknessMm: 5, rubPerTon: 67_400, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1500×6000" },
      { materialId: "hot", thicknessMm: 6, rubPerTon: 68_400, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1500×6000" },
      { materialId: "hot", thicknessMm: 8, rubPerTon: 67_400, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1500×6000" },
      { materialId: "hot", thicknessMm: 10, rubPerTon: 68_400, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1500×6000" },
      { materialId: "hot", thicknessMm: 12, rubPerTon: 66_400, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1500×6000" },
      { materialId: "hot", thicknessMm: 16, rubPerTon: 70_900, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1500×6000" },
      { materialId: "hot", thicknessMm: 20, rubPerTon: 72_900, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1500×6000" },
      { materialId: "cold", thicknessMm: 0.8, rubPerTon: 78_900, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1250×2500" },
      { materialId: "cold", thicknessMm: 1, rubPerTon: 72_400, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1250×2500" },
      { materialId: "cold", thicknessMm: 1.2, rubPerTon: 71_900, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1250×2500" },
      { materialId: "cold", thicknessMm: 1.5, rubPerTon: 70_900, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1250×2500" },
      { materialId: "cold", thicknessMm: 2, rubPerTon: 71_400, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1250×2500" },
      { materialId: "cold", thicknessMm: 3, rubPerTon: 76_900, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1250×2500" },
      { materialId: "zinc", thicknessMm: 0.5, rubPerTon: 93_750, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1000×2000" },
      { materialId: "zinc", thicknessMm: 0.55, rubPerTon: 97_310, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1250×2500" },
      { materialId: "zinc", thicknessMm: 0.7, rubPerTon: 97_400, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1250×2500" },
      { materialId: "zinc", thicknessMm: 1, rubPerTon: 97_400, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1250×2500" },
      { materialId: "zinc", thicknessMm: 1.2, rubPerTon: 96_900, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1250×2500" },
      { materialId: "zinc", thicknessMm: 1.5, rubPerTon: 96_400, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1250×2500" },
      { materialId: "zinc", thicknessMm: 2, rubPerTon: 96_400, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1250×2500" },
      { materialId: "zinc", thicknessMm: 3, rubPerTon: 96_900, source: "Атлантик Компани", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z", size: "1250×2500" },
      { materialId: "inox", thicknessMm: 2, rubPerTon: 340_000, source: "Внутренний ориентир", sourceDate: "2026-08-04", fetchedAt: "2026-08-04T12:00:00.000Z" },
    ],
  },
];
