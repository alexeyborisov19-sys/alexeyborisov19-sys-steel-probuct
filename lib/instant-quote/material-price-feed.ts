import type { MaterialId, MaterialMarketPrice } from "@/lib/instant-quote/pricing";

export type PriceFeedSource = {
  id: string;
  label: string;
  url: string;
  format: "pdf" | "xlsx";
  priority: number;
  materials: MaterialId[];
};

// Trusted supplier sources already used by the internal calculator.
// Fetching/parsing is server-side in the future production implementation;
// the browser must never depend on public CORS proxies for commercial pricing.
export const TRUSTED_METAL_PRICE_SOURCES: PriceFeedSource[] = [
  {
    id: "atlantik-smolensk",
    label: "Атлантик Компани, Смоленск",
    url: "https://atlantik-company.com/price.pdf",
    format: "pdf",
    priority: 10,
    materials: ["hot", "cold", "zinc", "inox"],
  },
  {
    id: "union-black",
    label: "ЮНИОН — чёрный металлопрокат",
    url: "https://pkfu.ru/download-price-list/metalloprokat.xlsx",
    format: "xlsx",
    priority: 20,
    materials: ["hot", "cold", "zinc"],
  },
  {
    id: "union-inox",
    label: "ЮНИОН — нержавеющий металлопрокат",
    url: "https://pkfu.ru/download-price-list/nerzhaveyka.xlsx",
    format: "xlsx",
    priority: 20,
    materials: ["inox"],
  },
  {
    id: "union-nonferrous",
    label: "ЮНИОН — цветной металлопрокат",
    url: "https://pkfu.ru/download-price-list/cvetmet.xlsx",
    format: "xlsx",
    priority: 20,
    materials: ["alu", "copper", "brass"],
  },
];

export type StoredPriceSnapshot = {
  sourceId: string;
  fetchedAt: string;
  sourceDate: string;
  rows: MaterialMarketPrice[];
  status: "ok" | "stale" | "failed";
  error?: string;
};

export type PriceSelection = {
  price: MaterialMarketPrice | null;
  sourceId: string | null;
  ageHours: number | null;
  stale: boolean;
};

export function snapshotAgeHours(snapshot: StoredPriceSnapshot, now = new Date()) {
  return Math.max(0, (now.getTime() - new Date(snapshot.fetchedAt).getTime()) / 3_600_000);
}

export function selectBestStoredPrice(
  snapshots: StoredPriceSnapshot[],
  materialId: MaterialId,
  thicknessMm: number,
  now = new Date(),
  staleAfterHours = 72,
): PriceSelection {
  const sourcePriority = new Map(TRUSTED_METAL_PRICE_SOURCES.map((source) => [source.id, source.priority]));
  const candidates = snapshots
    .filter((snapshot) => snapshot.status !== "failed")
    .flatMap((snapshot) => snapshot.rows
      .filter((row) => row.materialId === materialId && row.rubPerTon > 0)
      .map((row) => ({
        row,
        sourceId: snapshot.sourceId,
        ageHours: snapshotAgeHours(snapshot, now),
        priority: sourcePriority.get(snapshot.sourceId) ?? 999,
      })));

  if (!candidates.length) return { price: null, sourceId: null, ageHours: null, stale: true };

  candidates.sort((a, b) => {
    const da = Math.abs(a.row.thicknessMm - thicknessMm);
    const db = Math.abs(b.row.thicknessMm - thicknessMm);
    if (da !== db) return da - db;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.ageHours - b.ageHours;
  });

  const best = candidates[0];
  return {
    price: { ...best.row, exactThickness: Math.abs(best.row.thicknessMm - thicknessMm) < 0.01 },
    sourceId: best.sourceId,
    ageHours: best.ageHours,
    stale: best.ageHours > staleAfterHours,
  };
}

export function shouldRefreshPriceFeeds(
  snapshots: StoredPriceSnapshot[],
  now = new Date(),
  refreshEveryHours = 24,
) {
  if (!snapshots.length) return true;
  return snapshots.some((snapshot) => snapshot.status === "failed" || snapshotAgeHours(snapshot, now) >= refreshEveryHours);
}
