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

test('automatic basket sizing preserves all clearances and rounds up without inventing outer allowances',async()=>{
 const {calculatedBasketSize}=await import('../lib/quote/basket-fit');
 const fit={width:800.2,height:500,depth:300,left:50,right:100,top:50,bottom:0,front:200,rear:30};
 assert.deepEqual(calculatedBasketSize(fit),{width:951,height:550,depth:530});
 assert.equal(calculatedBasketSize({...fit,rear:null}),null);
 assert.equal(calculatedBasketSize({...fit,width:9999,left:50}),null);
 const design={...defaultBasketDesign(),sizing:'block' as const,fit};
 const [item]=parseBasketProject(serializeBasketProject([{width:951,height:550,depth:530,quantity:2,ral:'7024',screen:'round',design}]));
 assert.equal(item.design?.sizing,'block');
 const {basketBriefSummary,basketBriefHref}=await import('../lib/quote/basket-brief');
 const summary=basketBriefSummary(new URL(basketBriefHref(item),'https://www.steelprodukt.ru').searchParams);
 assert.match(summary!,/Расчётный внутренний габарит/);
 assert.doesNotMatch(summary!,/Предварительный наружный габарит/);
});

test('automatic specification cannot contain stale dimensions detached from its block',async()=>{
 const {validBasketBrief}=await import('../lib/quote/basket-brief');
 const design={...defaultBasketDesign(),sizing:'block' as const,fit:{width:800,height:500,depth:300,left:50,right:50,top:50,bottom:50,front:200,rear:50}};
 const item={width:900,height:600,depth:550,quantity:2,ral:'7024',screen:'round',design};
 assert.equal(validBasketBrief(item),true);
 assert.equal(validBasketBrief({...item,width:901}),false);
 assert.equal(validBasketBrief({...item,design:{...design,fit:{...design.fit,left:null}}}),false);
});

test('switching to manual dimensions clears invalid fit drafts but preserves known gaps',async()=>{
 const {normalizedBasketFit}=await import('../lib/quote/basket-fit');
 const fit=normalizedBasketFit({...emptyBasketFit(),width:NaN,height:0,depth:10001,left:50,bottom:0});
 assert.equal(fit!.width,null);assert.equal(fit!.height,null);assert.equal(fit!.depth,null);assert.equal(fit!.left,50);assert.equal(fit!.bottom,0);assert.ok(validBasketFit(fit));
});
