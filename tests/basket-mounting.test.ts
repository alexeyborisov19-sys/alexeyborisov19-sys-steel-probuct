import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultBasketDesign, type BasketDesign } from '../lib/quote/basket-design';
import { calculatedBasketSize, emptyBasketFit } from '../lib/quote/basket-fit';
import { basketConfiguredPrice } from '../lib/quote/basket-volume-price';
import { parseBasketProject, serializeBasketProject } from '../lib/quote/basket-project';
import { basketMountingDimensions, basketRearGap, basketWallKind, basketFitForSizing, setBasketRearGap, setBasketWallKind, type BasketWallKind } from '../lib/quote/basket-mounting';

function completeDesign(): BasketDesign {
 const d=defaultBasketDesign();
 return {...d,sizing:'block',mount:'existing',facade:200,offset:50,
  front:{...d.front,pattern:'wide-slots'},side:{...d.side,pattern:'wide-slots'},
  fit:{width:800,height:500,depth:300,left:50,right:50,top:50,bottom:50,front:200,rear:50}};
}

test('wall kind respects explicit values, including unknown, before legacy facade inference',()=>{
 const d=defaultBasketDesign();
 assert.equal(basketWallKind({...d,facade:0}),'wall');
 assert.equal(basketWallKind({...d,facade:200}),'ventilated');
 assert.equal(basketWallKind({...d,facade:null}),'unknown');
 assert.equal(basketWallKind({...d,facade:200,wallKind:'unknown'}),'unknown');
 assert.equal(basketWallKind({...d,facade:200,wallKind:'wall'}),'wall');
 assert.equal(basketWallKind({...d,facade:0,wallKind:'ventilated'}),'ventilated');
 for(const facade of [NaN,Infinity,-1,2001]) assert.equal(basketWallKind({...d,facade}),'unknown');
 assert.equal(basketWallKind({...d,facade:200,wallKind:'not-a-wall' as BasketWallKind}),'unknown');
});

test('rear gap uses fit precedence, preserves explicit zero/null and never falls back from incomplete fit',()=>{
 const d={...defaultBasketDesign(),offset:75};
 assert.equal(basketRearGap(d),75);
 assert.equal(basketRearGap({...d,fit:{...emptyBasketFit(),rear:0}}),0);
 assert.equal(basketRearGap({...d,fit:{...emptyBasketFit(),rear:25}}),25);
 assert.equal(basketRearGap({...d,fit:emptyBasketFit()}),null);
 for(const rear of [NaN,Infinity,-1,10001]) assert.equal(basketRearGap({...d,fit:{...emptyBasketFit(),rear}}),null);
 for(const offset of [NaN,Infinity,-1,10001]) assert.equal(basketRearGap({...d,offset}),null);
 assert.equal(basketRearGap({...d,offset:10000}),10000);
 assert.equal(basketRearGap({...d,offset:0}),0);
 assert.equal(basketRearGap({...d,fit:null as unknown as BasketDesign['fit']}),null);
});

test('mounting sums known facade and rear once, retaining unknown values without bracket guesses',()=>{
 const d=completeDesign();
 assert.deepEqual(basketMountingDimensions(d),{wallKind:'ventilated',facadeMm:200,rearMm:50,wallToBlockRearMm:250});
 assert.deepEqual(basketMountingDimensions({...d,wallKind:'wall',facade:200}),{wallKind:'wall',facadeMm:0,rearMm:50,wallToBlockRearMm:50});
 assert.deepEqual(basketMountingDimensions({...d,facade:null}),{wallKind:'unknown',facadeMm:null,rearMm:50,wallToBlockRearMm:null});
 assert.deepEqual(basketMountingDimensions({...d,fit:{...d.fit!,rear:null}}),{wallKind:'ventilated',facadeMm:200,rearMm:null,wallToBlockRearMm:null});
 assert.equal(basketMountingDimensions({...d,facade:Infinity}).facadeMm,null);
 assert.deepEqual(Object.keys(basketMountingDimensions(d)).sort(),['facadeMm','rearMm','wallKind','wallToBlockRearMm']);
});

test('rear setter synchronizes both fields immutably and preserves other measurements',()=>{
 const d=completeDesign();const before=structuredClone(d);
 const updated=setBasketRearGap(d,125.5);
 assert.equal(updated.offset,125.5);assert.equal(updated.fit!.rear,125.5);
 assert.deepEqual(updated.fit,{...d.fit,rear:125.5});
 assert.deepEqual(d,before);
 assert.deepEqual(calculatedBasketSize(updated.fit),{width:900,height:600,depth:626});
 for(const value of [null,NaN,Infinity,-1,10001]){
  const invalid=setBasketRearGap(d,value);assert.equal(invalid.offset,null);assert.equal(invalid.fit!.rear,null);
 }
 const zero=setBasketRearGap(d,0);assert.equal(zero.offset,0);assert.equal(zero.fit!.rear,0);
});

test('rear setter creates an empty fit only for block sizing; no implicit preset gap',()=>{
 const d=defaultBasketDesign();
 const manual=setBasketRearGap(d,75);assert.equal(manual.offset,75);assert.equal(manual.fit,undefined);
 const block=setBasketRearGap({...d,sizing:'block'},75);
 assert.deepEqual(block.fit,{...emptyBasketFit(),rear:75});
 assert.equal(calculatedBasketSize(block.fit),null);
 const untouched=setBasketWallKind(d,'ventilated');assert.equal(basketRearGap(untouched),null);
});

test('wall switch preserves fit and rear gap but clears an inapplicable facade layer',()=>{
 const d=completeDesign();
 const wall=setBasketWallKind(d,'wall');assert.equal(wall.facade,0);assert.equal(wall.wallKind,'wall');
 assert.equal(wall.fit,d.fit);assert.equal(wall.offset,d.offset);
 const vent=setBasketWallKind(wall,'ventilated');assert.equal(vent.facade,null);assert.equal(vent.fit,d.fit);assert.equal(vent.offset,50);
 const preserved=setBasketWallKind(d,'ventilated');assert.equal(preserved.facade,200);
 const unknown=setBasketWallKind(d,'unknown');assert.equal(unknown.facade,null);assert.equal(unknown.fit,d.fit);assert.equal(unknown.offset,50);
 const legacyWall=setBasketWallKind({...d,facade:0},'ventilated');assert.equal(legacyWall.facade,null);
});

test('facade thickness and wall kind never enlarge basket fit or inflate its panel price',()=>{
 const d=completeDesign();
 const price=(design:BasketDesign)=>basketConfiguredPrice({...calculatedBasketSize(design.fit)!,quantity:100,design});
 const initialPrice=price(d),initialSize=calculatedBasketSize(d.fit);
 for(const facade of [0,50,200,1500,2000]){
  const changed={...d,facade};
  assert.deepEqual(calculatedBasketSize(changed.fit),initialSize);
  assert.deepEqual(price(changed),initialPrice);
  assert.equal(basketMountingDimensions(changed).wallToBlockRearMm,facade+50);
 }
 for(const kind of ['wall','ventilated','unknown'] as const){
  const changed=setBasketWallKind(d,kind);
  assert.deepEqual(calculatedBasketSize(changed.fit),initialSize);assert.deepEqual(price(changed),initialPrice);
 }
 assert.equal(initialPrice!.unit,5600);
});

test('explicit wall selection and synchronized zero rear gap survive specification round trip',()=>{
 const design=setBasketRearGap(setBasketWallKind(completeDesign(),'wall'),0);
 const item={...calculatedBasketSize(design.fit)!,quantity:2,ral:'7024',screen:'wide-slots',design};
 const saved=parseBasketProject(serializeBasketProject([item]))[0].design!;
 assert.equal(Reflect.get(saved,'wallKind'),'wall');assert.equal(basketWallKind(saved),'wall');assert.equal(basketRearGap(saved),0);assert.equal(saved.offset,0);
 assert.deepEqual(saved.fit,design.fit);
 const unknown=setBasketWallKind(completeDesign(),'unknown');
 const unknownItem={...calculatedBasketSize(unknown.fit)!,quantity:2,ral:'7024',screen:'wide-slots',design:unknown};
 const unknownSaved=parseBasketProject(serializeBasketProject([unknownItem]))[0].design!;
 assert.equal(Reflect.get(unknownSaved,'wallKind'),'unknown');assert.equal(basketWallKind(unknownSaved),'unknown');assert.equal(basketRearGap(unknownSaved),50);
});

test('explicit unknown mounting never presents a distance from stale facade data',()=>{
 const d={...completeDesign(),wallKind:'unknown' as const};
 assert.equal(basketMountingDimensions(d).wallToBlockRearMm,null);
 assert.equal(basketMountingDimensions(d).facadeMm,null);
});

test('first switch from manual basket retains entered mounting gap, including zero, but never revives cleared fit',()=>{
 for(const rear of [0,75]){
  const d=setBasketRearGap({...defaultBasketDesign(),sizing:'basket'},rear);
  const fit=basketFitForSizing(d,'block')!;
  assert.equal(fit.rear,rear);assert.equal(fit.width,null);
  const afterWidth={...d,sizing:'block' as const,fit:{...fit,width:800}};
  assert.equal(basketRearGap(afterWidth),rear);
 }
 const cleared={...completeDesign(),offset:75,fit:{...completeDesign().fit!,rear:null}};
 assert.equal(basketFitForSizing(cleared,'block')!.rear,null);
});
