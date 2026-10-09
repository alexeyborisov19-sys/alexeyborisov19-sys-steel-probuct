import { getTrimTemplate, type TrimTemplateId } from '../../data/trim-bim-catalog';
export type TrimProject = {
  kind:'steelprodukt-trim-bim'; schemaVersion:1; id:string; revision:number; elementId:string;
  templateId:TrimTemplateId; dimensionsMm:{A:number;B:number;H:number;T:number};
  mark:string; material:string; finish:string;
};
/** Processing budgets, not manufacturing limits. */
export const TRIM_MAX_DIMENSION_MM = 100_000;
/** Input-coordinate grid for this preliminary model, not a factory tolerance. */
export const TRIM_COORDINATE_STEP_MM = 0.01;
export const TRIM_MAX_PROJECT_BYTES = 16_384;
export const TRIM_PROJECT_KEYS = ['kind','schemaVersion','id','revision','elementId','templateId','dimensionsMm','mark','material','finish'] as const;
export function validateTrimProject(value:unknown):asserts value is TrimProject {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Нужен объект проекта.');
  const p=value as Record<string,unknown>;
  if(Object.keys(p).some(key=>!(TRIM_PROJECT_KEYS as readonly string[]).includes(key))||TRIM_PROJECT_KEYS.some(key=>!Object.hasOwn(p,key)))throw new Error('Проект содержит неизвестные поля или неполные параметры.');
  if(p.kind!=='steelprodukt-trim-bim'||p.schemaVersion!==1)throw new Error('Нужен проект доборных элементов версии 1.');
  for(const key of ['id','elementId'])if(typeof p[key]!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(p[key] as string))throw new Error('Некорректный идентификатор проекта или элемента.');
  if(typeof p.revision!=='number'||!Number.isSafeInteger(p.revision)||p.revision<1||p.revision>1_000_000)throw new Error('Некорректная версия проекта.');
  if(typeof p.templateId!=='string')throw new Error('Выберите шаблон.');
  getTrimTemplate(p.templateId);
  if(p.templateId!=='fire-stop')throw new Error('Этот шаблон пока недоступен: размерные базы и геометрия требуют подтверждения.');
  for(const key of ['mark','material','finish'])if(typeof p[key]!=='string'||(p[key] as string).length>120||/[\u0000-\u001f\u007f]/.test(p[key] as string))throw new Error('Текстовые поля: до 120 символов без управляющих знаков.');
  const dimensions=p.dimensionsMm;
  if(!dimensions||typeof dimensions!=='object'||Array.isArray(dimensions)||Object.keys(dimensions).length!==4||Object.keys(dimensions).some(key=>!['A','B','H','T'].includes(key)))throw new Error('Укажите размеры A, B, H, T по чертежу.');
  const d=dimensions as Record<string,unknown>;
  for(const key of ['A','B','H','T'])if(typeof d[key]!=='number'||!Number.isFinite(d[key])||(d[key] as number)<=0||(d[key] as number)>TRIM_MAX_DIMENSION_MM)throw new Error('Введите положительные A, B, H, T в мм. Технический предел обработки — 100 000 мм, это не производственный допуск.');
  for(const key of ['A','B','H','T']) {
    const value=d[key] as number, units=value/TRIM_COORDINATE_STEP_MM;
    if(value<TRIM_COORDINATE_STEP_MM || Math.abs(units-Math.round(units))>4*Number.EPSILON*Math.max(1,Math.abs(units))) throw new Error('Введите размеры с шагом 0,01 мм. Это разрешение предварительной модели, не допуск изготовления; более мелкие значения не округляются автоматически.');
  }
  if(Math.round((d.T as number)/TRIM_COORDINATE_STEP_MM)>=Math.round((d.A as number)/TRIM_COORDINATE_STEP_MM)||Math.round((d.T as number)/TRIM_COORDINATE_STEP_MM)>=Math.round((d.B as number)/TRIM_COORDINATE_STEP_MM))throw new Error('Толщина T должна быть меньше A и B, иначе Г-профиль вырождается.');
}
/** Text-entry parser preserves imported scientific notation; blanks never coerce to zero. */
export function parseTrimDimensionDraft(text:string):number {
  return /^\s*(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?\s*$/.test(text)?Number(text.trim().replace(',','.')):NaN;
}
