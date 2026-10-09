import { getTrimTemplate, trimSourceUrl, TRIM_GEOMETRY_SCOPE } from '../../data/trim-bim-catalog';
import { PRODUCT_CALCULATION_NOTICE } from '../product-calculation-notice';
import { stableIfcGuid, ifcString } from './ifc-identity';
import { createTrimGeometry } from './trim-geometry';
import type { TrimProject } from './trim-model';
// Preserve IEEE-754 roundtrip precision: fixed-decimal rounding could collapse small valid solids.
const number = (value:number) => { const [mantissa,exponent]=String(value).split(/[eE]/); return `${mantissa.includes('.')?mantissa:mantissa+'.'}${exponent===undefined?'':'E'+exponent}`; };
const csvCell = (value:unknown) => { const text=String(value); return '"'+(/^[\s]*[=+@-]/.test(text)?"'"+text:text).replaceAll('"','""')+'"'; };
export function createTrimCsv(project:TrimProject):string {
  createTrimGeometry(project);
  const template=getTrimTemplate(project.templateId);
  const headers=['ProjectId','Revision','ElementId','Mark','Template','Quantity','A_mm','B_mm','H_mm','T_mm','C_deg','Material_user_input','Finish_user_input','SourceImage','SourceSection','GeometryScope','Notice'];
  const values=[project.id,project.revision,project.elementId,project.mark.trim()||'Элемент 1',template.title,1,project.dimensionsMm.A,project.dimensionsMm.B,project.dimensionsMm.H,project.dimensionsMm.T,90,project.material||'Не задано',project.finish||'Не задано',trimSourceUrl(project.templateId),template.sourceSection,TRIM_GEOMETRY_SCOPE,PRODUCT_CALCULATION_NOTICE];
  return '\uFEFF'+[headers,values].map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n';
}
export function createTrimBrief(project:TrimProject):string {
  createTrimGeometry(project);
  const template=getTrimTemplate(project.templateId);
  return [PRODUCT_CALCULATION_NOTICE,'','Задание специалисту: доборный элемент',`Проект: ${project.id}; версия: ${project.revision}; элемент: ${project.elementId}`,`Шаблон: ${template.title}`,`Марка: ${project.mark.trim()||'Элемент 1'}`,`Количество в модели: 1`,...Object.entries(project.dimensionsMm).map(([key,value])=>`${key}: ${value} мм`),'Угол C: 90° по схеме каталога',`Материал со слов пользователя: ${project.material||'не задан'}`,`Покрытие со слов пользователя: ${project.finish||'не задано'}`,'',`Источник формы: публичный каталог, лист ${template.sourcePage}; ${template.sourceSection}`,`Изображение: ${trimSourceUrl(project.templateId)}`,TRIM_GEOMETRY_SCOPE,template.scope,'','Требует согласования: наружные размеры, радиусы, развёртка, материал, покрытие, количество в заказе, стыки и условия применения. Файл создан локально; заявка не отправлена.'].join('\n');
}
/** IFC4 tessellation uses exactly the closed triangles shown in the preview; all length coordinates are mm. */
export function createTrimIfc(project:TrimProject):string {
  const geometry=createTrimGeometry(project), template=getTrimTemplate(project.templateId), lines:string[]=[];
  const add=(value:string) => {const id=`#${lines.length+1}`; lines.push(`${id}=${value};`); return id;};
  const id=(key:string)=>ifcString(stableIfcGuid(`${project.id}/${key}`));
  const origin=add('IFCCARTESIANPOINT((0.,0.,0.))'), axis=add(`IFCAXIS2PLACEMENT3D(${origin},$,$)`), placement=add(`IFCLOCALPLACEMENT($,${axis})`);
  const context=add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,0.00001,${axis},$)`);
  const lengthUnit=add('IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)'), units=add(`IFCUNITASSIGNMENT((${lengthUnit}))`);
  const scope=PRODUCT_CALCULATION_NOTICE+'. '+TRIM_GEOMETRY_SCOPE;
  const root=add(`IFCPROJECT(${id('project')},$,${ifcString('Доборный элемент — модель формы')},${ifcString(scope)},$,$,$,(${context}),${units})`);
  const building=add(`IFCBUILDING(${id('building')},$,${ifcString('Изолированный элемент')},$,$,${placement},$,$,.ELEMENT.,$,$,$)`);
  const storey=add(`IFCBUILDINGSTOREY(${id('storey')},$,${ifcString('Координационная модель')},$,$,${placement},$,$,.ELEMENT.,0.)`);
  add(`IFCRELAGGREGATES(${id('project-building')},$,$,$,${root},(${building}))`);
  add(`IFCRELAGGREGATES(${id('building-storey')},$,$,$,${building},(${storey}))`);
  const points=add(`IFCCARTESIANPOINTLIST3D((${geometry.vertices.map(v=>`(${v.map(number).join(',')})`).join(',')}))`);
  const faces=add(`IFCTRIANGULATEDFACESET(${points},$,.T.,(${geometry.triangles.map(t=>`(${t.map(i=>i+1).join(',')})`).join(',')}),$)`);
  const representation=add(`IFCSHAPEREPRESENTATION(${context},'Body','Tessellation',(${faces}))`), shape=add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${representation}))`);
  const element=add(`IFCBUILDINGELEMENTPROXY(${id(`element/${project.elementId}`)},$,${ifcString(project.mark.trim()||'Элемент 1')},${ifcString(scope)},${ifcString('Folded trim shape only')},${placement},${shape},${ifcString(project.elementId)},.USERDEFINED.)`);
  add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${id('containment')},$,$,$,(${element}),${storey})`);
  const props:string[]=[];
  const text=(name:string,value:string)=>props.push(add(`IFCPROPERTYSINGLEVALUE(${ifcString(name)},$,IFCTEXT(${ifcString(value)}),$)`));
  const length=(name:string,value:number)=>props.push(add(`IFCPROPERTYSINGLEVALUE(${ifcString(name)},$,IFCLENGTHMEASURE(${number(value)}),$)`));
  text('Template',template.title);text('ProjectId',project.id);text('ProjectRevision',String(project.revision));text('ElementId',project.elementId);
  text('Notice',PRODUCT_CALCULATION_NOTICE);text('GeometryScope',TRIM_GEOMETRY_SCOPE);text('TemplateScope',template.scope);
  text('SourceImage',trimSourceUrl(project.templateId));text('SourceSection',template.sourceSection);text('MaterialUserInput',project.material||'Не задано');text('FinishUserInput',project.finish||'Не задано');
  Object.entries(project.dimensionsMm).forEach(([key,value])=>length(key,value));
  text('C','90 deg; catalogue section angle');
  const pset=add(`IFCPROPERTYSET(${id(`properties/${project.elementId}`)},$,'SP_TrimShape',$,(${props.join(',')}))`);
  add(`IFCRELDEFINESBYPROPERTIES(${id('properties-relation')},$,$,$,(${element}),${pset})`);
  return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((${ifcString(scope)}),'2;1');\nFILE_NAME('steelprodukt-trim.ifc','2026-10-09T00:00:00',('Steel Produkt'),('Steel Produkt'),'Steel Produkt trim BIM','Steel Produkt','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`;
}
