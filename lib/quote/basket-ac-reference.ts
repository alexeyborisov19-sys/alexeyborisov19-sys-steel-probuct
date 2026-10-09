import type { BasketDesign } from "./basket-design";
import { emptyBasketFit } from "./basket-fit";
// Catalog examples, not universal dimensions or verified Steel Produkt compatibility.
const ballu =
  "https://www.ballu.ru/upload/iblock/c7d/c7dcdf1ecf7a9ab7a529bd28a14f58c4.pdf";
export const basketAcClasses = [
  {
    code: 7,
    kw: "2,1",
    block: "722 × 493 × 264",
    blockDimensions: [722, 493, 264],
    model: "Ballu BSAG/out-07HN1_20Y",
    basket: [900, 600, 550],
    source: ballu,
  },
  {
    code: 9,
    kw: "2,6",
    block: "722 × 493 × 264",
    blockDimensions: [722, 493, 264],
    model: "Ballu BSAG/out-09HN1_20Y",
    basket: [900, 600, 550],
    source: ballu,
  },
  {
    code: 12,
    kw: "3,5",
    block: "722 × 493 × 264",
    blockDimensions: [722, 493, 264],
    model: "Ballu BSAG/out-12HN1_20Y",
    basket: [1000, 700, 550],
    source: ballu,
  },
  {
    code: 18,
    kw: "5,3",
    block: "856 × 538 × 290",
    blockDimensions: [856, 538, 290],
    model: "Ballu BSAG/out-18HN1_20Y",
    basket: [1200, 900, 600],
    source: ballu,
  },
  {
    code: 24,
    kw: "7,0",
    block: "935 × 667 × 341",
    blockDimensions: [935, 667, 341],
    model: "Ballu BSAG/out-24HN1_20Y",
    basket: [1200, 900, 600],
    source: ballu,
  },
  {
    code: 36,
    kw: "10,6",
    block: "946 × 810 × 410",
    blockDimensions: [946, 810, 410],
    model: "Midea MTJ-36HWFNX-QRD0W(GA)",
    basket: [1300, 1050, 650],
    source:
      "https://www.midea.com/ke/air-treatment/air-conditioners/a7-duct-inverter-aircon.mtj-36hwfnx-qrd0w-ga-",
  },
] as const;

export const basketAcDimensionDisclaimer = "Размеры ориентировочные. Необходимо подтвердить по спецификации производителя конкретной модели";
export type BasketAcAppliedReference = {
  catalogueVersion: 1;
  code: number;
  model: string;
  blockDimensions: readonly number[];
  source: string;
  status: "unconfirmed";
};
export function basketAcReference(code: number): BasketAcAppliedReference {
  const item = basketAcClasses.find(item => item.code === code);
  if (!item) throw new Error("Неизвестный пример кондиционера.");
  return { catalogueVersion: 1, code, model: item.model, blockDimensions: [...item.blockDimensions], source: item.source, status: "unconfirmed" };
}
export function validBasketAcReference(value: unknown): value is BasketAcAppliedReference {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const ref = value as BasketAcAppliedReference;
  const item = basketAcClasses.find(item => item.code === ref.code);
  return !!item && ref.catalogueVersion === 1 && ref.status === "unconfirmed" && ref.model === item.model && ref.source === item.source && Array.isArray(ref.blockDimensions) && ref.blockDimensions.length === 3 && ref.blockDimensions.every((n, index) => n === item.blockDimensions[index]);
}
/** Explicit starting example only. Never fills unknown installation/airflow clearances. */
export function applyBasketAcReference(design: BasketDesign, code: number): BasketDesign {
  const reference = basketAcReference(code);
  const [width, height, depth] = reference.blockDimensions;
  return { ...design, capacityClass: code, acReference: reference, blockWidth: width, blockHeight: height, blockDepth: depth, fit: { ...(design.fit ?? emptyBasketFit()), width, height, depth } };
}
export function basketAcReferenceSummary(reference: BasketAcAppliedReference) {
  return `Исходный пример наружного блока: ${reference.model}, ${reference.blockDimensions.join(" × ")} мм (Ш × В × Г); класс ${reference.code} тыс. BTU/h. Источник: ${reference.source}. Статус: не подтверждено. Текущие введённые размеры могут отличаться от исходного примера. ${basketAcDimensionDisclaimer}. Зазоры, выступающие части и совместимость не подтверждены.`;
}
