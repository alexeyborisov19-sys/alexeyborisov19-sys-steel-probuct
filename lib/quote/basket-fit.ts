/** Measured installation plus manufacturer-specified clearance; no invented universal allowance. */
export const fitLabels = {
  width: "Ширина всей установки, мм",
  height: "Высота всей установки, мм",
  depth: "Глубина всей установки, мм",
  left: "Зазор слева, мм",
  right: "Зазор справа, мм",
  top: "Зазор сверху, мм",
  bottom: "Зазор снизу, мм",
  front: "Зазор спереди, мм",
  rear: "Зазор сзади, мм",
} as const;
export type BasketFit = Record<keyof typeof fitLabels, number | null>;
export const emptyBasketFit = (): BasketFit => ({
  width: null,
  height: null,
  depth: null,
  left: null,
  right: null,
  top: null,
  bottom: null,
  front: null,
  rear: null,
});
/** Preserve entered data when changing input mode, but clear invalid drafts. */
export function normalizedBasketFit(fit?: BasketFit): BasketFit | undefined {
  if (!fit) return undefined;
  return Object.fromEntries((Object.keys(fitLabels) as (keyof BasketFit)[]).map(k => {
    const value = fit[k];
    const min = ["width", "height", "depth"].includes(k) ? 1 : 0;
    return [k, typeof value === "number" && Number.isFinite(value) && value >= min && value <= 10000 ? value : null];
  })) as BasketFit;
}
export function validBasketFit(value: unknown): value is BasketFit {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const x = value as BasketFit;
  return (Object.keys(fitLabels) as (keyof BasketFit)[]).every(
    (k) =>
      x[k] === null ||
      (typeof x[k] === "number" &&
        Number.isFinite(x[k]) &&
        x[k]! >= (["width", "height", "depth"].includes(k) ? 1 : 0) &&
        x[k]! <= 10000),
  );
}
export function requiredBasketSpace(fit?: BasketFit) {
  if (
    !fit ||
    !validBasketFit(fit) ||
    Object.keys(fitLabels).some((k) => fit[k as keyof BasketFit] === null)
  )
    return null;
  return {
    width: fit.width! + fit.left! + fit.right!,
    height: fit.height! + fit.top! + fit.bottom!,
    depth: fit.depth! + fit.front! + fit.rear!,
  };
}
/** Quoting envelope, not fabricated outside dimensions or an airflow standard. */
export function calculatedBasketSize(fit?: BasketFit) {
  const required = requiredBasketSpace(fit);
  if (!required || Object.values(required).some(n => n <= 0 || n > 10000)) return null;
  return {
    width: Math.ceil(required.width),
    height: Math.ceil(required.height),
    depth: Math.ceil(required.depth),
  };
}
export function basketFitSummary(fit?: BasketFit) {
  if (!fit)
    return "Размер всей установки и монтажные зазоры: необходимо уточнить.";
  const space = requiredBasketSpace(fit);
  return (
    (Object.keys(fitLabels) as (keyof BasketFit)[])
      .map((k) => `${fitLabels[k]}: ${fit[k] ?? "неизвестно"}`)
      .join("; ") +
    (space
      ? `\nТребуемый свободный объём (Ш × В × Г): ${space.width} × ${space.height} × ${space.depth} мм. Проверить по внутреннему чертежу корзины; это не подтверждение вентиляции или несущей способности.`
      : "\nСвободный объём не рассчитан: заполните размеры установки и все зазоры.")
  );
}
