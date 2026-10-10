import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { cassetteProductSummary, cassetteProductBrief, type CassetteProductDraft } from '../lib/cassette-product-spec';
const draft = ():CassetteProductDraft => ({type:'closed',rows:[{id:'1',width:'600',height:'1200',quantity:'3'},{id:'2',width:'450,5',height:'1000',quantity:'2'}],material:'',thickness:'',finish:''});
test('product specification totals mixed face sizes without tariff or manufactured geometry',()=>{
  const result=cassetteProductSummary(draft());assert.equal(result.quantity,5);assert.equal(result.faceAreaM2,3.061);
  const brief=cassetteProductBrief(draft());assert.match(brief,/600 × 1200 мм; 3 шт/);assert.match(brief,/450.5 × 1000 мм; 2 шт/);assert.match(brief,/Материал: Согласовать/);assert.match(brief,/требуется расчёт специалиста/);assert.match(brief,/Заявка не отправлена/);assert.doesNotMatch(brief,/₽|руб|развёртка:|IFC/);
});
test('blank, fractional quantities, non-finite and unsafe totals never become specifications',()=>{
  for(const [key,value] of [['width',''],['height','0'],['width','-1'],['width','Infinity'],['quantity','1.5'],['quantity','1e2'],['quantity',String(Number.MAX_SAFE_INTEGER+1)]] as const){const p=draft();p.rows[0][key]=value;assert.throws(()=>cassetteProductSummary(p));assert.throws(()=>cassetteProductBrief(p));}
  const p=draft();p.rows[0].quantity=String(Number.MAX_SAFE_INTEGER);assert.throws(()=>cassetteProductSummary(p));
  p.rows=[];assert.throws(()=>cassetteProductSummary(p));
});
test('optional material details remain unknown; thickness is validated rather than silently substituted',()=>{
  const p=draft();p.thickness='0,7';assert.doesNotThrow(()=>cassetteProductSummary(p));p.thickness='unknown';assert.throws(()=>cassetteProductSummary(p));
  p.thickness='';const brief=cassetteProductBrief(p);assert.match(brief,/Толщина, мм: Согласовать/);assert.match(brief,/Покрытие \/ цвет: Согласовать/);
});
test('one hundred rows is a client budget, not a manufacturing capability',()=>{
  const p=draft();p.rows=Array.from({length:100},(_,i)=>({...p.rows[0],id:String(i)}));assert.equal(cassetteProductSummary(p).quantity,300);p.rows.push(p.rows[0]);assert.throws(()=>cassetteProductSummary(p),/технический предел/);
});
const compiled=buildSync({stdin:{contents:`import {createElement} from 'react'; import {renderToStaticMarkup} from 'react-dom/server';import {CassetteProductSpecification} from './components/CassetteProductSpecification';import {CassetteBimConfigurator} from './components/CassetteBimConfigurator';import {TrimBimConfigurator} from './components/TrimBimConfigurator';export const render=()=>[CassetteProductSpecification,CassetteBimConfigurator,TrimBimConfigurator].map(component=>renderToStaticMarkup(createElement(component)));`,resolveDir:process.cwd(),loader:'ts'},loader:{'.css':'empty','.module.css':'empty'},bundle:true,platform:'node',format:'cjs',jsx:'automatic',write:false,logLevel:'silent'});
const mod={exports:{} as {render:()=>string[]}};new Function('module','exports','require',compiled.outputFiles[0].text)(mod,mod.exports,createRequire(`${process.cwd()}/package.json`));
test('first screens expose product sizes, collapse secondary BIM tools, and show only verified trim',()=>{
  const [product,bim,trim]=mod.exports.render();
  assert.match(product,/Какие кассеты нужны/);assert.match(product,/Количество, шт/);assert.doesNotMatch(product,/Покрытие \/ цвет RAL|Цена после/);
  assert.match(bim,/<details[^>]*><summary>Раскладка, шов и марка<\/summary>/);assert.match(bim,/<details[^>]*id="bim-colours"><summary>Цвета и выбор кассет/);
  assert.match(bim,/aria-label="Вращение модели кассеты"/);
  assert.match(trim,/<details[^>]*><summary[^>]*>Исходный чертёж каталога/);assert.doesNotMatch(trim,/<select[^>]*aria-label="Форма"/);assert.match(trim,/Скачать задание TXT/);assert.doesNotMatch(trim,/>Передать специалисту<\/button>/);
});
test('main route does not silently run area pricing and FAQ no longer promises editable rates',()=>{
  const main=readFileSync('components/MetalCassetteCalculator.tsx','utf8'),page=readFileSync('app/(public)/calculator-metallokassety/page.tsx','utf8');
  assert.match(main,/<select aria-label="Режим калькулятора металлокассет"/);assert.match(main,/useState<"product" \| "project" \| "estimate">\("product"\)/);assert.match(main,/<MetalCassetteQuickEstimate active=\{view === "estimate"\} \/>/);assert.match(main,/if \(!active\) return;/);assert.doesNotMatch(main,/view === "estimate" && <MetalCassetteQuickEstimate/);
  assert.doesNotMatch(page,/Её можно изменить вручную|Редактируемая цена за квадратный метр/);assert.match(page,/В быстром режиме оценки бюджета доступны/);assert.match(page,/толщину можно указать как исходные данные заказа или оставить на согласование/);
});
