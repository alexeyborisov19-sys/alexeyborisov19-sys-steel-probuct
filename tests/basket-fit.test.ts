import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyBasketFit,requiredBasketSpace,validBasketFit} from '../lib/quote/basket-fit';
import {defaultBasketDesign,basketDesignSummary} from '../lib/quote/basket-design';
import {serializeBasketProject,parseBasketProject} from '../lib/quote/basket-project';
test('unknown gaps never become zero or produce a fit claim',()=>{assert.equal(requiredBasketSpace(emptyBasketFit()),null);assert.equal(requiredBasketSpace(),null);});
test('adds independent measured installation and each clearance, preserves through saved brief',()=>{
 const fit={width:800,height:500,depth:300,left:50,right:100,top:50,bottom:0,front:200,rear:30};
 assert.deepEqual(requiredBasketSpace(fit),{width:950,height:550,depth:530});
 const design={...defaultBasketDesign(),fit};
 const [item]=parseBasketProject(serializeBasketProject([{width:1000,height:700,depth:550,quantity:2,ral:'7024',screen:'round',design}]));
 assert.deepEqual(item.design?.fit,fit); assert.match(basketDesignSummary(item.design!),/950 × 550 × 530/);
});
test('rejects missing, negative or nonfinite dimensions',()=>{
 assert.equal(validBasketFit({...emptyBasketFit(),width:0}),false);
 assert.equal(validBasketFit({...emptyBasketFit(),left:-1}),false);
 assert.equal(validBasketFit({...emptyBasketFit(),front:Infinity}),false);
 assert.equal(validBasketFit({}),false);
});
