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

export function materialLabel(materialId: string | null) {
  return (materialId && MATERIAL_LABELS[materialId]) || "—";
}

export function operationLabels(operations: readonly ManufacturingOperation[]) {
  return operations.map((operation) => OPERATION_LABELS[operation]).filter(Boolean);
}
