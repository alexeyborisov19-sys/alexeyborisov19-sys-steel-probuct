import { PRODUCT_CALCULATION_NOTICE } from '../product-calculation-notice';
import { TRIM_GEOMETRY_SCOPE, getTrimTemplate, trimSourceUrl } from '../../data/trim-bim-catalog';
import { TRIM_MAX_PROJECT_BYTES, validateTrimProject, type TrimProject } from './trim-model';
import { createTrimGeometry } from './trim-geometry';
export function parseTrimProject(text:string):TrimProject {
  if(new TextEncoder().encode(text).length>TRIM_MAX_PROJECT_BYTES) throw new Error('Файл проекта превышает технический предел 16 КБ.');
  let data:unknown;
  try { data=JSON.parse(text); } catch { throw new Error('Не удалось прочитать JSON проекта.'); }
  if(!data||typeof data!=='object'||Array.isArray(data)) throw new Error('Нужен файл проекта доборных элементов.');
  const record=data as Record<string,unknown>;
  if(Object.keys(record).some(k=>!['project','units','notice','geometryScope','source'].includes(k))||record.units!=='mm'||record.notice!==PRODUCT_CALCULATION_NOTICE||record.geometryScope!==TRIM_GEOMETRY_SCOPE) throw new Error('Нужен проект в миллиметрах с исходным описанием ограничений.');
  validateTrimProject(record.project);
  const source=record.source;
  if(!source || typeof source!=='object' || Array.isArray(source) || Object.keys(source).length!==2 || (source as Record<string,unknown>).image!==trimSourceUrl(record.project.templateId) || (source as Record<string,unknown>).section!==getTrimTemplate(record.project.templateId).sourceSection) throw new Error('Источник формы не совпадает с каталогом шаблона.');
  createTrimGeometry(record.project);
  return {...record.project,dimensionsMm:{...record.project.dimensionsMm}};
}
export function serializeTrimProject(project:TrimProject):string {
  validateTrimProject(project); createTrimGeometry(project);
  const text=JSON.stringify({project,units:'mm',source:{image:trimSourceUrl(project.templateId),section:getTrimTemplate(project.templateId).sourceSection},notice:PRODUCT_CALCULATION_NOTICE,geometryScope:TRIM_GEOMETRY_SCOPE},null,2);
  parseTrimProject(text);
  return text;
}
