import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultBasketDesign, panelCutting, basketDesignSummary} from '../lib/quote/basket-design';
import {basketConfiguredPrice} from '../lib/quote/basket-volume-price';
test('price applies only to owner-confirmed ten-slot basket on existing supports',()=>{
 const d=defaultBasketDesign();const design={...d,mount:'existing' as const,front:{...d.front,pattern:'wide-slots' as const},side:{...d.side,pattern:'wide-slots' as const}};
 const input={width:900,height:600,depth:550,quantity:100,design};
 assert.deepEqual(basketConfiguredPrice(input),{unit:5600,total:560000});
 for(const mount of ['unknown','bearing'] as const) assert.equal(basketConfiguredPrice({...input,design:{...design,mount}}),null);
 for(const pattern of ['round','slots','solid','lamella','custom'] as const) assert.equal(basketConfiguredPrice({...input,design:{...design,front:{...design.front,pattern}}}),null);
 assert.equal(basketConfiguredPrice({...input,width:1000}),null);
 assert.equal(basketConfiguredPrice({...input,quantity:NaN}),null);
 assert.equal(basketConfiguredPrice({...input,design:{...design,front:{...design.front,diameter:NaN}}}),null);
 assert.equal(panelCutting(900,600,design.front).known,false);
 assert.match(basketDesignSummary(design),/10 длинных продолговатых прорезей/);
});
