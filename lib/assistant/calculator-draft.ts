import type { CadFormat, ManufacturingOperation } from "@/lib/instant-quote/domain";
import { MATERIAL_LABELS, OPERATION_LABELS } from "@/lib/instant-quote/client-labels";

/**
 * Public, human-reviewed chat draft. Never transfer CAD contents, file names,
 * quotations, project identifiers, contacts, or private production rates.
 * Opening the assistant does NOT send this draft to a model.
 */
export type PublicCalculatorDraftInput = {
  partCount: number;
  format?: CadFormat | null;
  materialId?: string | null;
  materialConfirmed?: boolean;
  thicknessMm?: number | null;
  quantity?: number | null;
  quantityValid?: boolean;
  operations?: readonly ManufacturingOperation[];
};

const formatLabels: Record<CadFormat, string> = {
  dxf: "DXF", dwg: "DWG", step: "STEP", stp: "STP",
};

export function buildPublicCalculatorAssistantDraft(input: PublicCalculatorDraftInput): string {
  const count = Number.isSafeInteger(input.partCount)
    && input.partCount >= 0 && input.partCount <= 5 ? input.partCount : 0;
  const lines = [
    "Помогите проверить полноту исходных данных в CAD-калькуляторе и объяснить, что потребуется инженеру.",
    "Это не запрос на расчёт новой цены или подтверждение изготовляемости.",
    `Позиций в проекте: ${count}.`,
  ];
  if (count > 0) {
    if (input.format && input.format in formatLabels) {
      lines.push(`Формат исходника активной позиции: ${formatLabels[input.format]} (содержимое файла не передаётся).`);
    }
    const material = input.materialId ? MATERIAL_LABELS[input.materialId] : null;
    lines.push(material
      ? `Материал в форме: ${material}; ${input.materialConfirmed ? "выбор подтверждён пользователем" : "выбор требует подтверждения"}.`
      : "Материал не указан.");
    const thickness = input.thicknessMm;
    if (typeof thickness === "number" && Number.isFinite(thickness) && thickness > 0) {
      lines.push(`Толщина в форме: ${thickness.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} мм; требуется сверка с чертежом.`);
    } else {
      lines.push("Толщина не указана или требует уточнения.");
    }
    if (input.quantityValid && typeof input.quantity === "number" && Number.isSafeInteger(input.quantity) && input.quantity > 0) {
      lines.push(`Количество в форме: ${input.quantity} шт.`);
    } else {
      lines.push("Количество не подтверждено; перед расчётом его нужно проверить.");
    }
    const operations = [...new Set(input.operations ?? [])]
      .map((code) => OPERATION_LABELS[code]).filter(Boolean);
    if (operations.length) lines.push(`Отмеченные операции: ${operations.join(", ")}.`);
  } else {
    lines.push("Пока не добавлены чертёж или размеры. Подскажите, с чего начать.");
  }
  lines.push("Что ещё нужно уточнить для технически корректной заявки? Не придумывайте недостающие размеры, допуски или цены.");
  return lines.join("\n").slice(0, 1400);
}


/** Other public configurators have different geometries; do not guess their values. */
export type CalculatorHelpKind =
  | "metal-cassettes"
  | "air-conditioner-basket"
  | "bim-cassettes"
  | "bim-trims";

const CALCULATOR_HELP_PROMPTS: Record<CalculatorHelpKind, string> = {
  "metal-cassettes":
    "Помогите мне разобраться с расчётом металлокассет: открытый или закрытый тип, толщина, русты и раскладка стены. " +
    "Поясните, какие размеры и узлы необходимо проверить перед изготовлением. " +
    "Это предварительный калькулятор: не назначайте цену, допуски или конструктивные решения без исходного проекта.",
  "air-conditioner-basket":
    "Помогите правильно подобрать размеры корзины для наружного блока кондиционера. " +
    "Какие размеры самого блока, сервисные зазоры, данные фасада, крепление и особенности обслуживания нужно указать? " +
    "Не подтверждайте несущую способность креплений и совместимость без проекта и инструкции производителя.",
  "bim-cassettes":
    "Помогите разобраться в бесплатной BIM-библиотеке металлокассет: геометрии, стыках, рустах и экспорте IFC. " +
    "Это координационная модель, а не проверенная рабочая документация и не готовое нативное семейство RFA. " +
    "Какие параметры необходимо проверить до проектирования и производства?",
  "bim-trims":
    "Помогите с BIM-моделью доборного элемента: объясните поля A, B, H, T, форму Г-профиля и экспорт IFC/CSV. " +
    "Это координационная геометрия. Не придумывайте радиусы гиба, размеры примыканий или возможности изготовления.",
};

export function buildProductCalculatorAssistantDraft(kind: CalculatorHelpKind): string {
  return CALCULATOR_HELP_PROMPTS[kind];
}
