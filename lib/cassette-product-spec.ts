import { PRODUCT_CALCULATION_NOTICE } from './product-calculation-notice';

export type CassetteProductRow = { id: string; width: string; height: string; quantity: string };
export type CassetteProductDraft = { type: 'open' | 'closed'; rows: CassetteProductRow[]; material: string; thickness: string; finish: string };
export const CASSETTE_SPEC_MAX_ROWS = 100;
export const CASSETTE_SPEC_SCOPE = 'Предварительная спецификация по вашим размерам. Цена рассчитывается специалистом после проверки чертежей, материала и покрытия. Площадь лиц не является площадью заготовок или окраски.';
function number(value: string) {
  const text = value.trim().replace(',', '.');
  return /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : NaN;
}
export function cassetteProductSummary(draft: CassetteProductDraft) {
  if (!draft.rows.length || draft.rows.length > CASSETTE_SPEC_MAX_ROWS) throw new Error('Добавьте от 1 до 100 типоразмеров. Это технический предел списка, не ограничение производства.');
  const rows = draft.rows.map((row, index) => {
    const widthMm = number(row.width), heightMm = number(row.height), quantity = number(row.quantity);
    if (![widthMm, heightMm, quantity].every(value => Number.isFinite(value) && value > 0) || !Number.isSafeInteger(quantity)) throw new Error(`Позиция ${index + 1}: укажите положительные размеры и целое количество.`);
    const faceAreaM2 = widthMm * heightMm * quantity / 1e6;
    if (!Number.isFinite(faceAreaM2) || faceAreaM2 <= 0) throw new Error(`Позиция ${index + 1}: проверьте размеры.`);
    return { widthMm, heightMm, quantity, faceAreaM2 };
  });
  const quantity = rows.reduce((sum, row) => sum + row.quantity, 0), faceAreaM2 = rows.reduce((sum, row) => sum + row.faceAreaM2, 0);
  if (!Number.isSafeInteger(quantity) || !Number.isFinite(faceAreaM2)) throw new Error('Слишком большие значения для предварительной спецификации.');
  if (draft.thickness.trim() && !(number(draft.thickness) > 0 && Number.isFinite(number(draft.thickness)))) throw new Error('Укажите положительную толщину или оставьте поле пустым для согласования.');
  return { rows, quantity, faceAreaM2 };
}
export function cassetteProductBrief(draft: CassetteProductDraft) {
  const result = cassetteProductSummary(draft);
  return [ 'Предварительная спецификация металлокассет', PRODUCT_CALCULATION_NOTICE, CASSETTE_SPEC_SCOPE,
    `Тип: ${draft.type === 'open' ? 'Открытая' : 'Закрытая'}`,
    `Материал: ${draft.material.trim() || 'Согласовать'}`, `Толщина, мм: ${draft.thickness.trim() || 'Согласовать'}`, `Покрытие / цвет: ${draft.finish.trim() || 'Согласовать'}`,
    ...result.rows.map((row, i) => `${i + 1}. Лицо ${row.widthMm} × ${row.heightMm} мм; ${row.quantity} шт.`),
    `Всего: ${result.quantity} шт.`, `Площадь лиц: ${result.faceAreaM2.toLocaleString('ru-RU', {maximumFractionDigits: 4})} м²`,
    'Цена: требуется расчёт специалиста. Подсистема, крепёж, доборы и монтаж не включены.', 'Заявка не отправлена. Приложите эту спецификацию к обращению.' ].join('\n');
}
