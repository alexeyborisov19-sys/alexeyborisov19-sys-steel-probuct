import type { FactualRateBook, LaserFactualRate } from './factual-calculation';
import type { MaterialId } from './pricing';

/** Owner requested a preliminary 0.7 mm rate from neighbouring values on
 * 2026-09-22. This is bounded extrapolation, never an approved shop tariff.
 * An exact rate always wins; neither source rates nor material prices change. */
export function estimateThinLaserRate(book: FactualRateBook, material: MaterialId, thickness: number): LaserFactualRate | null {
  if (Math.abs(thickness - 0.7) > 1e-9 || !['hot', 'cold', 'zinc'].includes(material)) return null;
  const find = (t: number) => book.laserRubPerM.filter(row => row.materialId === material && Math.abs(row.thicknessMm-t)<1e-9);
  if (find(thickness).length) return null;
  const low=find(0.8), high=find(1);
  if(low.length!==1 || high.length!==1) return null;
  const a=low[0], b=high[0];
  const derive=(x: number | undefined,y: number | undefined) => {
    if(x===undefined || y===undefined || !Number.isFinite(x) || !Number.isFinite(y) || x<=0 || y<=0) return undefined;
    const value=Math.round((x+(y-x)*(-0.5))*100)/100;
    return value>0 && Number.isFinite(value) ? value : undefined;
  };
  const rateRub=derive(a.rateRub,b.rateRub), pierceRubEach=derive(a.pierceRubEach,b.pierceRubEach);
  if(rateRub===undefined || pierceRubEach===undefined) return null;
  const from100mRubPerM=derive(a.from100mRubPerM,b.from100mRubPerM), from500mRubPerM=derive(a.from500mRubPerM,b.from500mRubPerM);
  if((a.from100mRubPerM!==undefined || b.from100mRubPerM!==undefined) && from100mRubPerM===undefined) return null;
  if((a.from500mRubPerM!==undefined || b.from500mRubPerM!==undefined) && from500mRubPerM===undefined) return null;
  if((from100mRubPerM ?? rateRub)>rateRub || (from500mRubPerM ?? from100mRubPerM ?? rateRub)>(from100mRubPerM ?? rateRub)) return null;
  return {materialId:material,thicknessMm:thickness,rateRub,pierceRubEach,from100mRubPerM,from500mRubPerM,
    source:{id:'estimated-laser-07-v1',label:'Расчётная ставка 0,7 мм — требует подтверждения',confirmedAt:'2026-09-22T00:00:00.000Z',note:`Предварительная линейная экстраполяция по ставкам 0,8 и 1,0 мм (${a.source.id}; ${b.source.id}). Дата означает разрешение метода владельцем, а не утверждение тарифа.`}};
}
