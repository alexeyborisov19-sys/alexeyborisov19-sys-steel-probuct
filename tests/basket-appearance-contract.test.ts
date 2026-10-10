import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultBasketDesign, validBasketDesign, basketDesignSummary } from '../lib/quote/basket-design';
import { serializeBasketProject, parseBasketProject } from '../lib/quote/basket-project';
import { basketConfiguredPrice } from '../lib/quote/basket-volume-price';

test('new basket appearance preserves selection through project export and specialist text',()=>{
 const design={...defaultBasketDesign(),appearance:'shift' as const};
 const item={width:900,height:600,depth:550,quantity:11,ral:'7024',screen:'round',design};
 const restored=parseBasketProject(serializeBasketProject([item]));
 assert.equal(restored[0].design?.appearance,'shift');
 assert.match(basketDesignSummary(design),/Сдвиг/);
 assert.equal(validBasketDesign({...design,appearance:'unknown-pattern'}),false);
});
test('new concept cannot inherit old ten-slot anchor or calibrated panel-only quote',()=>{
 const d=defaultBasketDesign();const design={...d,appearance:'regular' as const,front:{...d.front,pattern:'wide-slots' as const},side:{...d.side,pattern:'wide-slots' as const}};
 const input={width:900,height:600,depth:550,quantity:1,design};
 assert.equal(basketConfiguredPrice(input),null);
 assert.equal(basketConfiguredPrice(input,{metalRubPerKg:100,laserRubPerM:10,pierceRubEach:2,powderRubPerM2:20,preparationRubPerM2:10}),null);
});
