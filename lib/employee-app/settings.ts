import type { MaterialId } from '../instant-quote/pricing';
export const operationRateKeys = ['bendRubEach','weldRubPerM','countersinkRubEach','powderRubPerM2','assemblyRubPerHour','surfacePreparationRubPerM2','packagingRubEach'] as const;
export type OperationRateKey = typeof operationRateKeys[number];
export type BendWeightRate = { maxWeightKg: number; finalRubEach: number | null };
export type CalculationSettings = {
  commercial: { metalMultiplier:number; drawingPercentOfWorks:number; finalPercent:number; roundStepRub:number };
  metalMarketUpliftPct:number;
  operations: Record<OperationRateKey,number|null> & { bendWeightRates?: BendWeightRate[]; laserRubPerM:Array<{materialId:MaterialId;thicknessMm:number;rateRub:number;from100mRubPerM:number|null;from500mRubPerM:number|null;pierceRubEach:number|null}> };
};
export type CalculationSettingsView = {revision:string;updatedAt:string|null;canEdit:boolean;settings:CalculationSettings};
export class CalculationSettingsValidationError extends Error {}
function object(value:unknown, keys:readonly string[]):Record<string,unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CalculationSettingsValidationError('Expected object');
  const result=value as Record<string,unknown>;
  if(Object.keys(result).some(k=>!keys.includes(k)) || keys.some(k=>!Object.hasOwn(result,k))) throw new CalculationSettingsValidationError('Unexpected settings fields');
  return result;
}
function number(value:unknown,min:number,max:number):number {
  if(typeof value !== 'number'||!Number.isFinite(value)||value<min||value>max) throw new CalculationSettingsValidationError('Value out of range');
  return value;
}
function rate(value:unknown) {return value===null?null:number(value,0.000001,10000000);}
export function parseCalculationSettings(value:unknown):CalculationSettings {
  const root=object(value,['commercial','metalMarketUpliftPct','operations']);
  const c=object(root.commercial,['metalMultiplier','drawingPercentOfWorks','finalPercent','roundStepRub']);
  const rawOperations=root.operations as Record<string,unknown> | null;
  const hasWeightRates=Boolean(rawOperations && Object.hasOwn(rawOperations,'bendWeightRates'));
  const operations=object(root.operations,['laserRubPerM',...operationRateKeys,...(hasWeightRates?['bendWeightRates']:[])]);
  let bendWeightRates:BendWeightRate[]|undefined;
  if(hasWeightRates){
    if(!Array.isArray(operations.bendWeightRates)||operations.bendWeightRates.length>50)throw new CalculationSettingsValidationError('Invalid bending weight rows');
    let previous=0;
    bendWeightRates=operations.bendWeightRates.map((value,index)=>{
      const row=object(value,['maxWeightKg','finalRubEach']);
      const maxWeightKg=number(row.maxWeightKg,0.001,1000000);
      if(maxWeightKg<=previous || (row.finalRubEach===null && index!==0))throw new CalculationSettingsValidationError('Weight limits must increase; only first row may use standard rate');
      previous=maxWeightKg;
      return {maxWeightKg,finalRubEach:rate(row.finalRubEach)};
    });
  }
  if(!Array.isArray(operations.laserRubPerM)||operations.laserRubPerM.length>1000) throw new CalculationSettingsValidationError('Invalid laser rows');
  const seen=new Set<string>();
  const laserRubPerM=operations.laserRubPerM.map(value=>{
    const row=object(value,['materialId','thicknessMm','rateRub','from100mRubPerM','from500mRubPerM','pierceRubEach']);
    if(typeof row.materialId!=='string'||!['cold','hot','zinc','inox','alu','copper','brass'].includes(row.materialId)) throw new CalculationSettingsValidationError('Invalid material');
    const thicknessMm=number(row.thicknessMm,0.001,1000),key=`${row.materialId}:${thicknessMm}`;
    if(seen.has(key)) throw new CalculationSettingsValidationError('Duplicate thickness');seen.add(key);
    return {materialId:row.materialId as MaterialId,thicknessMm,rateRub:number(row.rateRub,0.000001,10000000),from100mRubPerM:rate(row.from100mRubPerM),from500mRubPerM:rate(row.from500mRubPerM),pierceRubEach:rate(row.pierceRubEach)};
  });
  return {commercial:{metalMultiplier:number(c.metalMultiplier,0.001,100),drawingPercentOfWorks:number(c.drawingPercentOfWorks,0,1000),finalPercent:number(c.finalPercent,0,1000),roundStepRub:number(c.roundStepRub,0.01,100000)},metalMarketUpliftPct:number(root.metalMarketUpliftPct,0,100),operations:{laserRubPerM,...(bendWeightRates===undefined?{}:{bendWeightRates}),...Object.fromEntries(operationRateKeys.map(k=>[k,rate(operations[k])]))} as CalculationSettings['operations']};
}
