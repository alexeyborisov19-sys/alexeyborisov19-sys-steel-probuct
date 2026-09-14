import type { MaterialId, MaterialMarketPrice } from "@/lib/instant-quote/pricing";

export type PriceFeedSource = {
  id: string;
  label: string;
  url: string;
  format: "pdf" | "xlsx" | "html" | "api";
  priority: number;
  materials: MaterialId[];
  enabled: boolean;
  role: "primary" | "secondary" | "fallback" | "planned";
  region?: string;
  note?: string;
};

// Steel Product Online supplier policy:
// 1) Prefer local, directly retrievable supplier data for real quotes.
// 2) Use only official supplier endpoints for automatic commercial pricing.
// 3) Never depend on third-party price aggregators for the authoritative quote.
// 4) Keep the latest successful snapshot when an upstream source is unavailable.
export const TRUSTED_METAL_PRICE_SOURCES: PriceFeedSource[] = [
  {
    id: "atlantik-smolensk",
    label: "Атлантик Компани, Смоленск",
    url: "https://atlantik-company.com/price.pdf",
    format: "pdf",
    priority: 1,
    materials: ["hot", "cold", "zinc", "inox"],
    enabled: true,
    role: "primary",
    region: "Смоленск",
    note: "Основной источник: прямой официальный PDF-прайс, пригодный для серверного парсинга.",
  },
  {
    id: "metallservis-official",
    label: "МЕТАЛЛСЕРВИС",
    url: "https://mc.ru",
    format: "html",
    priority: 5,
    materials: ["hot", "cold", "zinc", "inox", "alu", "copper", "brass"],
    enabled: false,
    role: "planned",
    region: "Россия",
    note: "Подключить как второй приоритет после подтверждения стабильного официального машинного endpoint/API или файла прайса. Сторонние агрегаторы не использовать как источник коммерческой цены.",
  },
  {
    id: "union-black",
    label: "ЮНИОН — чёрный металлопрокат",
    url: "https://pkfu.ru/download-price-list/metalloprokat.xlsx",
    format: "xlsx",
    priority: 30,
    materials: ["hot", "cold", "zinc"],
    enabled: true,
    role: "fallback",
  },
  {
    id: "union-inox",
    label: "ЮНИОН — нержавеющий металлопрокат",
    url: "https://pkfu.ru/download-price-list/nerzhaveyka.xlsx",
    format: "xlsx",
    priority: 30,
    materials: ["inox"],
    enabled: true,
    role: "fallback",
  },
  {
    id: "union-nonferrous",
    label: "ЮНИОН — цветной металлопрокат",
    url: "https://pkfu.ru/download-price-list/cvetmet.xlsx",
    format: "xlsx",
    priority: 30,
    materials: ["alu", "copper", "brass"],
    enabled: true,
    role: "fallback",
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

export function enabledPriceSources() {
  return TRUSTED_METAL_PRICE_SOURCES.filter((source) => source.enabled);
}

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
  const sourcePriority = new Map(enabledPriceSources().map((source) => [source.id, source.priority]));
  const candidates = snapshots
    .filter((snapshot) => snapshot.status !== "failed" && sourcePriority.has(snapshot.sourceId))
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
  const enabledIds = new Set(enabledPriceSources().map((source) => source.id));
  const activeSnapshots = snapshots.filter((snapshot) => enabledIds.has(snapshot.sourceId));
  if (!activeSnapshots.length) return true;
  return activeSnapshots.some((snapshot) => snapshot.status === "failed" || snapshotAgeHours(snapshot, now) >= refreshEveryHours);
}
