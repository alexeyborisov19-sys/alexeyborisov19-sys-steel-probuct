import assert from 'node:assert/strict';
import test from 'node:test';
import { cassetteHandoffSummary } from '../lib/quote/cassette-handoff';
test('wall handoff retains closed type, openings and indicative result', () => {
  const text = cassetteHandoffSummary(new URLSearchParams('mode=wall&type=closed&wallWidth=13000&wallHeight=6000&openings=8&area=70&thickness=0.7&quantity=119&rate=2023&total=141610'));
  for (const value of ['Закрытая', '13000×6000', 'Проёмы: 8', '70 м²', '0,7 мм', '119 шт.', 'проверка специалистом']) assert.ok(text.includes(value), value);
  assert.doesNotMatch(text, /₽|141610/);
});
test('handoff before response retains inputs without inventing a quote', () => {
  const text = cassetteHandoffSummary(new URLSearchParams('mode=area&type=open&inputArea=12.5&thickness=1.2'));
  assert.match(text, /Заданная площадь: 12,5/);assert.match(text, /ещё не получен/);assert.doesNotMatch(text, /₽/);
});
test('untrusted URL values do not inject arbitrary text or nonfinite figures', () => {
  const text = cassetteHandoffSummary(new URLSearchParams('type=evil&area=Infinity&quantity=-1&rate=NaN&total=100&thickness=evil&openings=0'));
  assert.doesNotMatch(text, /evil|Infinity|NaN|-1|₽/);
});
test('zero openings and old area-only links remain supported', () => {
  assert.match(cassetteHandoffSummary(new URLSearchParams('mode=wall&openings=0')), /Проёмы: 0/);
  assert.match(cassetteHandoffSummary(new URLSearchParams('area=100&quantity=170&thickness=0.7')), /100 м²/);
});
