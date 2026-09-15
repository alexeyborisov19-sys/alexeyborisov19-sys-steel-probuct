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

export function materialLabel(materialId: string | null) {
  return (materialId && MATERIAL_LABELS[materialId]) || "—";
}

export function operationLabels(operations: readonly ManufacturingOperation[]) {
  return operations.map((operation) => OPERATION_LABELS[operation]).filter(Boolean);
}
