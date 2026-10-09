import test from 'node:test';
import assert from 'node:assert/strict';
import { freeServices } from '../data/free-services';
import { readFileSync } from 'node:fs';
test('tools inventory describes implemented BIM profiles without stale unavailable claims',()=>{
 const copy=freeServices.find(service=>service.id==='ifc')!.result;
 assert.match(copy,/открытых, закрытых и упрощённых угловых/);
 assert.doesNotMatch(copy,/замки и угловые элементы пока недоступны/);
 assert.match(copy,/RFA не формируется/);
});
test('cassette public page and structured description exclude subsystem and installation',()=>{
 const source=readFileSync('app/(public)/calculator-metallokassety/page.tsx','utf8');
 assert.match(source,/только кассеты: без подсистемы, крепежа, доборов и монтажа/);
 assert.match(source,/Сохранение проекта JSON, ведомость CSV/);
});
