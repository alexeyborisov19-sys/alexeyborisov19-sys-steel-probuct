import type { ManufacturingOperation } from "@/lib/instant-quote/domain";

/** Customer-facing names shared by the configurator and the printed quote. */
export const MATERIAL_LABELS: Record<string, string> = {
  hot: "Сталь г/к",
  cold: "Сталь х/к",
  zinc: "Оцинкованная сталь",
};

export const OPERATION_LABELS: Record<ManufacturingOperation, string> = {
  "laser-cutting": "Лазерная резка",
  bending: "Гибка",
  threading: "Резьба",
  countersink: "Зенковка",
  welding: "Сварка",
  assembly: "Сборка",
  "surface-preparation": "Подготовка поверхности",
  "powder-coating": "Порошковая окраска",
  packaging: "Упаковка",
};

/** Shared notice: applies to customer-entered parameters as well as uploaded models. */
export const CALCULATION_DISCLAIMER =
  "Расчёт выполнен автоматически по предоставленным данным и является предварительным. "
  + "Расчёт носит ориентировочный характер. Он не является публичной офертой: "
  + "окончательные цена, сроки, характеристики и условия поставки определяются "
  + "коммерческим предложением и договором после проверки инженером.";

/** Keep the non-offer statement next to every displayed or spoken preliminary price. */
export const CALCULATION_DISCLAIMER_SHORT =
  "Предварительный автоматический расчёт. Носит ориентировочный характер. Не является офертой.";

/** Sheet thicknesses offered by the existing configurator. */
export const THICKNESS_OPTIONS = [0.5, 0.7, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 30, 40] as const;

/** Preserves the existing measured-thickness matching policy. */
export function nearestThicknessOption(measuredMm: number | null | undefined) {
  if (typeof measuredMm !== "number" || !Number.isFinite(measuredMm) || measuredMm <= 0) return null;

  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const option of THICKNESS_OPTIONS) {
    const distance = Math.abs(option - measuredMm);
    if (distance < bestDistance) {
      best = option;
      bestDistance = distance;
    }
  }

  if (best == null) return null;
  return bestDistance <= Math.max(0.2, best * 0.1) ? best : null;
}

/** Names actual model readings; never silently converts a candidate into a fact. */
export function modelReadings(cad: { thicknessFromModelMm: number | null; bendCountFromModel: number | null }) {
  const readings: string[] = [];
  const thickness = nearestThicknessOption(cad.thicknessFromModelMm);
  if (thickness != null) readings.push(`толщина ${String(thickness).replace(".", ",")} мм`);
  if (cad.bendCountFromModel != null && cad.bendCountFromModel > 0) readings.push(`гибов ${cad.bendCountFromModel}`);
  return readings.length ? `: ${readings.join(", ")}` : "";
}

export function materialLabel(materialId: string | null) {
  return (materialId && MATERIAL_LABELS[materialId]) || "—";
}

export function operationLabels(operations: readonly ManufacturingOperation[]) {
  return operations.map((operation) => OPERATION_LABELS[operation]).filter(Boolean);
}
