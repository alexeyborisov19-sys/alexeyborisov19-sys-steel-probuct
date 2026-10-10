import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyBasketAcReference, basketAcDimensionDisclaimer, basketAcReference, validBasketAcReference } from '../lib/quote/basket-ac-reference';
import { defaultBasketDesign, basketDesignSummary } from '../lib/quote/basket-design';
import { emptyBasketFit } from '../lib/quote/basket-fit';
import { serializeBasketProject, parseBasketProject } from '../lib/quote/basket-project';
import { basketReview } from '../lib/quote/basket-review';

test('manufacturer example fills only editable block sizes, never unknown clearances', () => {
 const design=applyBasketAcReference({...defaultBasketDesign(),fit:{...emptyBasketFit(),rear:70}},9);
 assert.deepEqual([design.fit!.width,design.fit!.height,design.fit!.depth],[722,493,264]);
 assert.equal(design.fit!.rear,70);assert.equal(design.fit!.front,null);assert.equal(design.fit!.top,null);
 assert.equal(design.acReference!.status,'unconfirmed');assert.equal(design.mass,0);
});
test('provenance and manufacturer warning survive JSON and engineering brief', () => {
 const item={width:900,height:600,depth:550,quantity:2,ral:'7024',screen:'round',design:applyBasketAcReference(defaultBasketDesign(),36)};
 const json=serializeBasketProject([item]);const restored=parseBasketProject(json)[0];
 assert.deepEqual(restored.design!.acReference,item.design.acReference);
 assert.ok(json.includes(basketAcDimensionDisclaimer));
 const summary=basketDesignSummary(restored.design!);assert.ok(summary.includes(basketAcDimensionDisclaimer));assert.ok(summary.includes('https://www.midea.com/'));assert.ok(summary.includes('не подтверждено'));
 assert.equal(basketReview(restored).find(x=>x.id==='dimensions')!.state,'review');
 const changed={...restored,design:{...restored.design!,fit:{...restored.design!.fit!,width:999}}};
 assert.equal(basketReview(changed).find(x=>x.id==='dimensions')!.state,'review');
});
test('import cannot promote an example to approved or forge manufacturer provenance', () => {
 const ref=basketAcReference(9);assert.equal(validBasketAcReference({...ref,status:'approved'}),false);assert.equal(validBasketAcReference({...ref,source:'https://invalid.example'}),false);assert.equal(validBasketAcReference({...ref,blockDimensions:[1,2,3]}),false);
 assert.throws(()=>applyBasketAcReference(defaultBasketDesign(),999));
});
