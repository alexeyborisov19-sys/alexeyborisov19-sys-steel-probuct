import assert from 'node:assert/strict';
import test from 'node:test';
import { bendingQuantitySummary } from '../components/cad/public/ClientOperationSummary';
test('manual DXF bend count shows per-part and batch quantities',()=>assert.equal(bendingQuantitySummary(['bending'],{bendCount:2},null,50),'Гибка: 2 гиб./деталь × 50 шт. = 100 гибов в партии.'));
test('measured STEP bends remain visible without manual input',()=>assert.equal(bendingQuantitySummary(['bending'],{},1,50),'Гибка: 1 гиб./деталь × 50 шт. = 50 гибов в партии.'));
test('unselected or unknown bending never pretends to be priced',()=>{
 assert.equal(bendingQuantitySummary(['laser-cutting'],{bendCount:2},2,50),null);
 assert.match(bendingQuantitySummary(['bending'],{},null,50)!,/укажите/);
 assert.match(bendingQuantitySummary(['bending'],{bendCount:0},null,50)!,/укажите/);
});
