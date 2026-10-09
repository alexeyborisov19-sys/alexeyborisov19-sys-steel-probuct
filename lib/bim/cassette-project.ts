import { validateCassetteBim, type CassetteBimInput } from './cassette';
export const BIM_PROJECT_MAX_BYTES = 300_000;
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parseCassetteBimProject(text: string): CassetteBimInput {
  if (new TextEncoder().encode(text).length > BIM_PROJECT_MAX_BYTES) throw new Error('Файл проекта превышает 300 КБ.');
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('Не удалось прочитать JSON проекта.'); }
  if (!isRecord(data) || data.kind !== 'steelprodukt-cassette-bim' || data.schemaVersion !== 1 || !isRecord(data.input)) throw new Error('Нужен BIM-проект Сталь Продукт версии 1.');
  const p = data.input;
  for (const key of ['widthMm','heightMm','depthMm','thicknessMm','jointMm','columns','rows']) if (typeof p[key] !== 'number' || !Number.isFinite(p[key])) throw new Error('Проверьте числовые параметры модели.');
  if (typeof p.mark !== 'string' || typeof p.finish !== 'string' || typeof p.projectId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(p.projectId)) throw new Error('Не указаны марка, покрытие или идентификатор проекта.');
  if (p.profile !== undefined && !['open','closed','corner'].includes(String(p.profile))) throw new Error('Неизвестный профиль кассеты.');
  if (p.returnWidthMm !== undefined && (typeof p.returnWidthMm !== 'number' || !Number.isFinite(p.returnWidthMm))) throw new Error('Проверьте второе крыло.');
  const colours: NonNullable<CassetteBimInput['panelColours']> = {};
  if (p.panelColours !== undefined) {
    if (!isRecord(p.panelColours) || Object.keys(p.panelColours).length > 400) throw new Error('Некорректная ведомость цветов.');
    for (const [key, value] of Object.entries(p.panelColours)) {
      if (!/^(0|[1-9]\d?):(0|[1-9]\d?)$/.test(key) || !isRecord(value) || typeof value.ral !== 'string' || typeof value.hex !== 'string') throw new Error('Некорректный цвет панели.');
      const [row,col] = key.split(':').map(Number);
      if (row >= (p.rows as number) || col >= (p.columns as number)) throw new Error('Цвет ссылается на панель вне раскладки.');
      colours[key] = { ral:value.ral, hex:value.hex };
    }
  }
  // Explicit allowlist: never carry arbitrary imported properties into live state or exports.
  const input: CassetteBimInput = {
    widthMm:p.widthMm as number,heightMm:p.heightMm as number,depthMm:p.depthMm as number,thicknessMm:p.thicknessMm as number,
    jointMm:p.jointMm as number,columns:p.columns as number,rows:p.rows as number,mark:p.mark,finish:p.finish,projectId:p.projectId,
    ...(p.profile !== undefined ? {profile:p.profile as CassetteBimInput['profile']} : {}),
    ...(p.returnWidthMm !== undefined ? {returnWidthMm:p.returnWidthMm as number} : {}),
    ...(p.panelColours !== undefined ? {panelColours:colours} : {}),
  };
  const errors = validateCassetteBim(input);
  if (errors.length) throw new Error(errors.join(' '));
  return input;
}
export function serializeCassetteBimProject(input: CassetteBimInput): string {
  const data = JSON.stringify({schemaVersion:1,kind:'steelprodukt-cassette-bim',input}, null, 2);
  parseCassetteBimProject(data);
  return data;
}
