import {test} from 'node:test';
import assert from 'node:assert/strict';
import {estimateCassetteProjectBudget} from '../lib/cassette-project/budget';
import {createCassetteProject, type CassetteElevation} from '../lib/cassette-project/model';
import {serializeCassetteProject,parseCassetteProject,createCassetteProjectBrief} from '../lib/cassette-project/export';
const elevation: CassetteElevation={id:'E1',name:'Фасад',widthMm:2020,heightMm:1020,panel:{faceWidthMm:1000,faceHeightMm:500,jointXMm:20,jointYMm:20,type:'open',thicknessMm:.7,finish:'RAL 7016'},openings:[]};
const project=()=>({...createCassetteProject('budget-project'),elevations:[structuredClone(elevation)]});
test('budget uses exact panel faces rather than facade area or fixed standard module',()=>{
 const p=project(),b=estimateCassetteProjectBudget(p);assert.equal(b.faceAreaM2,2);assert.equal(b.quantity,4);assert.equal(b.totalRub,3528);assert.equal(b.byElevation[0].rateRubM2,1764);assert.equal(b.projectId,p.id);
});
test('opening-affected residual stays in budget and quantity with explicit manufacturing unknowns',()=>{
 const p=project();p.elevations[0].openings=[{id:'O1',name:'Проём',xMm:100,yMm:100,widthMm:200,heightMm:200}];const b=estimateCassetteProjectBudget(p);assert.equal(b.faceAreaM2,1.96);assert.equal(b.quantity,4);assert.equal(b.reviewQuantity,1);assert.equal(b.totalRub,3457);assert.match(b.assumptions,/не определены/);assert.match(b.assumptions,/не коммерческое предложение/);
 const brief=createCassetteProjectBrief(p);assert.ok(brief.includes(b.assumptions));assert.match(brief,/3457 руб/);
});
test('opening wholly in a joint does not reduce face budget and full removal is excluded',()=>{
 const p=project();p.elevations[0].openings=[{id:'O1',name:'Шов',xMm:1000,yMm:0,widthMm:20,heightMm:500}];assert.equal(estimateCassetteProjectBudget(p).totalRub,3528);
 p.elevations[0].openings=[{id:'O1',name:'Удалено',xMm:0,yMm:0,widthMm:1000,heightMm:500}];const b=estimateCassetteProjectBudget(p);assert.equal(b.quantity,3);assert.equal(b.faceAreaM2,1.5);assert.equal(b.totalRub,2646);
});
test('canonical type/thickness rates survive import and cannot be replaced by saved price',()=>{
 const p=project();p.elevations[0].panel.type='closed';p.elevations[0].panel.thicknessMm=1;const raw=JSON.parse(serializeCassetteProject(p));raw.price=1;raw.elevations[0].panel.pricePerM2=1;
 const a=estimateCassetteProjectBudget(p),b=estimateCassetteProjectBudget(parseCassetteProject(JSON.stringify(raw)));assert.deepEqual(a,b);assert.ok(b.byElevation[0].rateRubM2>2074);
});
