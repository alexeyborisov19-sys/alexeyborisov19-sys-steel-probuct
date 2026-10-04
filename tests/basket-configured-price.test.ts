import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultBasketDesign, panelCutting, basketDesignSummary, type PanelPattern } from '../lib/quote/basket-design';
import { calculatedBasketSize, emptyBasketFit } from '../lib/quote/basket-fit';
import { basketConfiguredPrice, basketEstimateMaximum, validBasketEstimateInput, type BasketEstimateInput, type BasketEstimateRates } from '../lib/quote/basket-volume-price';

// Synthetic test fixture, not production rates or a supplier snapshot.
const rates: BasketEstimateRates = { metalRubPerKg:100, laserRubPerM:10, pierceRubEach:2, powderRubPerM2:20, preparationRubPerM2:10 };
function base(quantity=1): BasketEstimateInput {
 const d=defaultBasketDesign();
 return {width:900,height:600,depth:550,quantity,design:{...d,mount:'existing',front:{...d.front,pattern:'wide-slots'},side:{...d.side,pattern:'wide-slots'}}};
}
function patterned(pattern: PanelPattern['pattern'], pitch=20): BasketEstimateInput {
 const input=base();
 return {...input,design:{...input.design,front:{...input.design.front,pattern,pitch},side:{...input.design.side,pattern,pitch}}};
}

test('owner quantity anchors stay exact without tariffs, supports or a second uplift',()=>{
 for(const [quantity,unit] of [[1,7300],[10,7300],[11,6700],[49,6700],[50,6100],[99,6100],[100,5600],[10000,5600]]){
  for(const mount of ['existing','unknown','bearing'] as const){
   const input=base(quantity);input.design.mount=mount;
   assert.deepEqual(basketConfiguredPrice(input),{unit,total:unit*quantity,basis:'confirmed'});
   assert.deepEqual(basketConfiguredPrice(input,rates),{unit,total:unit*quantity,basis:'confirmed'});
  }
 }
 const input=base();
 assert.equal(panelCutting(900,600,input.design.front).known,false);
 assert.match(basketDesignSummary(input.design),/10 длинных продолговатых прорезей/);
});

test('size-dependent preliminary result uses current rates and preserves the reference residual',()=>{
 const input={...base(),width:1100,height:800,depth:600};
 // Reference variable costs=1550; new three-panel variable costs=2165.60.
 assert.deepEqual(basketConfiguredPrice(input,rates),{unit:7915.6,total:7915.6,basis:'estimated'});
 assert.equal(basketConfiguredPrice(input),null);
 for(const changed of [{width:1000},{height:700},{depth:600}]){
  const result=basketConfiguredPrice({...base(),...changed},rates)!;
  assert.ok(result.unit>7300);
  assert.equal(result.basis,'estimated');
 }
 const smaller=basketConfiguredPrice({...base(),width:750,height:550,depth:400},rates)!;
 assert.ok(smaller.unit>0&&smaller.unit<7300);
});

test('quantity bands also apply to a custom size, with exact displayed-unit totals',()=>{
 const quantities=[1,10,11,49,50,99,100,10000];
 let previous=Infinity;
 for(const quantity of quantities){
  const result=basketConfiguredPrice({...base(quantity),width:1100,height:800,depth:600},rates)!;
  assert.ok(result.unit<=previous);
  assert.equal(result.total,Math.round(result.unit*quantity*100)/100);
  previous=result.unit;
 }
});

test('denser known perforation costs more; either panel contributes; solid remains a preliminary estimate',()=>{
 const sparse=patterned('round',40),dense=patterned('round',20);
 assert.ok(basketConfiguredPrice(dense,rates)!.unit>basketConfiguredPrice(sparse,rates)!.unit);
 const oneDense={...sparse,design:{...sparse.design,side:dense.design.side}};
 assert.ok(basketConfiguredPrice(oneDense,rates)!.unit>basketConfiguredPrice(sparse,rates)!.unit);
 assert.ok(basketConfiguredPrice(dense,rates)!.unit>basketConfiguredPrice(oneDense,rates)!.unit);
 assert.ok(basketConfiguredPrice(patterned('slots',40),rates)!.unit>0);
 assert.ok(basketConfiguredPrice(patterned('solid'),rates)!.unit<basketConfiguredPrice(sparse,rates)!.unit);
 assert.equal(basketConfiguredPrice(patterned('solid'),rates)!.basis,'estimated');
 for(const pattern of ['lamella','custom'] as const) assert.equal(basketConfiguredPrice(patterned(pattern),rates),null);
 const noHoles=patterned('round');noHoles.design.front.margin=1000;
 assert.equal(basketConfiguredPrice(noHoles,rates),null);
});

test('calibration never invents a minimum tariff or returns negative smaller-basket prices',()=>{
 const expensive={metalRubPerKg:1e6,laserRubPerM:1e6,pierceRubEach:1e6,powderRubPerM2:1e6,preparationRubPerM2:1e6};
 const result=basketConfiguredPrice({...base(100),width:750,height:550,depth:400},expensive)!;
 assert.ok(result.unit>0&&result.unit<5600);
 assert.deepEqual(basketConfiguredPrice(base(100),expensive),{unit:5600,total:560000,basis:'confirmed'});
});

test('estimate domain is bounded by existing catalog examples, not extrapolated to ten metres',()=>{
 assert.ok(basketConfiguredPrice({...base(),...basketEstimateMaximum},rates));
 for(const key of ['width','height','depth'] as const){
  assert.equal(basketConfiguredPrice({...base(),[key]:basketEstimateMaximum[key]+1},rates),null);
  assert.equal(basketConfiguredPrice({...base(),[key]:10000},rates),null);
 }
});

test('block mode requires a complete matching envelope; no stale dimensions or fake clearances',()=>{
 const input=base();input.design.sizing='block';
 assert.equal(basketConfiguredPrice(input,rates),null);
 input.design.fit=emptyBasketFit();
 assert.equal(basketConfiguredPrice(input,rates),null);
 input.design.fit={width:721.5,height:493,depth:264,left:10.1,right:20.2,top:20,bottom:30,front:50,rear:0};
 const envelope=calculatedBasketSize(input.design.fit)!;
 assert.deepEqual(envelope,{width:752,height:543,depth:314});
 assert.equal(basketConfiguredPrice(input,rates),null);
 assert.equal(basketConfiguredPrice({...input,...envelope},rates)?.basis,'estimated');
 input.design.fit={width:800,height:500,depth:400,left:50,right:50,top:50,bottom:50,front:100,rear:50};
 assert.deepEqual(basketConfiguredPrice(input),{unit:7300,total:7300,basis:'estimated'});
});

test('malformed inputs and missing/invalid tariffs fail without leaking cost fields',()=>{
 for(const value of [null,{},[],{...base(),quantity:NaN},{...base(),width:1.5},{...base(),quantity:'10'},{...base(),design:null}]) assert.equal(validBasketEstimateInput(value),false);
 assert.equal(validBasketEstimateInput(base()),true);
 for(const quantity of [0,-1,1.5,NaN,Infinity,10001]) assert.equal(basketConfiguredPrice({...base(),quantity},rates),null);
 const input={...base(),width:1100};
 for(const key of Object.keys(rates) as (keyof BasketEstimateRates)[]){
  for(const value of [0,-1,NaN,Infinity]) assert.equal(basketConfiguredPrice(input,{...rates,[key]:value}),null);
 }
 const invalid=base();invalid.design.front.diameter=NaN;
 assert.equal(basketConfiguredPrice(invalid,rates),null);
 assert.deepEqual(Object.keys(basketConfiguredPrice(input,rates)!).sort(),['basis','total','unit']);
});
