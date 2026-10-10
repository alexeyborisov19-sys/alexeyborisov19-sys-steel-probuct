import type { BasketBrief } from './basket-brief';
/** Preserve identities on edits/reorder; copied/imported duplicate rows stay separate. */
export function normalizeBasketPositionIds(items:BasketBrief[],newId:()=>string=()=>crypto.randomUUID()):BasketBrief[]{
 const used=new Set<string>();
 return items.map(item=>{
  let id=item.positionId;
  if(!id||used.has(id)){id=newId();if(!/^[a-zA-Z0-9_-]{1,128}$/.test(id)||used.has(id))throw Error('Не удалось создать уникальную позицию.');}
  used.add(id);return item.positionId===id?item:{...item,positionId:id};
 });
}
