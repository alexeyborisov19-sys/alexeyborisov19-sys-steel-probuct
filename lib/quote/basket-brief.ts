import {
  validBasketDesign,
  basketDesignSummary,
  type BasketDesign,
} from "./basket-design";
export const basketScreens = {
  "wide-slots": "10 длинных прорезей",
  round: "Круглая перфорация",
  slots: "Щелевая перфорация",
  lamella: "Ламели",
  solid: "Без перфорации",
  custom: "Рисунок по проекту",
} as const;
export const basketColors = [
  { ral: "7024", name: "Графитовый серый", hex: "#474a50" },
  { ral: "7016", name: "Антрацитовый серый", hex: "#383e42" },
  { ral: "9003", name: "Сигнальный белый", hex: "#ecece7" },
  { ral: "9005", name: "Чёрный", hex: "#171717" },
  { ral: "9006", name: "Бело-алюминиевый", hex: "#a5a5a5" },
  { ral: "8017", name: "Шоколадно-коричневый", hex: "#45322e" },
  { ral: "3005", name: "Винно-красный", hex: "#5e2028" },
  { ral: "6005", name: "Зелёный мох", hex: "#254b3b" },
] as const;
// Catalog examples only: not Steel Produkt stock SKUs or guaranteed equipment fit.
export const basketSizeExamples = [
  { width: 900, height: 600, depth: 550 },
  { width: 1000, height: 700, depth: 550 },
  { width: 1200, height: 900, depth: 600 },
  { width: 1300, height: 1050, depth: 650 },
] as const;
export type BasketBrief = {
  width: number;
  height: number;
  depth: number;
  quantity: number;
  ral: string;
  screen: string;
  design?: BasketDesign;
};
export function validBasketBrief(input: BasketBrief) {
  return (
    [input.width, input.height, input.depth, input.quantity].every(
      (n) => Number.isSafeInteger(n) && n > 0 && n <= 10000,
    ) &&
    basketColors.some((c) => c.ral === input.ral) &&
    Object.hasOwn(basketScreens, input.screen) &&
    (input.design === undefined || validBasketDesign(input.design))
  );
}
export function basketBriefHref(input: BasketBrief) {
  if (!validBasketBrief(input))
    throw new Error("Некорректные параметры задания");
  const params = new URLSearchParams({
    source: "basket-brief",
    basketWidth: String(input.width),
    basketHeight: String(input.height),
    basketDepth: String(input.depth),
    basketQuantity: String(input.quantity),
    basketRal: input.ral,
    basketScreen: input.design?.front.pattern ?? input.screen,
  });
  if (input.design) params.set("basketDesign", JSON.stringify(input.design));
  return `/contacts?${params}#contact-form`;
}
export function basketBriefSummary(params: URLSearchParams): string | null {
  if (params.get("source") !== "basket-brief") return null;
  const input = {
    width: Number(params.get("basketWidth")),
    height: Number(params.get("basketHeight")),
    depth: Number(params.get("basketDepth")),
    quantity: Number(params.get("basketQuantity")),
    ral: params.get("basketRal") ?? "",
    screen: params.get("basketScreen") ?? "",
  };
  let design: BasketDesign | undefined;
  if (params.has("basketDesign")) {
    try {
      const raw = params.get("basketDesign")!;
      if (raw.length > 3000) return null;
      const value: unknown = JSON.parse(raw);
      if (!validBasketDesign(value)) return null;
      design = value;
    } catch {
      return null;
    }
  }
  if (!validBasketBrief(input)) return null;
  return [
    "Прошу рассчитать корзины для кондиционеров.",
    `Предварительный наружный габарит (Ш × В × Г): ${input.width} × ${input.height} × ${input.depth} мм.`,
    `Количество: ${input.quantity} шт.`,
    `Экран: ${basketScreens[(design?.front.pattern ?? input.screen) as keyof typeof basketScreens]}.`,
    `Цвет: RAL ${input.ral}.`,
    ...(design ? [basketDesignSummary(design)] : []),
    "Размеры, воздушные и сервисные зазоры, крепление и комплектность необходимо подтвердить по модели кондиционера и проекту фасада.",
    "Модель наружного блока / основание / город объекта: уточню.",
  ].join("\n");
}
