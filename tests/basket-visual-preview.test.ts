import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { defaultBasketDesign, type BasketDesign } from "../lib/quote/basket-design";
import { applyBasketAcReference, basketAcDimensionDisclaimer } from "../lib/quote/basket-ac-reference";
import { emptyBasketFit } from "../lib/quote/basket-fit";

const built = buildSync({stdin:{contents:`
  import {createElement} from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
  import {BasketProductView, basketProductGeometry} from './components/commercial/BasketProductView';
  import {BasketAcReference} from './components/commercial/BasketAcReference';
  import {BasketWallSection} from './components/commercial/BasketWallSection';
  import {BasketFitFields} from './components/commercial/BasketFitFields';
  import {BasketConfigurator} from './components/commercial/BasketConfigurator';
  import {BasketDesignFields} from './components/commercial/BasketDesignFields';
  import {BasketMountingResult} from './components/commercial/BasketMountingFields';
  export const product = props => renderToStaticMarkup(createElement(BasketProductView,props));
  export const geometry = basketProductGeometry;
  export const reference = value => renderToStaticMarkup(createElement(BasketAcReference,{value,onChange(){},onApply(){},onApplyUnit(){}}));
  export const wall = design => renderToStaticMarkup(createElement(BasketWallSection,{design}));
  export const fields = value => renderToStaticMarkup(createElement(BasketFitFields,{value,onChange(){}}));
  export const result = design => renderToStaticMarkup(createElement(BasketDesignFields,{step:3,design,onChange(){},width:950,height:550,depth:530,quantity:1}));
  export const mounting = design => renderToStaticMarkup(createElement(BasketMountingResult,{design}));
  export const configurator = () => renderToStaticMarkup(createElement(BasketConfigurator));
`,resolveDir:process.cwd(),loader:"ts"},bundle:true,platform:"node",format:"cjs",jsx:"automatic",write:false,loader:{".css":"empty",".module.css":"empty"},logLevel:"silent"});
const compiled={exports:{} as {
  product:(props:Record<string,unknown>)=>string;
  geometry:(w:number,h:number,d:number,design:BasketDesign)=>{valid:boolean;unit:null|{width:number;height:number;depth:number;x:number;y:number;z:number};conflict:boolean};
  reference:(value:number)=>string;
  wall:(design:BasketDesign)=>string;
  fields:(value:BasketDesign["fit"])=>string;
  configurator:()=>string;
  result:(design:BasketDesign)=>string;
  mounting:(design:BasketDesign)=>string;
}};
new Function("module","exports","require",built.outputFiles[0].text)(compiled,compiled.exports,createRequire(`${process.cwd()}/package.json`));
const ui=compiled.exports;
const design:BasketDesign={...defaultBasketDesign(),sizing:"block",fit:{width:800,height:500,depth:300,left:50,right:100,top:50,bottom:0,front:200,rear:30}};
const props={width:950,height:550,depth:530,color:"#46505a",ral:"RAL 7024",design};

test("basket model keeps physical panel dimensions, open top and actual perforation cut-outs",()=>{
  const html=ui.product(props);
  assert.match(html,/data-basket-model="configured"/);
  assert.match(html,/data-basket-panel="front" data-panel-width="950" data-panel-height="550"/);
  assert.match(html,/data-basket-panel="side" data-panel-width="530"/);
  assert.match(html,/<mask[^>]+maskUnits="userSpaceOnUse"/);
  assert.match(html,/mask="url\(#/);
  assert.match(html,/Открытый верх/);
  assert.doesNotMatch(html,/data-basket-panel="(?:roof|top)"|NaN|Infinity/);
  assert.match(html,/Расчётный внутренний объём/);
  assert.match(html,/aria-pressed="false"[^>]*>Показать блок/);
});

test("placed unit uses supplied dimensions and gaps without inferred defaults",()=>{
  assert.deepEqual(ui.geometry(950,550,530,design).unit,{width:800,height:500,depth:300,x:50,y:50,z:200});
  assert.equal(ui.geometry(950,550,530,design).conflict,false);
  const html=ui.product({...props,initialUnitVisible:true});
  assert.match(html,/data-unit-width="800" data-unit-height="500" data-unit-depth="300"/);
  assert.match(html,/Панели полупрозрачны/);
  assert.match(html,/совместимость не подтверждена/);
  const incomplete={...design,fit:{...design.fit!,rear:null}};
  assert.equal(ui.geometry(950,550,530,incomplete).unit,null);
  assert.doesNotMatch(ui.product({...props,design:incomplete,initialUnitVisible:true}),/data-basket-unit/);
});

test("incomplete AC sizing shows only supplied unit, never a calculated default basket",()=>{
  const d=applyBasketAcReference({...defaultBasketDesign(),sizing:"block",fit:emptyBasketFit()},12);
  const html=ui.product({...props,width:0,height:0,depth:0,design:d});
  assert.match(html,/data-basket-model="unit-only"/);
  assert.match(html,/Размер корзины ещё не рассчитан/);
  assert.match(html,/data-unit-width="722" data-unit-height="493" data-unit-depth="264"/);
  assert.doesNotMatch(html,/data-basket-panel|900 × 600 × 550/);
  assert.ok(html.includes(basketAcDimensionDisclaimer));
});

test("ten wide slots remain pattern-independent for each of three panels",()=>{
  const d={...design,front:{...design.front,pattern:"wide-slots" as const,diameter:500,margin:1000,pitch:2000},side:{...design.side,pattern:"wide-slots" as const,diameter:500,margin:1000,pitch:2000}};
  const html=ui.product({...props,design:d});
  assert.equal((html.match(/data-basket-wide-panel="true"/g)||[]).length,3);
  assert.equal((html.match(/data-basket-wide-slot="true"/g)||[]).length,30);
});

test("blank and invalid drafts keep an explicitly unmeasured finite shape",()=>{
  for(const n of [0,NaN,Infinity,-1,10001]){
    const html=ui.product({...props,width:n,design:defaultBasketDesign()});
    assert.match(html,/Пример формы · без масштаба/);
    assert.doesNotMatch(html,/NaN|Infinity|Расчётный внутренний объём/);
  }
});

test("power reference gives manufacturer-bound warning, cooling units and optional table",()=>{
  const html=ui.reference(12);
  assert.ok(html.includes(basketAcDimensionDisclaimer));
  assert.match(html,/Мощность охлаждения, кВт/);
  assert.match(html,/не потребляемая электрическая мощность/);
  assert.match(html,/722 × 493 × 264/);
  assert.match(html,/<details[^>]*><summary[^>]*>Таблица мощности/);
  assert.match(html,/Подставить ориентировочные размеры блока/);
});

test("facade diagram separates total facade depth and rear gap without support claims",()=>{
  const html=ui.wall({...design,wallKind:"ventilated",facade:150,offset:30,wallAssembly:{version:1,structuralBase:"unknown",finish:"cladding",insulation:"yes",insulationThicknessMm:100}});
  assert.match(html,/общая глубина фасада 150 мм, задний зазор блока 30 мм/);
  assert.match(html,/Схема без масштаба/);
  assert.match(html,/не прибавляется второй раз/);
  assert.doesNotMatch(html,/280 мм|Анкер M|кг\/м/);
});

test("initial workflow has three steps, two sizing routes and folded advanced gaps",()=>{
  const html=ui.configurator();
  assert.match(html,/ШАГ 1 ИЗ 3/);
  assert.match(html,/Знаю размеры корзины/);
  assert.match(html,/Подобрать по кондиционеру/);
  assert.match(html,/Пример формы · без масштаба/);
  const gaps=ui.fields(emptyBasketFit());
  assert.match(gaps,/<details[^>]*><summary[^>]*>Уточнить зазоры вокруг блока/);
  assert.doesNotMatch(gaps,/<details[^>]* open/);
});


test("customer result hides intermediate workload and facade formula",()=>{
  const d={...design,wallKind:"ventilated" as const,facade:150,offset:30};
  const html=ui.result(d);
  assert.doesNotMatch(html,/Отверстия, 3 панели|Рез, 3 панели|Открытая площадь|Состав производственного образца|Технические данные и проверка размеров/);
  const mount=ui.mounting(d);
  assert.match(mount,/180 мм/);
  assert.doesNotMatch(mount,/150 \+ 30|= 180/);
});
