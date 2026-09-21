import type { EngineeringLeadState } from "@/lib/assistant/types";

const FEATURES = [
  { code: "holes-or-cutouts", words: "отверсти[а-яё]*|перфораци[а-яё]*|вырез[а-яё]*|прорез[а-яё]*|паз[а-яё]*" },
  { code: "welding", words: "сварк[а-яё]*|сварочн[а-яё]*" },
  { code: "assembly", words: "сборк[а-яё]*" },
  { code: "threading", words: "резьб[а-яё]*|зенковк[а-яё]*" },
  { code: "coating", words: "покраск[а-яё]*|окраск[а-яё]*|порошков[а-яё]*|анодирован[а-яё]*" },
  { code: "surface-preparation", words: "дробестру[а-яё]*|шлифовк[а-яё]*|зачистк[а-яё]*" },
] as const;

/** These features need the full calculator/engineer; a disclaimer cannot price an omitted operation. */
export function collectRequiredScope(message: string, prior: readonly string[] = []): string[] {
  const result = new Set(prior.filter((code) => FEATURES.some((item) => item.code === code) || code === "nonrectangular-shape"));
  for (const feature of FEATURES) {
    const words = `(?:${feature.words})`;
    const denied = new RegExp(`(?:без|нет|не нужна|не нужно|не требуется)\\s+${words}|${words}\\s+(?:нет|не нужны|не нужна|не нужно|не требуется)`, "giu");
    const positiveText = message.replace(denied, " ");
    if (new RegExp(words, "iu").test(positiveText)) result.add(feature.code);
    else if (new RegExp(denied.source, "iu").test(message)) result.delete(feature.code);
  }
  if (/кругл[а-яё]*|радиус|диаметр|цилиндр[а-яё]*/iu.test(message)) result.add("nonrectangular-shape");
  return [...result];
}

export function manualScopeReasons(state: EngineeringLeadState): string[] {
  const reasons = new Set(state.quoteRequiredScope ?? []);
  if (/корпус|шкаф|кожух|корзин|реш[её]тк/iu.test(state.productType ?? "")) reasons.add("assembled-or-complex-product");
  if (/\d+(?:[.,]\d+)?\s*[×xх*]\s*\d+(?:[.,]\d+)?\s*[×xх*]\s*\d/iu.test(state.dimensions ?? "")) reasons.add("three-dimensional-specification");
  if (/порошк|окраск|покраск/iu.test(state.coating ?? "") && !/без/iu.test(state.coating ?? "")) reasons.add("coating");
  return [...reasons];
}
