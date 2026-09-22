import type { FactualCalculationLineCode, FactualCalculationResult } from "@/lib/instant-quote/factual-calculation";
import type { ProductionParameterSummary } from "@/lib/instant-quote/production-parameters";
import type { ProjectFactualCalculationResult, ProjectFactualPartResult } from "@/lib/instant-quote/project-factual-calculation";

export type CalculationCompletenessStatus = "ready" | "review" | "blocked";

export type CalculationCompletenessItem = {
  key: string;
  label: string;
  state: "confirmed" | "missing" | "blocked";
  detail?: string;
};

export type PartCalculationCompleteness = {
  partId: string;
  scorePct: number;
  status: CalculationCompletenessStatus;
  confirmedChecks: number;
  totalChecks: number;
  items: CalculationCompletenessItem[];
};

export type ProjectCalculationCompleteness = {
  scorePct: number;
  status: CalculationCompletenessStatus;
  confirmedChecks: number;
  totalChecks: number;
  readyParts: number;
  reviewParts: number;
  blockedParts: number;
  parts: PartCalculationCompleteness[];
};

type ArticleGroup = {
  key: string;
  label: string;
  lineCode: FactualCalculationLineCode;
  missingCodes: string[];
  missingLabels?: string[];
};

const ARTICLE_GROUPS: ArticleGroup[] = [
  {
    key: "material",
    label: "Материал",
    lineCode: "material",
    missingCodes: ["material-price", "material-price-stale", "material-thickness-price", "geometry"],
  },
  {
    key: "laser",
    label: "Лазерная резка",
    lineCode: "laser-cutting",
    missingCodes: ["laser-rate", "laser-pierce-policy", "geometry"],
  },
  {
    key: "bending",
    label: "Гибка",
    lineCode: "bending",
    missingCodes: ["bend-count", "operation-rate"],
    missingLabels: ["Гибка"],
  },
  {
    key: "countersink",
    label: "Зенковка",
    lineCode: "countersink",
    missingCodes: ["countersink-count", "operation-rate"],
    missingLabels: ["Зенковка"],
  },
  {
    key: "welding",
    label: "Сварка",
    lineCode: "welding",
    missingCodes: ["weld-length", "operation-rate"],
    missingLabels: ["Сварка"],
  },
  {
    key: "powder",
    label: "Порошковая окраска",
    lineCode: "powder-coating",
    missingCodes: ["powder-area", "operation-rate"],
    missingLabels: ["Порошковая окраска"],
  },
  {
    key: "assembly",
    label: "Сборка",
    lineCode: "assembly",
    missingCodes: ["assembly-time", "operation-rate"],
    missingLabels: ["Сборка"],
  },
  {
    key: "surface-preparation",
    label: "Подготовка поверхности",
    lineCode: "surface-preparation",
    missingCodes: ["surface-preparation-area", "operation-rate"],
    missingLabels: ["Подготовка поверхности"],
  },
  {
    key: "packaging",
    label: "Упаковка",
    lineCode: "packaging",
    missingCodes: ["operation-rate"],
    missingLabels: ["Упаковка"],
  },
];

function roundPct(confirmed: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((confirmed / total) * 100)));
}

function hasFinitePositive(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function missingForGroup(calculation: FactualCalculationResult, group: ArticleGroup) {
  return calculation.missing.filter((item) => {
    if (!group.missingCodes.includes(item.code)) return false;
    if (!group.missingLabels?.length) return true;
    return group.missingLabels.includes(item.label);
  });
}

function articleIsExpected(calculation: FactualCalculationResult, group: ArticleGroup) {
  return calculation.lines.some((line) => line.code === group.lineCode) || missingForGroup(calculation, group).length > 0;
}

function articleItem(calculation: FactualCalculationResult, group: ArticleGroup): CalculationCompletenessItem | null {
  if (!articleIsExpected(calculation, group)) return null;
  const missing = missingForGroup(calculation, group);
  const line = calculation.lines.find((item) => item.code === group.lineCode);
  if (line && missing.length === 0) {
    return { key: `article:${group.key}`, label: group.label, state: "confirmed" };
  }
  const blocked = missing.some((item) => item.blocking);
  return {
    key: `article:${group.key}`,
    label: group.label,
    state: blocked ? "blocked" : "missing",
    detail: missing.map((item) => item.reason).join(" ") || "Статья не подтверждена.",
  };
}

function geometryItems(parameters: ProductionParameterSummary | undefined): CalculationCompletenessItem[] {
  if (!parameters) {
    return [
      { key: "geometry:dimensions", label: "Габариты", state: "blocked", detail: "Нет производственных параметров." },
      { key: "geometry:blank", label: "Заготовка", state: "blocked", detail: "Нет производственных параметров." },
      { key: "geometry:mass", label: "Масса", state: "blocked", detail: "Нет производственных параметров." },
    ];
  }

  return [
    {
      key: "geometry:dimensions",
      label: "Габариты",
      state: hasFinitePositive(parameters.dimensionsMm.width) && hasFinitePositive(parameters.dimensionsMm.height) ? "confirmed" : "blocked",
      detail: hasFinitePositive(parameters.dimensionsMm.width) && hasFinitePositive(parameters.dimensionsMm.height) ? undefined : "Не подтверждены X×Y.",
    },
    {
      key: "geometry:blank",
      label: "Расчётная заготовка",
      state: hasFinitePositive(parameters.stock.blankAreaMm2) ? "confirmed" : "blocked",
      detail: hasFinitePositive(parameters.stock.blankAreaMm2) ? undefined : "Не определена площадь заготовки.",
    },
    {
      key: "geometry:mass",
      label: "Закупочная масса",
      state: hasFinitePositive(parameters.mass.purchasedKgEach) ? "confirmed" : "missing",
      detail: hasFinitePositive(parameters.mass.purchasedKgEach) ? undefined : "Не подтверждена закупочная масса.",
    },
  ];
}

export function summarizePartCalculationCompleteness(
  part: ProjectFactualPartResult,
  parameters?: ProductionParameterSummary,
): PartCalculationCompleteness {
  const items = geometryItems(parameters);

  if (part.calculation) {
    for (const group of ARTICLE_GROUPS) {
      const item = articleItem(part.calculation, group);
      if (item) items.push(item);
    }
    for (const missing of part.calculation.missing.filter((item) => item.code === "operation-rate")) {
      const alreadyRepresented = items.some((item) => item.label === missing.label);
      if (!alreadyRepresented) {
        items.push({
          key: `operation:${missing.label}`,
          label: missing.label,
          state: missing.blocking ? "blocked" : "missing",
          detail: missing.reason,
        });
      }
    }
  } else {
    items.push({
      key: "calculation",
      label: "Расчёт стоимости",
      state: part.status === "blocked" ? "blocked" : "missing",
      detail: part.dfmBlockingReasons[0] ?? part.dfmReviewReasons[0] ?? "Расчёт ещё не сформирован.",
    });
  }

  if (part.dfmBlockingReasons.length > 0) {
    items.push({
      key: "dfm:blocking",
      label: "DFM",
      state: "blocked",
      detail: part.dfmBlockingReasons.join("; "),
    });
  } else if (part.dfmReviewReasons.length > 0) {
    items.push({
      key: "dfm:review",
      label: "DFM review",
      state: "missing",
      detail: part.dfmReviewReasons.join("; "),
    });
  } else {
    items.push({ key: "dfm", label: "DFM", state: "confirmed" });
  }

  const confirmedChecks = items.filter((item) => item.state === "confirmed").length;
  const totalChecks = items.length;
  const hasBlocked = items.some((item) => item.state === "blocked") || part.status === "blocked";
  const fullyReady = !hasBlocked && items.every((item) => item.state === "confirmed") && part.status === "complete";

  return {
    partId: part.partId,
    scorePct: roundPct(confirmedChecks, totalChecks),
    status: hasBlocked ? "blocked" : fullyReady ? "ready" : "review",
    confirmedChecks,
    totalChecks,
    items,
  };
}

export function summarizeProjectCalculationCompleteness(
  calculation: ProjectFactualCalculationResult,
  productionParametersByPartId: Record<string, ProductionParameterSummary>,
): ProjectCalculationCompleteness {
  const parts = calculation.parts.map((part) =>
    summarizePartCalculationCompleteness(part, productionParametersByPartId[part.partId]),
  );
  const confirmedChecks = parts.reduce((sum, part) => sum + part.confirmedChecks, 0);
  const totalChecks = parts.reduce((sum, part) => sum + part.totalChecks, 0);
  const blockedParts = parts.filter((part) => part.status === "blocked").length;
  const reviewParts = parts.filter((part) => part.status === "review").length;
  const readyParts = parts.filter((part) => part.status === "ready").length;

  return {
    scorePct: roundPct(confirmedChecks, totalChecks),
    status: blockedParts > 0 ? "blocked" : reviewParts > 0 || readyParts !== parts.length ? "review" : "ready",
    confirmedChecks,
    totalChecks,
    readyParts,
    reviewParts,
    blockedParts,
    parts,
  };
}