import type { ManufacturingOperation } from "@/lib/instant-quote/domain";

/**
 * Customer-facing names shared by the configurator and the printed quote, so
 * the two can never disagree about what was ordered.
 */
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

/**
 * Single wording for the machine calculation, shared by the screen and the
 * printed quote so the customer cannot be shown two different promises. It
 * follows the site's own terms at /legal/terms rather than inventing a new
 * legal formula.
 */
export const CALCULATION_DISCLAIMER =
  "Расчёт выполнен автоматически по загруженной модели и является предварительным. "
  + "Он не является публичной офертой: окончательные цена, сроки, характеристики и "
  + "условия поставки определяются коммерческим предложением и договором после "
  + "проверки инженером.";

/** Short form for places where the full sentence does not fit. */
export const CALCULATION_DISCLAIMER_SHORT =
  "Предварительный автоматический расчёт. Не является офертой.";

/**
 * Sheet thicknesses the configurator offers. A measured STEP thickness is
 * snapped onto this list, because a thickness nobody stocks cannot be bought,
 * cut or priced — only quoted by an engineer.
 */
export const THICKNESS_OPTIONS = [0.5, 0.7, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 30, 40] as const;

/**
 * Nearest stocked thickness to a measured one, or null when nothing is close
 * enough to stand in for it. The tolerance matches the server's: it absorbs
 * mill tolerance and modelling rounding, and refuses anything wider, so the
 * configurator never pre-selects a thickness the server will then reject.
 */
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

/**
 * Names what the analyser read off the customer's own model, so an auto-filled
 * thickness or bend count is visible rather than silently applied. Returns an
 * empty string when the model told us nothing worth repeating.
 */
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
