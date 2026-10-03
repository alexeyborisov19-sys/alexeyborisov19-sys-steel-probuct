import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PRICE_VERIFICATION_LIMITS,
  verifyProposedPriceRows,
  type ProposedPriceRow,
} from "../lib/instant-quote/price-row-verification";
import type { MaterialMarketPrice } from "../lib/instant-quote/pricing";

const documentText = [
  "Прайс-лист на листовой металл",
  "Лист горячекатаный 2,0 мм 1250х2500 — 61 000 руб/т",
  "Лист горячекатаный 3,0 мм 1500х6000 — 60 000 руб/т",
  "Лист оцинкованный 1,2 мм 1250х2500 — 78 500 руб/т",
].join("\n");

function row(overrides: Partial<ProposedPriceRow> = {}): ProposedPriceRow {
  return {
    materialId: "hot",
    thicknessMm: 2,
    rubPerTon: 61_000,
    quote: "Лист горячекатаный 2,0 мм 1250х2500 — 61 000 руб/т",
    ...overrides,
  };
}

function previous(rubPerTon: number, thicknessMm = 2, materialId = "hot"): MaterialMarketPrice[] {
  return [{
    materialId: materialId as MaterialMarketPrice["materialId"],
    thicknessMm,
    rubPerTon,
    source: "prev",
    sourceDate: "2026-01-01",
    fetchedAt: "2026-01-01T00:00:00.000Z",
  }];
}

test("a row quoted verbatim from the document, carrying both its thickness and its price, is accepted", () => {
  const result = verifyProposedPriceRows({ proposed: [row()], documentText });
  assert.equal(result.accepted.length, 1);
  assert.deepEqual(result.rejected, []);
});

test("a price that appears nowhere in the document is refused", () => {
  const result = verifyProposedPriceRows({
    proposed: [row({ rubPerTon: 59_000, quote: "Лист горячекатаный 2,0 мм 1250х2500 — 59 000 руб/т" })],
    documentText,
  });
  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected[0].reason, "ungrounded-quote");
});

test("a real fragment that does not itself carry the claimed price is refused — this is the wrong-column error", () => {
  // The quote is genuinely in the document, and 60 000 is a genuine price in
  // it, but not the price on this line. Grounding alone would have passed it.
  const result = verifyProposedPriceRows({
    proposed: [row({ rubPerTon: 60_000 })],
    documentText,
  });
  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected[0].reason, "quote-missing-price");
});

test("a real fragment quoted against the wrong thickness is refused", () => {
  const result = verifyProposedPriceRows({
    proposed: [row({ thicknessMm: 3 })],
    documentText,
  });
  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected[0].reason, "quote-missing-thickness");
});

test("a material the site does not know is never introduced by a document", () => {
  const result = verifyProposedPriceRows({ proposed: [row({ materialId: "titanium" })], documentText });
  assert.equal(result.rejected[0].reason, "unknown-material");
});

test("thickness and price outside physical bounds are read as misreads, not bargains", () => {
  const thin = verifyProposedPriceRows({ proposed: [row({ thicknessMm: 0.01 })], documentText });
  assert.equal(thin.rejected[0].reason, "implausible-thickness");

  const cheap = verifyProposedPriceRows({ proposed: [row({ rubPerTon: 61 })], documentText });
  assert.equal(cheap.rejected[0].reason, "implausible-price");
});

test("a price within the drift limit of the last confirmed one is accepted", () => {
  const result = verifyProposedPriceRows({ proposed: [row()], documentText, previous: previous(55_000) });
  assert.equal(result.accepted.length, 1, "61 000 is ~11 % above 55 000, inside the 25 % limit");
});

test("a price that jumped further than the limit is held back for a human, however well grounded", () => {
  const result = verifyProposedPriceRows({ proposed: [row()], documentText, previous: previous(20_000) });
  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected[0].reason, "price-drift");
  assert.match(result.rejected[0].detail ?? "", /20000 → 61000/);
});

test("drift is compared per material and thickness, never across them", () => {
  // A previous zinc 1,2 mm price must not gate a hot 2 mm row.
  const result = verifyProposedPriceRows({
    proposed: [row()],
    documentText,
    previous: previous(20_000, 1.2, "zinc"),
  });
  assert.equal(result.accepted.length, 1);
});

test("a first-ever import has nothing to drift against and is judged on the other checks alone", () => {
  const result = verifyProposedPriceRows({ proposed: [row()], documentText, previous: [] });
  assert.equal(result.accepted.length, 1);
});

test("every row is judged on its own — one bad row does not discard the good ones", () => {
  const result = verifyProposedPriceRows({
    proposed: [
      row(),
      row({ materialId: "zinc", thicknessMm: 1.2, rubPerTon: 78_500, quote: "Лист оцинкованный 1,2 мм 1250х2500 — 78 500 руб/т" }),
      row({ rubPerTon: 999_999, quote: "Лист горячекатаный 2,0 мм 1250х2500 — 999 999 руб/т" }),
    ],
    documentText,
  });
  assert.equal(result.accepted.length, 2);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].reason, "ungrounded-quote");
});

test("spacing and case in a quote are forgiven, content is not", () => {
  const result = verifyProposedPriceRows({
    proposed: [row({ quote: "ЛИСТ   ГОРЯЧЕКАТАНЫЙ 2,0 ММ 1250Х2500 — 61 000 РУБ/Т" })],
    documentText,
  });
  assert.equal(result.accepted.length, 1);
});

test("the default limits are the ones documented, so a config drift is visible in review", () => {
  assert.equal(DEFAULT_PRICE_VERIFICATION_LIMITS.maxDriftPct, 25);
  assert.equal(DEFAULT_PRICE_VERIFICATION_LIMITS.minRubPerTon, 10_000);
});
