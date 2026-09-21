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
    materials: ["hot", "cold", "zinc"],
    enabled: true,
    role: "primary",
    region: "Смоленск",
    note: "Основной источник: прямой официальный PDF-прайс. Автопарсер подтверждён для г/к, х/к и оцинкованного листа; другие группы не заявляются до отдельной валидации.",
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
    enabled: false,
    role: "fallback",
    note: "Плановый резерв. Не включать до реализации и тестирования официального XLSX-adapter.",
  },
  {
    id: "union-inox",
    label: "ЮНИОН — нержавеющий металлопрокат",
    url: "https://pkfu.ru/download-price-list/nerzhaveyka.xlsx",
    format: "xlsx",
    priority: 30,
    materials: ["inox"],
    enabled: false,
    role: "fallback",
    note: "Плановый резерв. Не включать до реализации и тестирования официального XLSX-adapter.",
  },
  {
    id: "union-nonferrous",
    label: "ЮНИОН — цветной металлопрокат",
    url: "https://pkfu.ru/download-price-list/cvetmet.xlsx",
    format: "xlsx",
    priority: 30,
    materials: ["alu", "copper", "brass"],
    enabled: false,
    role: "fallback",
    note: "Плановый резерв. Не включать до реализации и тестирования официального XLSX-adapter.",
  },
];

export type StoredPriceSnapshot = {
  sourceId: string;
  fetchedAt: string;
  sourceDate: string;
  rows: MaterialMarketPrice[];
  status: "ok" | "stale" | "failed";
  error?: string;
  /** SHA-256 of normalized supplier rows, excluding fetch timestamps. */
  contentSha256?: string;
};

export type PriceSelection = {
  price: MaterialMarketPrice | null;
  sourceId: string | null;
  ageHours: number | null;
  stale: boolean;
};

export type StockRequirement = {
  widthMm: number;
  heightMm: number;
};

type Candidate = {
  row: MaterialMarketPrice;
  sourceId: string;
  ageHours: number;
  priority: number;
  explicitlyStale: boolean;
};

export function enabledPriceSources() {
  return TRUSTED_METAL_PRICE_SOURCES.filter((source) => source.enabled);
}

export function snapshotAgeHours(snapshot: StoredPriceSnapshot, now = new Date()) {
  const age = (now.getTime() - new Date(snapshot.fetchedAt).getTime()) / 3_600_000;
  return Number.isFinite(age) && age >= 0 ? age : Number.POSITIVE_INFINITY;
}

function candidatesFor(
  snapshots: StoredPriceSnapshot[],
  materialId: MaterialId,
  now: Date,
): Candidate[] {
  const sourcePriority = new Map(enabledPriceSources().map((source) => [source.id, source.priority]));
  return snapshots
    // Snapshot trust is established before selection (private basis validation or
    // the server-side feed pipeline). Keep known supplier priority, but do not
    // discard an already validated private/manual source solely because it is
    // absent from the public automatic-feed registry.
    .filter((snapshot) => snapshot.status !== "failed")
    .flatMap((snapshot) => snapshot.rows
      .filter((row) => row.materialId === materialId && row.rubPerTon > 0)
      .map((row) => ({
        row,
        sourceId: snapshot.sourceId,
        ageHours: snapshotAgeHours(snapshot, now),
        explicitlyStale: snapshot.status === "stale",
        priority: sourcePriority.get(snapshot.sourceId) ?? 999,
      })));
}

function selection(candidate: Candidate | undefined, thicknessMm: number, staleAfterHours: number): PriceSelection {
  if (!candidate) return { price: null, sourceId: null, ageHours: null, stale: true };
  return {
    price: { ...candidate.row, exactThickness: Math.abs(candidate.row.thicknessMm - thicknessMm) < 0.01 },
    sourceId: candidate.sourceId,
    ageHours: candidate.ageHours,
    stale: candidate.explicitlyStale || candidate.ageHours > staleAfterHours,
  };
}

export function selectBestStoredPrice(
  snapshots: StoredPriceSnapshot[],
  materialId: MaterialId,
  thicknessMm: number,
  now = new Date(),
  staleAfterHours = 72,
): PriceSelection {
  const candidates = candidatesFor(snapshots, materialId, now);
  candidates.sort((a, b) => {
    const da = Math.abs(a.row.thicknessMm - thicknessMm);
    const db = Math.abs(b.row.thicknessMm - thicknessMm);
    if (da !== db) return da - db;
    const freshness = Number(a.explicitlyStale || a.ageHours > staleAfterHours) - Number(b.explicitlyStale || b.ageHours > staleAfterHours);
    if (freshness !== 0) return freshness;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.ageHours - b.ageHours;
  });
  return selection(candidates[0], thicknessMm, staleAfterHours);
}

function sheetFootprint(size: string | undefined) {
  if (!size) return null;
  const match = size.match(/^\s*\d+(?:[,.]\d+)?\s*[xх×]\s*(\d+(?:[,.]\d+)?)\s*[xх×]\s*(\d+(?:[,.]\d+)?)/i);
  if (!match) return null;
  const widthMm = Number(match[1].replace(",", "."));
  const heightMm = Number(match[2].replace(",", "."));
  if (!(widthMm > 0 && heightMm > 0)) return null;
  return { widthMm, heightMm, areaMm2: widthMm * heightMm };
}

function fitsStock(stock: { widthMm: number; heightMm: number }, required: StockRequirement) {
  const direct = required.widthMm <= stock.widthMm && required.heightMm <= stock.heightMm;
  const rotated = required.widthMm <= stock.heightMm && required.heightMm <= stock.widthMm;
  return direct || rotated;
}

/**
 * Internal stock-aware selector. A supplier row with a known sheet format is
 * eligible only when the required rectangular blank fits that sheet, allowing
 * a 90° rotation. Generic/manual rows without a sheet size remain eligible but
 * rank behind an explicit fitting stock row.
 */
export function selectBestStoredPriceForStock(
  snapshots: StoredPriceSnapshot[],
  materialId: MaterialId,
  thicknessMm: number,
  required: StockRequirement,
  now = new Date(),
  staleAfterHours = 72,
): PriceSelection {
  if (!(required.widthMm > 0 && required.heightMm > 0)) {
    return selectBestStoredPrice(snapshots, materialId, thicknessMm, now, staleAfterHours);
  }

  const candidates = candidatesFor(snapshots, materialId, now)
    .map((candidate) => {
      const stock = sheetFootprint(candidate.row.size);
      return {
        ...candidate,
        stock,
        stockRank: stock ? 0 : 1,
        stockAreaMm2: stock?.areaMm2 ?? Number.POSITIVE_INFINITY,
      };
    })
    .filter((candidate) => !candidate.stock || fitsStock(candidate.stock, required));

  candidates.sort((a, b) => {
    const da = Math.abs(a.row.thicknessMm - thicknessMm);
    const db = Math.abs(b.row.thicknessMm - thicknessMm);
    if (da !== db) return da - db;
    const freshness = Number(a.explicitlyStale || a.ageHours > staleAfterHours) - Number(b.explicitlyStale || b.ageHours > staleAfterHours);
    if (freshness !== 0) return freshness;
    if (a.stockRank !== b.stockRank) return a.stockRank - b.stockRank;
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.stockAreaMm2 !== b.stockAreaMm2) return a.stockAreaMm2 - b.stockAreaMm2;
    return a.ageHours - b.ageHours;
  });

  return selection(candidates[0], thicknessMm, staleAfterHours);
}

export function shouldRefreshPriceFeeds(
  snapshots: StoredPriceSnapshot[],
  now = new Date(),
  refreshEveryHours = 24,
) {
  const enabledIds = new Set(enabledPriceSources().map((source) => source.id));
  const activeSnapshots = snapshots.filter((snapshot) => enabledIds.has(snapshot.sourceId));
  return [...enabledIds].some((id) => !activeSnapshots.some((snapshot) =>
    snapshot.sourceId === id && snapshot.status === "ok" && snapshotAgeHours(snapshot, now) < refreshEveryHours
  ));
}
