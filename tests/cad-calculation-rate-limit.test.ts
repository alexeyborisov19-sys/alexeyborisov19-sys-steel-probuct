import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryRateLimitStore, quoteRateRules, cadCalculationRateRules, selectCadCalculationRateRules } from '../lib/security/rate-limit';

test('public CAD variants have six-per-minute and 200-per-day quotas independent of lead submissions',()=>{
 assert.deepEqual(cadCalculationRateRules.map(rule=>[rule.limit,rule.windowMs]),[[6,60000],[200,86400000]]);
 assert.deepEqual(quoteRateRules.map(rule=>[rule.limit,rule.windowMs]),[[3,60000],[20,86400000]]);
 const store=new InMemoryRateLimitStore();
 for(let i=0;i<3;i++)assert.equal(store.consume('customer',quoteRateRules[0],1).allowed,true);
 assert.equal(store.consume('customer',quoteRateRules[0],1).allowed,false);
 for(let i=0;i<6;i++)assert.equal(store.consume('customer',cadCalculationRateRules[0],1).allowed,true);
 assert.equal(store.consume('customer',cadCalculationRateRules[0],1).allowed,false);
});
test('only exact trusted desktop environment enables production variant quota',()=>{
 for(const value of [undefined,'false','TRUE','1'])assert.deepEqual(selectCadCalculationRateRules({STEEL_PRODUCT_LOCAL_DESKTOP:value}),cadCalculationRateRules);
 const local=selectCadCalculationRateRules({STEEL_PRODUCT_LOCAL_DESKTOP:'true'});
 assert.deepEqual(local.map(rule=>[rule.limit,rule.windowMs]),[[60,60000],[2000,86400000]]);
 assert.ok(local.every(rule=>!cadCalculationRateRules.some(publicRule=>publicRule.id===rule.id)));
 const store=new InMemoryRateLimitStore();
 for(let i=0;i<60;i++)assert.equal(store.consume('operator',local[0],1).allowed,true);
 assert.equal(store.consume('operator',local[0],1).allowed,false);
});
test('CAD daily limits remain enforced',()=>{
 for(const rules of [cadCalculationRateRules,selectCadCalculationRateRules({STEEL_PRODUCT_LOCAL_DESKTOP:'true'})]){
  const daily=rules[1],store=new InMemoryRateLimitStore();
  for(let i=0;i<daily.limit;i++)assert.equal(store.consume('owner',daily,1).allowed,true);
  assert.equal(store.consume('owner',daily,1).allowed,false);
 }
});
