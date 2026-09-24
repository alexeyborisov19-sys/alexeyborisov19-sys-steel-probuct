import 'server-only';
import type {FactualRateBook} from '@/lib/instant-quote/factual-calculation';

/** Owner-authorized public estimate. Never mix materials or thicknesses, and
 * never mutate the confidential shop book. Average only configured volume tiers.
 * No price/coefficient input from a browser is accepted. */
export function publicEstimateRateBook(book:FactualRateBook):FactualRateBook {
 return {...book,laserRubPerM:book.laserRubPerM.map(row=>{
  const tiers=[row.rateRub,row.from100mRubPerM,row.from500mRubPerM].filter((n):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>0);
  if(!tiers.length)throw Error('Invalid private laser rates');
  const mean=Math.round((tiers.reduce((sum,n)=>sum+n,0)/tiers.length)*100)/100;
  if(!Number.isFinite(mean)||mean<=0)throw Error('Invalid private average laser rate');
  return {...row,rateRub:mean,from100mRubPerM:undefined,from500mRubPerM:undefined,source:{...row.source,note:row.source.note+'; public estimate: arithmetic mean of configured volume tiers'}};
 })};
}
