import {test} from 'node:test';
import assert from 'node:assert/strict';
import {basketVolumePrice} from '../lib/quote/basket-volume-price';
test('owner price boundaries and totals without a second 16.5% uplift',()=>{
 for(const [q,p] of [[1,7300],[10,7300],[11,6700],[49,6700],[50,6100],[99,6100],[100,5600],[10000,5600]])assert.deepEqual(basketVolumePrice(q),{unit:p,total:q*p});
 for(const q of [0,-1,1.5,Infinity,NaN,10001])assert.equal(basketVolumePrice(q),null);
});
