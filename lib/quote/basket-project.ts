import { PRODUCT_CALCULATION_NOTICE } from "../product-calculation-notice";
import { cleanBasketWallAssembly } from "./basket-wall-assembly";
import { basketAcReference, basketAcDimensionDisclaimer } from "./basket-ac-reference";
import { fitLabels, type BasketFit } from "./basket-fit";
import { validBasketBrief, type BasketBrief } from "./basket-brief";
import { cleanBasketReview } from "./basket-review";
export const MAX_BASKET_PROJECT_BYTES = 512000;
export const MAX_BASKET_POSITIONS = 100;
function clean(items: unknown): BasketBrief[] {
  if (
    !Array.isArray(items) ||
    items.length < 1 ||
    items.length > MAX_BASKET_POSITIONS
  )
    throw Error("В спецификации должно быть от 1 до 100 позиций.");
  return items.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw Error("Некорректная позиция.");
    const v = raw as BasketBrief;
    if (!validBasketBrief(v))
      throw Error("Проверьте размеры, рисунок и количество в спецификации.");
    const { width, height, depth, quantity, ral, screen } = v;
    const design = v.design
      ? {
          version: 1 as const,
          ...(v.design.appearance ? {appearance:v.design.appearance} : {}),
          ...(v.design.wallAssembly ? { wallAssembly: cleanBasketWallAssembly(v.design.wallAssembly) } : {}),
          ...(v.design.acReference ? { acReference: basketAcReference(v.design.acReference.code) } : {}),
          ...(v.design.sizing ? { sizing: v.design.sizing } : {}),
          ...(v.design.wallKind ? { wallKind: v.design.wallKind } : {}),
          blockWidth: v.design.blockWidth,
          blockHeight: v.design.blockHeight,
          blockDepth: v.design.blockDepth,
          mass: v.design.mass,
          facade: v.design.facade,
          offset: v.design.offset,
          mount: v.design.mount,
          ...(v.design.fit
            ? {
                fit: Object.fromEntries(
                  Object.keys(fitLabels).map((k) => [
                    k,
                    v.design!.fit![k as keyof BasketFit],
                  ]),
                ) as BasketFit,
              }
            : {}),
          ...(v.design.capacityClass === undefined
            ? {}
            : { capacityClass: v.design.capacityClass }),
          front: {
            pattern: v.design.front.pattern,
            diameter: v.design.front.diameter,
            slotLength: v.design.front.slotLength,
            pitch: v.design.front.pitch,
            margin: v.design.front.margin,
          },
          side: {
            pattern: v.design.side.pattern,
            diameter: v.design.side.diameter,
            slotLength: v.design.side.slotLength,
            pitch: v.design.side.pitch,
            margin: v.design.side.margin,
          },
        }
      : undefined;
    return {
      ...(v.positionId ? {positionId:v.positionId} : {}),
      width,
      height,
      depth,
      quantity,
      ral,
      screen: design?.front.pattern ?? screen,
      ...(design ? { design } : {}),
      ...(v.review ? { review: cleanBasketReview(v.review) } : {}),
    };
  });
}
export function serializeBasketProject(items: BasketBrief[]) {
  return JSON.stringify(
    { kind: "steel-basket-specification", version: 2, notice: PRODUCT_CALCULATION_NOTICE, dimensionDisclaimer: basketAcDimensionDisclaimer, items: clean(items) },
    null,
    2,
  );
}
export function parseBasketProject(text: string): BasketBrief[] {
  if (new TextEncoder().encode(text).length > MAX_BASKET_PROJECT_BYTES) throw Error("Размер файла превышает 512 КБ.");
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Некорректный файл спецификации.");
  const p = value as Record<string, unknown>;
  if (p.kind !== "steel-basket-specification" || (p.version !== 1 && p.version !== 2))
    throw Error("Этот формат спецификации не поддерживается.");
  if (p.version === 1 && new TextEncoder().encode(text).length > 200000) throw Error("Размер файла версии 1 превышает 200 КБ.");
  return clean(p.items);
}
