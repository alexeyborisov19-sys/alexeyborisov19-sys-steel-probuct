import type { StoredPriceSnapshot } from "@/lib/instant-quote/material-price-feed";

// Verified snapshot from the official Atlantik Company PDF price list dated 2026-09-10.
// fetchedAt records when the snapshot was checked for this alpha branch. A server refresh
// adapter will replace this seed once automatic supplier parsing is enabled.
export const FALLBACK_METAL_PRICE_SNAPSHOTS: StoredPriceSnapshot[] = [
  {
    sourceId: "atlantik-smolensk",
    fetchedAt: "2026-09-14T09:00:00.000Z",
    sourceDate: "2026-09-10",
    status: "ok",
    rows: [
      { materialId: "hot", thicknessMm: 2, rubPerTon: 68_900, rubPerTonFrom3t: 68_400, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1250×2500" },
      { materialId: "hot", thicknessMm: 3, rubPerTon: 68_900, rubPerTonFrom3t: 68_400, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1250×2500" },
      { materialId: "hot", thicknessMm: 4, rubPerTon: 68_400, rubPerTonFrom3t: 67_900, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1500×6000" },
      { materialId: "hot", thicknessMm: 5, rubPerTon: 68_400, rubPerTonFrom3t: 67_900, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1500×6000" },
      { materialId: "hot", thicknessMm: 6, rubPerTon: 68_900, rubPerTonFrom3t: 68_400, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1500×6000" },
      { materialId: "hot", thicknessMm: 8, rubPerTon: 68_400, rubPerTonFrom3t: 67_900, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1500×6000" },
      { materialId: "hot", thicknessMm: 10, rubPerTon: 68_400, rubPerTonFrom3t: 67_900, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1500×6000" },
      { materialId: "hot", thicknessMm: 12, rubPerTon: 68_400, rubPerTonFrom3t: 67_900, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1500×6000" },
      { materialId: "hot", thicknessMm: 16, rubPerTon: 71_900, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1500×6000" },
      { materialId: "hot", thicknessMm: 20, rubPerTon: 73_900, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1500×6000" },

      { materialId: "cold", thicknessMm: 1, rubPerTon: 72_400, rubPerTonFrom3t: 71_900, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1250×2500" },
      { materialId: "cold", thicknessMm: 1.2, rubPerTon: 72_400, rubPerTonFrom3t: 71_900, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1250×2500" },
      { materialId: "cold", thicknessMm: 1.5, rubPerTon: 70_900, rubPerTonFrom3t: 70_400, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1250×2500" },
      { materialId: "cold", thicknessMm: 2, rubPerTon: 71_900, rubPerTonFrom3t: 71_400, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1250×2500" },
      { materialId: "cold", thicknessMm: 3, rubPerTon: 76_900, rubPerTonFrom3t: 76_400, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1250×2500" },

      { materialId: "zinc", thicknessMm: 0.55, rubPerTon: 97_310, rubPerTonFrom3t: 96_810, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1250×2500" },
      { materialId: "zinc", thicknessMm: 0.7, rubPerTon: 96_900, rubPerTonFrom3t: 96_400, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1250×2500" },
      { materialId: "zinc", thicknessMm: 1, rubPerTon: 95_900, rubPerTonFrom3t: 95_400, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1250×2500" },
      { materialId: "zinc", thicknessMm: 1.2, rubPerTon: 93_042, rubPerTonFrom3t: 92_542, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1250×2500" },
      { materialId: "zinc", thicknessMm: 1.5, rubPerTon: 93_807, rubPerTonFrom3t: 93_307, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1250×2500" },
      { materialId: "zinc", thicknessMm: 2, rubPerTon: 93_010, rubPerTonFrom3t: 92_510, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1250×2500" },
      { materialId: "zinc", thicknessMm: 3, rubPerTon: 96_764, rubPerTonFrom3t: 96_264, source: "Атлантик Компани", sourceDate: "2026-09-10", fetchedAt: "2026-09-14T09:00:00.000Z", size: "1250×2500" },
    ],
  },
];
