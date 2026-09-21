import assert from "node:assert/strict";
import test from "node:test";
import { hasBendingRequirement, normalizeQuoteAnswer, quoteNumericEvidence } from "../lib/quote-engine/conversation-input";

const numericCases: Array<[string, string | null | undefined, string | null | undefined]> = [
  ["600×1200 мм", undefined, undefined],
  ["600x1200x2 мм", undefined, undefined],
  ["600×1200 мм, оцинковка 1,2 мм, 100 кассет", "1.2 мм", "100 шт"],
  ["100×100 мм, 100 кассет", undefined, "100 шт"],
  ["100 кронштейнов, оцинковка 2 мм", "2 мм", "100 шт"],
  ["доставка за 10 дней", undefined, undefined],
  ["RAL 7024, поставка через 5 недель", undefined, undefined],
  ["ширина 500 мм, толщина 2 мм", "2 мм", undefined],
  ["диаметр 10 мм", undefined, undefined],
  ["толщина -2 мм", null, undefined],
  ["толщина 0 мм", null, undefined],
  ["2 мм или 3 мм", null, undefined],
  ["100 деталей и 200 деталей", undefined, null],
  ["до 100 кассет", undefined, null],
  ["-5 шт", undefined, null],
  ["1,5 шт", undefined, null],
  ["0 шт", undefined, null],
  ["5 000 шт", undefined, "5000 шт"],
  ["20 м²", undefined, "20 м²"],
];
for (const [message, thickness, quantity] of numericCases) {
  test(`numeric evidence: ${message}`, () => {
    assert.deepEqual(quoteNumericEvidence(message), { thickness, quantity });
  });
}

for (const field of ["thickness", "thicknessMm"]) {
  test(`a bare decimal answers ${field} in the unit explicitly asked for`, () => {
    assert.equal(normalizeQuoteAnswer("1,2", field), "толщина 1.2 мм");
  });
}
test("a bare integer answers a quantity question", () => {
  assert.equal(normalizeQuoteAnswer("100", "quantity"), "100 шт");
});
test("numbers are not assigned a unit without question context", () => {
  assert.equal(normalizeQuoteAnswer("100"), "100");
  assert.equal(normalizeQuoteAnswer("100", "material"), "100");
  assert.equal(normalizeQuoteAnswer("1,5", "quantity"), "1,5");
});
for (const message of ["гнутый кронштейн", "нужно 2 гиба", "с отбортовкой"]) {
  test(`positive bending evidence: ${message}`, () => assert.equal(hasBendingRequirement(message), true));
}
for (const message of ["плоская деталь без гибов", "гибка не нужна", "без отбортовки"]) {
  test(`negated bending evidence: ${message}`, () => assert.equal(hasBendingRequirement(message), false));
}
