import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { POST } from "../app/api/calc-metallokassety/route";
import { CALCULATION_DISCLAIMER } from "../lib/instant-quote/client-labels";
import { collectRequiredScope } from "../lib/quote-engine/required-scope";
import { emptyLeadState } from "../lib/assistant/state";
import { handleNaturalLanguageQuote } from "../lib/server/quote-engine/handle-request";

function request(payload: unknown): Request {
  return new Request("https://www.steelprodukt.ru/api/calc-metallokassety", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
}
const input = { mode: "area", type: "open", thickness: "0.7", areaM2: 100 };
test("a browser-supplied low cassette price cannot undercut the server calculation", async () => {
  const baseline = await (await POST(request(input))).json();
  const forged = await (await POST(request({ ...input, pricePerM2: 1 }))).json();
  assert.equal(forged.approximateTotalRub, baseline.approximateTotalRub);
  assert.equal(forged.approximateRateRubM2, baseline.defaultRateRubM2);
  assert.equal(forged.disclaimer, CALCULATION_DISCLAIMER);
  assert.equal(forged.marketVerified, false);
});
test("a higher explicitly entered cassette rate remains a what-if estimate, not market verification", async () => {
  const estimate = await (await POST(request({ ...input, pricePerM2: 3000 }))).json();
  assert.equal(estimate.approximateRateRubM2, 3000);
  assert.equal(estimate.marketVerified, false);
});
for (const payload of [null, [], {}, { ...input, areaM2: -1 }, { ...input, areaM2: "no" }, { ...input, areaM2: 0 }]) {
  test(`invalid cassette payload returns a bounded error: ${JSON.stringify(payload)}`, async () => {
    const response = await POST(request(payload));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });
}
test("explicit operations persist after later quantity-only messages", () => {
  const required = collectRequiredScope("нужны отверстия и сварка");
  assert.ok(required.includes("holes-or-cutouts"));
  assert.ok(required.includes("welding"));
  assert.deepEqual(collectRequiredScope("100 шт", required), required);
});
test("explicitly excluded operations are not counted as requested", () => {
  assert.deepEqual(collectRequiredScope("без отверстий, без сварки, без покраски"), []);
  assert.deepEqual(collectRequiredScope("сварка не нужна", ["welding"]), []);
});
test("a quotation that needs holes cannot become a plain rectangular cutting quote", async () => {
  const first = await handleNaturalLanguageQuote("Нужна деталь 500×400 мм, оцинковка 2 мм, с отверстиями", emptyLeadState(), { aiProposalCaller: null });
  assert.equal(first.kind, "blocked");
  const next = await handleNaturalLanguageQuote("100 шт", first.state, { aiProposalCaller: null });
  assert.equal(next.kind, "blocked");
  if (next.kind !== "blocked") return;
  assert.equal(next.record, null);
  assert.match(next.clientMessage, /не будут исключены/);
  assert.doesNotMatch(next.clientMessage, /₽/);
});
test("cassette screen renders the common notice next to the result", async () => {
  const source = await readFile("components/MetalCassetteCalculator.tsx", "utf8");
  assert.match(source, /\{CALCULATION_DISCLAIMER\}/);
  assert.match(source, /итоговая ставка не может быть ниже базовой/);
});
