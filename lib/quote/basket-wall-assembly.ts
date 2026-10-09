/** Descriptive customer inputs only; no anchor selection or load-bearing approval. */
export const basketStructuralBases = { unknown: 'Неизвестно — нужна проверка', concrete: 'Бетон / железобетон', masonry: 'Кирпич / кладка', metal: 'Металлическая конструкция', other: 'Другое основание' } as const;
export const basketFacadeFinishes = { unknown: 'Неизвестно', bare: 'Без отделки', render: 'Штукатурный фасад', cladding: 'Облицовка / вентфасад', other: 'Другая отделка' } as const;
export type BasketWallAssembly = { version: 1; structuralBase: keyof typeof basketStructuralBases; finish: keyof typeof basketFacadeFinishes; insulation: 'unknown' | 'yes' | 'no'; insulationThicknessMm: number | null };
export const defaultBasketWallAssembly = (): BasketWallAssembly => ({ version: 1, structuralBase: 'unknown', finish: 'unknown', insulation: 'unknown', insulationThicknessMm: null });
export function validBasketWallAssembly(value: unknown): value is BasketWallAssembly {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
 const a=value as BasketWallAssembly;
 return a.version===1 && Object.hasOwn(basketStructuralBases,a.structuralBase) && Object.hasOwn(basketFacadeFinishes,a.finish) && ['unknown','yes','no'].includes(a.insulation) && (a.insulationThicknessMm===null || typeof a.insulationThicknessMm==='number' && Number.isFinite(a.insulationThicknessMm) && a.insulationThicknessMm>=0 && a.insulationThicknessMm<=2000) && (a.insulation!=='no' || a.insulationThicknessMm===null || a.insulationThicknessMm===0);
}
export function cleanBasketWallAssembly(value: BasketWallAssembly): BasketWallAssembly {
 if (!validBasketWallAssembly(value)) throw new Error('Проверьте сведения о стене и утеплении.');
 return { version: 1, structuralBase: value.structuralBase, finish: value.finish, insulation: value.insulation, insulationThicknessMm: value.insulationThicknessMm };
}
export function basketWallAssemblySummary(value?: BasketWallAssembly) {
 const a=value??defaultBasketWallAssembly();
 return `Несущая основа: ${basketStructuralBases[a.structuralBase]}. Отделка: ${basketFacadeFinishes[a.finish]}. Утепление: ${a.insulation==='yes'?'есть':a.insulation==='no'?'нет':'неизвестно'}; толщина: ${a.insulationThicknessMm===null?'неизвестна':a.insulationThicknessMm+' мм'}. Толщина утепления входит в общую глубину фасада, если он есть, и не прибавляется повторно. Материал отделки не подтверждает несущую способность основания; анкеры и кронштейны подбирает инженер.`;
}
