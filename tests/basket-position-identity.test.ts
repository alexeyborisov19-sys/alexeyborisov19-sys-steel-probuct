import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBasketPositionIds } from '../lib/quote/basket-position-identity';
import { parseBasketProject, serializeBasketProject } from '../lib/quote/basket-project';
const row={width:900,height:600,depth:550,quantity:1,ral:'7024',screen:'round'};
test('stable row identity survives edit/reorder/export; copies and repeatedimports are distinct',()=>{
 let n=0;const id=()=>`row-${++n}`;
 const items=normalizeBasketPositionIds([row,row],id);
 assert.notEqual(items[0].positionId,items[1].positionId);
 const changed={...items[0],quantity:11};
 const reordered=normalizeBasketPositionIds([items[1],changed],id);
 assert.equal(reordered[1].positionId,items[0].positionId);
 const imported=parseBasketProject(serializeBasketProject(reordered));
 assert.deepEqual(imported.map(x=>x.positionId),reordered.map(x=>x.positionId));
 const copied=normalizeBasketPositionIds([...imported,structuredClone(imported[0])],id);
 assert.notEqual(copied[2].positionId,copied[0].positionId);
});
