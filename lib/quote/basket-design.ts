import { validBasketFit, basketFitSummary, type BasketFit } from "./basket-fit";
/** Geometry of a user-defined rectangular panel field, not a shop flat pattern. */
export const panelPatterns = {
  "wide-slots": "10 длинных прорезей",
  round: "Круглые отверстия",
  slots: "Продольные отверстия",
  solid: "Без перфорации",
  lamella: "Ламели",
  custom: "Рисунок по проекту",
} as const;
export type PanelPattern = {
  pattern: keyof typeof panelPatterns;
  diameter: number;
  slotLength: number;
  pitch: number;
  margin: number;
};
export type BasketDesign = {
  version: 1;
  sizing?: "basket" | "block";
  capacityClass?: number;
  fit?: BasketFit;
  blockWidth: number;
  blockHeight: number;
  blockDepth: number;
  mass: number;
  facade: number | null;
  offset: number | null;
  mount: "existing" | "bearing" | "unknown";
  front: PanelPattern;
  side: PanelPattern;
};
export function defaultBasketDesign(): BasketDesign {
  return {
    version: 1,
    blockWidth: 0,
    blockHeight: 0,
    blockDepth: 0,
    mass: 0,
    facade: null,
    offset: null,
    mount: "unknown",
    front: {
      pattern: "round",
      diameter: 10,
      slotLength: 30,
      pitch: 20,
      margin: 20,
    },
    side: {
      pattern: "round",
      diameter: 10,
      slotLength: 30,
      pitch: 20,
      margin: 20,
    },
  };
}
function bounded(n: unknown, min: number, max: number) {
  return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
}
export function validPanel(p: unknown): p is PanelPattern {
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  const a = p as PanelPattern;
  return (
    Object.hasOwn(panelPatterns, a.pattern) &&
    bounded(a.diameter, 1, 500) &&
    bounded(a.slotLength, a.diameter, 1000) &&
    bounded(a.pitch, 1, 2000) &&
    bounded(a.margin, 0, 1000) &&
    (a.pattern === "round"
      ? a.pitch > a.diameter
      : a.pattern === "slots"
        ? a.pitch > a.slotLength
        : true)
  );
}
export function validBasketDesign(v: unknown): v is BasketDesign {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const d = v as BasketDesign;
  return (
    d.version === 1 &&
    (d.sizing === undefined || d.sizing === "basket" || d.sizing === "block") &&
    (d.fit === undefined || validBasketFit(d.fit)) &&
    (d.capacityClass === undefined ||
      [7, 9, 12, 18, 24, 36].includes(d.capacityClass)) &&
    [d.blockWidth, d.blockHeight, d.blockDepth].every((n) =>
      bounded(n, 0, 10000),
    ) &&
    bounded(d.mass, 0, 2000) &&
    (d.facade === null || bounded(d.facade, 0, 2000)) &&
    (d.offset === null || bounded(d.offset, 0, 2000)) &&
    ["existing", "bearing", "unknown"].includes(d.mount) &&
    validPanel(d.front) &&
    validPanel(d.side)
  );
}
export function panelCutting(width: number, height: number, p: PanelPattern) {
  if (!bounded(width, 1, 10000) || !bounded(height, 1, 10000) || !validPanel(p))
    throw Error("Некорректные параметры панели");
  // Wide-slot count is confirmed; width/margins are not a fabrication specification yet.
  if (p.pattern === "wide-slots") return { known:false, holes:10, rows:10, cols:1, cutLengthM:0, openPercent:0, grossAreaM2:width*height/1e6 };
  const known = p.pattern !== "custom" && p.pattern !== "lamella";
  const holeWidth = p.pattern === "slots" ? p.slotLength : p.diameter;
  const cols = Math.max(
    0,
    Math.floor((width - 2 * p.margin - holeWidth) / p.pitch) + 1,
  );
  const rows = Math.max(
    0,
    Math.floor((height - 2 * p.margin - p.diameter) / p.pitch) + 1,
  );
  const holes = known && p.pattern !== "solid" ? cols * rows : 0;
  const length =
    p.pattern === "slots"
      ? 2 * (p.slotLength - p.diameter) + Math.PI * p.diameter
      : Math.PI * p.diameter;
  const area =
    p.pattern === "slots"
      ? (p.slotLength - p.diameter) * p.diameter +
        (Math.PI * p.diameter ** 2) / 4
      : (Math.PI * p.diameter ** 2) / 4;
  return {
    known,
    holes,
    rows: holes ? rows : 0,
    cols: holes ? cols : 0,
    cutLengthM: known ? (2 * (width + height) + holes * length) / 1000 : 0,
    openPercent: known ? ((holes * area) / (width * height)) * 100 : 0,
    grossAreaM2: (width * height) / 1e6,
  };
}
export function bracketSelection(d: BasketDesign) {
  return {
    required: d.mount !== "existing",
    thicknessMm: null,
    facadeOffsetMm:
      d.facade === null || d.offset === null ? null : d.facade + d.offset,
    status: d.mount === "existing" ? "existing-supports" : "engineering-review",
  } as const;
}
export function basketDesignSummary(d: BasketDesign) {
  const panel = (p: PanelPattern) =>
    p.pattern === "wide-slots" ? "10 длинных продолговатых прорезей по ширине панели; ширина отверстий и краевые отступы уточняются по чертежу" :
    `${panelPatterns[p.pattern]}; отверстие ${p.diameter} мм${p.pattern === "slots" ? `, длина ${p.slotLength} мм` : ""}; шаг ${p.pitch} мм; поле от края ${p.margin} мм`;
  return [
    ...(d.capacityClass
      ? [
          `Класс кондиционера: ${d.capacityClass} тыс. БТЕ/ч; подбор корзины предварительный. Размеры конкретной модели и зазоры обязательно перепроверить.`,
        ]
      : []),
    `Блок (Ш × В × Г): ${d.blockWidth || "неизвестно"} × ${d.blockHeight || "неизвестно"} × ${d.blockDepth || "неизвестно"} мм; масса: ${d.mass ? `${d.mass} кг` : "неизвестна"}.`,
    `Фасад от несущей стены: ${d.facade === null ? "неизвестно" : `${d.facade} мм`}; отступ от облицовки: ${d.offset === null ? "неизвестно" : `${d.offset} мм`} (эти значения не равны полной длине кронштейна).`,
    `Опоры блока: ${d.mount === "existing" ? "существующие кронштейны блока; корзина крепится к этим кронштейнам" : d.mount === "bearing" ? "нужны несущие кронштейны" : "тип необходимо уточнить"}.`,
    basketFitSummary(d.fit),
    "Толщина кронштейнов: требуется подбор по проверенной конструкции, основанию и нагрузкам.",
    "Конструкция: передняя и две боковые панели, без верхней крышки. Задние отгибы не крепятся к стене; корзина закрепляется только на кронштейнах наружного блока.",
    `Передняя панель: ${panel(d.front)}.`,
    `Боковые панели: ${panel(d.side)}.`,
    "Перфорация рассчитана для прямоугольных полей; развёртки, гибы, крепёжные зоны, вентиляция и несущая способность требуют проверки.",
  ].join("\n");
}
