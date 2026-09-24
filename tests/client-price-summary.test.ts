import assert from 'node:assert/strict';
import test from 'node:test';
import {summarizeClientPrices} from '../lib/instant-quote/client-price-summary';
import type {ClientProjectCalculationView,ClientPartCalculationView} from '../lib/instant-quote/client-calculation-view';
const part=(status:ClientPartCalculationView['price']['status'],totalRub?:number):ClientPartCalculationView=>({partId:'p',fileName:'p.dxf',format:'dxf',status:'needs-review',configuration:{materialId:'cold',thicknessMm:1,quantity:1,operations:['laser-cutting']},cad:{widthMm:100,heightMm:60,depthMm:null},price:{status,totalRub},message:''});
test('one unread part does not hide priced positions or count a stale unpublished amount',()=>{
 const result:ClientProjectCalculationView={kind:'client-calculation',projectId:'p',title:'test',paymentEnabled:false,parts:[part('estimate',100),part('approved',250),part('not-published',900)]};
 assert.deepEqual(summarizeClientPrices(result,3),{subtotalRub:350,unpricedParts:1});
 assert.deepEqual(summarizeClientPrices(result,4),{subtotalRub:null,unpricedParts:0});
 result.parts=[part('not-published'),part('estimate',NaN)];
 assert.deepEqual(summarizeClientPrices(result,2),{subtotalRub:null,unpricedParts:2});
});
