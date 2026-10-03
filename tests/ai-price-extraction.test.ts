import assert from "node:assert/strict";
import test from "node:test";
import { parseProposedPriceRows, recoverPriceRowsWithAi } from "../lib/server/instant-quote/ai-price-extraction";

const documentText = [
  "Прайс-лист на листовой металл от 20.09.2026",
  "Лист горячекатаный 2,0 мм 1250х2500 — 61 000 руб/т",
  "Лист оцинкованный 1,2 мм 1250х2500 — 78 500 руб/т",
].join("\n");

const base = { documentText, sourceDate: "2026-09-20", fetchedAt: "2026-09-20T10:00:00.000Z", source: "atlantik" };

test("rows the model read correctly become real price rows carrying the source and dates", async () => {
  const result = await recoverPriceRowsWithAi({
    ...base,
    reader: async () => JSON.stringify({
      rows: [{ materialId: "hot", thicknessMm: 2, rubPerTon: 61000, size: "1250x2500", quote: "Лист горячекатаный 2,0 мм 1250х2500 — 61 000 руб/т" }],
    }),
  });
  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.rows[0], {
    materialId: "hot", thicknessMm: 2, rubPerTon: 61000, size: "1250x2500",
    source: "atlantik", sourceDate: "2026-09-20", fetchedAt: "2026-09-20T10:00:00.000Z",
  });
});

test("a price the model made up never becomes a row", async () => {
  const result = await recoverPriceRowsWithAi({
    ...base,
    reader: async () => JSON.stringify({
      rows: [{ materialId: "hot", thicknessMm: 2, rubPerTon: 52000, quote: "Лист горячекатаный 2,0 мм 1250х2500 — 52 000 руб/т" }],
    }),
  });
  assert.equal(result.rows.length, 0);
  assert.equal(result.rejected[0].reason, "ungrounded-quote");
});

test("a real price attached to the wrong thickness never becomes a row", async () => {
  const result = await recoverPriceRowsWithAi({
    ...base,
    reader: async () => JSON.stringify({
      // 61 000 is real, 1,2 mm is real — but not together.
      rows: [{ materialId: "zinc", thicknessMm: 1.2, rubPerTon: 61000, quote: "Лист оцинкованный 1,2 мм 1250х2500 — 78 500 руб/т" }],
    }),
  });
  assert.equal(result.rows.length, 0);
  assert.equal(result.rejected[0].reason, "quote-missing-price");
});

test("a price that jumped past the drift limit is held back even though it is printed in the document", async () => {
  const result = await recoverPriceRowsWithAi({
    ...base,
    previous: [{ materialId: "hot", thicknessMm: 2, rubPerTon: 30_000, source: "p", sourceDate: "2026-01-01", fetchedAt: "2026-01-01T00:00:00.000Z" }],
    reader: async () => JSON.stringify({
      rows: [{ materialId: "hot", thicknessMm: 2, rubPerTon: 61000, quote: "Лист горячекатаный 2,0 мм 1250х2500 — 61 000 руб/т" }],
    }),
  });
  assert.equal(result.rows.length, 0);
  assert.equal(result.rejected[0].reason, "price-drift");
});

test("an unconfigured or silent model is reported as unavailable, not as zero prices", async () => {
  const result = await recoverPriceRowsWithAi({ ...base, reader: async () => null });
  assert.equal(result.unavailable, true);
  assert.equal(result.rows.length, 0);
});

test("a model that throws is unavailable too, never an exception out of this function", async () => {
  const result = await recoverPriceRowsWithAi({ ...base, reader: async () => { throw new Error("upstream down"); } });
  assert.equal(result.unavailable, true);
});

test("prose instead of JSON yields no rows and does not crash", async () => {
  const result = await recoverPriceRowsWithAi({ ...base, reader: async () => "В прайсе указан горячекатаный лист по 61 000." });
  assert.equal(result.rows.length, 0);
  assert.equal(result.unavailable, false, "the model did answer — it just answered unusably");
});

test("a markdown-fenced answer is still read", () => {
  const rows = parseProposedPriceRows('```json\n{"rows":[{"materialId":"hot","thicknessMm":2,"rubPerTon":61000,"quote":"x"}]}\n```');
  assert.equal(rows.length, 1);
});

test("rows missing a quote, a material or a usable number are dropped at parse time", () => {
  assert.deepEqual(parseProposedPriceRows(JSON.stringify({ rows: [{ materialId: "hot", thicknessMm: 2, rubPerTon: 61000 }] })), []);
  assert.deepEqual(parseProposedPriceRows(JSON.stringify({ rows: [{ thicknessMm: 2, rubPerTon: 61000, quote: "x" }] })), []);
  assert.deepEqual(parseProposedPriceRows(JSON.stringify({ rows: [{ materialId: "hot", thicknessMm: "толстый", rubPerTon: 61000, quote: "x" }] })), []);
  assert.deepEqual(parseProposedPriceRows(JSON.stringify({ rows: "нет" })), []);
  assert.deepEqual(parseProposedPriceRows("{"), []);
});
