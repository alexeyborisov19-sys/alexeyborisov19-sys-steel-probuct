import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { MANUAL_SHEET_WARNING } from '../lib/instant-quote/manual-sheet';
const workspace = () => readFile(new URL('../components/ClientManufacturingWorkspace.tsx', import.meta.url), 'utf8');

test('unpriced CAD result requests clarification without implying a submitted engineering review', async () => {
  const source = await workspace();
  assert.doesNotMatch(source, /calculation \? "На проверке"/);
  assert.match(source, /calculation \? "Нужны уточнения"/);
});
test('mobile CAD contact link describes opening the application rather than sending it', async () => {
  const source = await workspace();
  const mobile = source.slice(source.indexOf('mobile-quote-bar'));
  assert.doesNotMatch(mobile, /"Отправить"/);
  assert.match(mobile, /aria-label="Перейти к форме заявки"/);
  assert.match(mobile, />К заявке<\/HandoffLink>/);
});
test('manual CAD entry consistently requests the flat blank dimensions before bending', async () => {
  const source = await workspace();
  assert.match(source, /либо укажите длину и ширину плоской заготовки до гибки/);
  assert.match(MANUAL_SHEET_WARNING, /длине и ширине плоской прямоугольной заготовки до гибки/);
  assert.doesNotMatch(MANUAL_SHEET_WARNING, /развёртка после гибки/);
  assert.match(MANUAL_SHEET_WARNING, /технолог должен проверить развёртку, перемычки и зоны гиба/);
  assert.match(MANUAL_SHEET_WARNING, /не чертёж для производства/);
});
