import { CadReadError } from './cad-model';
import type { PartGeometrySummary } from './domain';

type Blank = { lengthMm: number; widthMm: number; holes: boolean };
export type ManualHoleGroup = { count: number; diameterMm: number };
/** V1 remains readable for already saved projects. New positions use V2 groups. */
export type ManualSheetInput = Blank & ({ holeCount: number; holeDiameterMm: number } | { holeGroups: ManualHoleGroup[] });
const prefix = 'STEEL_PRODUCT_MANUAL_BLANK_';
const markerV1 = prefix + 'V1:';
const markerV2 = prefix + 'V2:';
export const MANUAL_HOLE_NOTE = 'Для предварительного расчёта каждое отверстие условно принимается круглым. Указанный диаметр используется для оценки площади выреза и длины лазерной резки; фактическая форма уточняется по чертежу.';
export const MANUAL_SHEET_WARNING = 'Расчёт по вручную заданным максимальным габаритам прямоугольной заготовки. Фактический контур, развёртка после гибки и расположение отверстий не подтверждены. Перемычки и зоны гиба должен проверить технолог. Предпросмотр показывает только габаритный прямоугольник, а не чертёж для производства.';
export function manualHoleGroups(input: ManualSheetInput): ManualHoleGroup[] {
  return 'holeGroups' in input ? input.holeGroups : input.holes ? [{count:input.holeCount,diameterMm:input.holeDiameterMm}] : [];
}
export function manualHoleCount(input: ManualSheetInput): number {
  return manualHoleGroups(input).reduce((total, group) => total + group.count, 0);
}
export function validateManualSheet(value: unknown): ManualSheetInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CadReadError('Некорректные параметры ручной заготовки.');
  const v = value as Record<string, unknown>;
  const grouped = Object.hasOwn(v,'holeGroups');
  const keys = ['lengthMm','widthMm','holes',...(grouped?['holeGroups']:['holeCount','holeDiameterMm'])];
  if (Object.keys(v).some(k=>!keys.includes(k)) || keys.some(k=>!Object.hasOwn(v,k)) || typeof v.holes !== 'boolean') throw new CadReadError('Неизвестные параметры ручной заготовки.');
  const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
  if (!positive(v.lengthMm) || !positive(v.widthMm)) throw new CadReadError('Длина и ширина заготовки должны быть положительными числами в миллиметрах.');
  let groups:ManualHoleGroup[];
  if(grouped){
    if(!Array.isArray(v.holeGroups)||v.holeGroups.length>5 || (v.holes?v.holeGroups.length===0:v.holeGroups.length!==0))throw new CadReadError('Включите отверстия и задайте от 1 до 5 типов, либо отключите их с пустым списком.');
    groups=v.holeGroups.map(group=>{
      if(!group||typeof group!=='object'||Array.isArray(group)||Object.keys(group).some(k=>!['count','diameterMm'].includes(k)))throw new CadReadError('Некорректный тип отверстия.');
      return {count:group.count,diameterMm:group.diameterMm};
    });
  }else{
    if(!v.holes&&(v.holeCount!==0||v.holeDiameterMm!==0))throw new CadReadError('При отключённых отверстиях их количество и диаметр должны равняться нулю.');
    groups=v.holes?[{count:v.holeCount as number,diameterMm:v.holeDiameterMm as number}]:[];
  }
  if(groups.some(g=>!Number.isSafeInteger(g.count)||g.count<1||!positive(g.diameterMm))||!Number.isSafeInteger(groups.reduce((n,g)=>n+g.count,1)))throw new CadReadError('Задайте положительные диаметры и целые количества отверстий в допустимом числовом диапазоне.');
  const input:ManualSheetInput=grouped?{lengthMm:v.lengthMm,widthMm:v.widthMm,holes:v.holes,holeGroups:groups}:{lengthMm:v.lengthMm,widthMm:v.widthMm,holes:v.holes,holeCount:v.holeCount as number,holeDiameterMm:v.holeDiameterMm as number};
  const g=manualSheetGeometry(input);
  if(![g.areaMm2!,g.blankAreaMm2!,g.cutLengthMm!].every(n=>Number.isFinite(n)&&n>0)||groups.some(g=>g.diameterMm>=Math.min(input.lengthMm,input.widthMm)))throw new CadReadError('Отверстия не помещаются в указанные габариты или их суммарная площадь не меньше площади заготовки.');
  return input;
}
export function manualSheetGeometry(input: ManualSheetInput): PartGeometrySummary {
  const groups=manualHoleGroups(input),area=input.lengthMm*input.widthMm;
  const count=manualHoleCount(input);
  const removedArea=groups.reduce((n,g)=>n+g.count*Math.PI*(g.diameterMm/2)**2,0);
  const holeLength=groups.reduce((n,g)=>n+g.count*Math.PI*g.diameterMm,0);
  return {widthMm:input.lengthMm,heightMm:input.widthMm,blankAreaMm2:area,areaMm2:area-removedArea,cutLengthMm:2*(input.lengthMm+input.widthMm)+holeLength,contourCount:1+count,pierceCount:1+count,holeCount:count};
}
function serialize(input: ManualSheetInput) {
  const marker='holeGroups' in input?markerV2:markerV1;
  return ['999',marker+JSON.stringify(input),'0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES','0','LWPOLYLINE','90','4','70','1','10','0','20','0','10',String(input.lengthMm),'20','0','10',String(input.lengthMm),'20',String(input.widthMm),'10','0','20',String(input.widthMm),'0','ENDSEC','0','EOF',''].join('\n');
}
export function createManualSheetDxf(input: ManualSheetInput) {return serialize(validateManualSheet(input));}
/** Strict canonical declaration prevents hidden/changed geometry being priced as a blank. */
export function readManualSheetDxf(text: string): ManualSheetInput | null {
  if(!text.includes(prefix))return null;
  const normalized=text.replace(/\r\n?/g,'\n'),lines=normalized.split('\n');
  const marker=lines[1]?.startsWith(markerV1)?markerV1:lines[1]?.startsWith(markerV2)?markerV2:null;
  if(lines[0]!=='999'||!marker||lines[1].length>16000)throw new CadReadError('Повреждена декларация ручной заготовки.');
  let value:unknown;
  try{value=JSON.parse(lines[1].slice(marker.length));}catch{throw new CadReadError('Повреждены параметры ручной заготовки.');}
  const input=validateManualSheet(value);
  if(normalized!==serialize(input))throw new CadReadError('Геометрия ручной заготовки изменена вне калькулятора. Создайте позицию заново или загрузите исходный CAD без ручной декларации.');
  return input;
}
