import assert from "node:assert/strict";
import test from "node:test";
import { emptyLeadState } from "../lib/assistant/state";
import { mergeAiProposal, parseAiProposal, type AiExtractionProposal } from "../lib/quote-engine/ai-proposal";
import { hasLiteralEvidence, normalizeNumberEvidence, valueMatchesEvidence, type EvidenceField } from "../lib/quote-engine/value-evidence";

const accepted: Array<[EvidenceField, string, string]> = [
  ["thickness", "2 мм", "лист в два миллиметра"],
  ["thickness", "1.5 мм", "полтора миллиметра"],
  ["thickness", "0.7 мм", "толщина 0,7 мм"],
  ["quantity", "50 шт", "полста штук"],
  ["quantity", "123 шт", "сто двадцать три штуки"],
  ["quantity", "1200 шт", "тысяча двести штук"],
  ["dimensions", "600×1200", "шестьсот на тысячу двести"],
  ["dimensions", "600×1200", "60×120 см"],
  ["material", "Оцинкованная сталь", "из оцинковки"],
  ["material", "Сталь х/к", "холоднокатаная сталь"],
  ["cassetteType", "closed", "закрытого типа"],
];
for (const [field, value, quote] of accepted) {
  test(`accept independently supported ${field}: ${quote}`, () => {
    assert.equal(valueMatchesEvidence(field, value, quote), true);
    const result = mergeAiProposal(emptyLeadState(), { [field]: { value, quote } } as AiExtractionProposal, quote);
    assert.deepEqual(result.accepted, [field]);
  });
}
const rejected: Array<[EvidenceField, string, string]> = [
  ["thickness", "5 мм", "лист в два миллиметра"],
  ["thickness", "1200 мм", "600×1200 мм"],
  ["thickness", "2 мм", "толщина -2 мм"],
  ["thickness", "2 мм", "толщина 2 мм или 3 мм"],
  ["quantity", "500 шт", "полста штук"],
  ["quantity", "20 шт", "20 м²"],
  ["quantity", "5 шт", "через 5 дней"],
  ["quantity", "7024 шт", "RAL 7024"],
  ["quantity", "100 шт", "около 100 штук"],
  ["quantity", "10 шт", "10 комплектов"],
  ["quantity", "5 шт", "два три штуки"],
  ["dimensions", "1200×600", "шестьсот на тысячу двести"],
  ["dimensions", "600×1200", "600×1200×400 мм"],
  ["material", "Алюминий", "из оцинковки"],
  ["material", "Алюминий", "не алюминий"],
  ["material", "Сталь х/к", "сталь"],
  ["cassetteType", "open", "закрытого типа"],
];
for (const [field, value, quote] of rejected) {
  test(`reject unsupported ${field}: ${value} from ${quote}`, () => {
    assert.equal(valueMatchesEvidence(field, value, quote), false);
    const result = mergeAiProposal(emptyLeadState(), { [field]: { value, quote } } as AiExtractionProposal, quote);
    assert.deepEqual(result.accepted, []);
    assert.equal(result.state[field], undefined);
  });
}
test("a literal quote cannot be cut out of a larger number or negation", () => {
  assert.equal(hasLiteralEvidence("2 мм", "толщина 12 мм"), false);
  assert.equal(hasLiteralEvidence("алюминий", "не алюминий"), false);
  assert.equal(hasLiteralEvidence("100 шт", "до 100 шт"), false);
  assert.equal(hasLiteralEvidence("2 мм", "толщина 2 мм"), true);
});
test("the numeric vocabulary does not add two unrelated numbers", () => {
  assert.equal(normalizeNumberEvidence("два три штуки"), "два три штуки");
  assert.equal(normalizeNumberEvidence("двести тридцать пять штук"), "235 штук");
});
test("oversized model fields are rejected without entering state", () => {
  assert.equal(parseAiProposal(JSON.stringify({ thickness: { value: "2 мм", quote: "x".repeat(2001) } })), null);
  assert.equal(parseAiProposal(" ".repeat(16001)), null);
});
test("correct AI fields survive independently of an incorrect numeric proposal", () => {
  const result = mergeAiProposal(emptyLeadState(), {
    material: { value: "Оцинкованная сталь", quote: "из оцинковки" },
    quantity: { value: "500 шт", quote: "полста штук" },
  }, "из оцинковки, полста штук");
  assert.deepEqual(result.accepted, ["material"]);
  assert.deepEqual(result.rejected, [{ field: "quantity", reason: "contradicts-evidence" }]);
});
