import "../scripts/repo-alias-hook.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { defaultBasketDesign } from "../lib/quote/basket-design";
import { basketRatesFromPrivateBasis } from "../lib/server/instant-quote/basket-estimate";
import { handleBasketEstimate } from "../lib/server/instant-quote/basket-estimate-handler";
import type { PrivateCalculationBasis } from "../lib/server/instant-quote/private-calculation-basis";

const now = new Date("2026-10-04T10:00:00Z");
const source = { id: "synthetic", label: "Synthetic test fixture", confirmedAt: now.toISOString(), note: "Not production rates" };
const rate = (rateRub: number) => ({ rateRub, source });
function basis(): PrivateCalculationBasis {
  return {
    version: "test",
    rateBook: { laserRubPerM: [{ ...rate(90), materialId: "zinc", thicknessMm: 1, from100mRubPerM: 60, from500mRubPerM: 30, pierceRubEach: 3 }],
      bendRubEach: null, weldRubPerM: null, countersinkRubEach: null, assemblyRubPerHour: null, packagingRubEach: null,
      powderRubPerM2: rate(200), surfacePreparationRubPerM2: rate(150) },
    materialPriceSnapshots: [{ sourceId: "atlantik-smolensk", fetchedAt: now.toISOString(), sourceDate: "2026-10-04", status: "ok",
      rows: [{ materialId: "zinc", thicknessMm: 1, rubPerTon: 100000, source: "synthetic", sourceDate: "2026-10-04", fetchedAt: now.toISOString() }] }],
  };
}
const rates = () => basketRatesFromPrivateBasis(basis(), now, 5);
function input(width = 900) {
  const design = defaultBasketDesign();
  design.front.pattern = "wide-slots"; design.side.pattern = "wide-slots"; design.mount = "existing";
  return { width, height: 600, depth: 550, quantity: 2, design };
}
function request(value: unknown, origin = "https://www.steelprodukt.ru") {
  return new Request("https://www.steelprodukt.ru/api/basket-estimate", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(value) });
}
const dependencies = { loadRates: async () => rates(), key: () => "synthetic-client", limit: () => null };

test("basket adapter uses exact fresh zinc 1mm, private averaged laser tiers and existing metal uplift", () => {
  assert.deepEqual(rates(), { metalRubPerKg: 105, laserRubPerM: 60, pierceRubEach: 3, powderRubPerM2: 200, preparationRubPerM2: 150 });
  const stale = basis(); stale.materialPriceSnapshots[0].fetchedAt = "2026-09-01T00:00:00Z";
  assert.throws(() => basketRatesFromPrivateBasis(stale, now));
  const wrongThickness = basis(); wrongThickness.materialPriceSnapshots[0].rows[0].thicknessMm = 2;
  assert.throws(() => basketRatesFromPrivateBasis(wrongThickness, now));
  const missing = basis(); missing.rateBook.surfacePreparationRubPerM2 = null;
  assert.throws(() => basketRatesFromPrivateBasis(missing, now));
});

test("approved basket price does not need private rates and response contains no tariffs", async () => {
  const res = await handleBasketEstimate(request(input()), { ...dependencies, loadRates: async () => { throw Error("Must not load"); } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { price: { unit: 7300, total: 14600, basis: "confirmed" } });
});

test("server estimates changed dimensions and ignores injected prices and rates", async () => {
  const configured = input(1000);
  const response = await handleBasketEstimate(request({ ...configured, rates: { metalRubPerKg: .001 }, unit: 1, total: 2 }), dependencies);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ["price"]);
  assert.deepEqual(Object.keys(body.price).sort(), ["basis", "total", "unit"]);
  assert.equal(body.price.basis, "estimated");
  assert.ok(body.price.unit > 7300);
  const clean = await handleBasketEstimate(request(configured), dependencies);
  assert.deepEqual(await clean.json(), body);
});

test("missing private basis yields retryable 503 and never exposes paths or rates", async () => {
  const response = await handleBasketEstimate(request(input(1000)), { ...dependencies, loadRates: async () => { throw Error("/secret/private-basis.json metalRubPerKg=999"); } });
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.doesNotMatch(body, /secret|metalRubPerKg|999/);
  assert.equal(JSON.parse(body).price, null);
});

test("custom geometry is a normal unpriced result, not a private basis failure", async () => {
  const configured = input(); configured.design.front.pattern = "custom";
  const response = await handleBasketEstimate(request(configured), { ...dependencies, loadRates: async () => { throw Error("Must not load"); } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).price, null);
});

test("public route rejects invalid payload, cross-origin, oversized stream and rate excess", async () => {
  for (const invalid of [null, [], {}, { ...input(), width: 0 }, { ...input(), quantity: 1.5 }, { ...input(), width: "900" }]) {
    assert.equal((await handleBasketEstimate(request(invalid), dependencies)).status, 400);
  }
  assert.equal((await handleBasketEstimate(request(input(), "https://other.example"), dependencies)).status, 403);
  assert.equal((await handleBasketEstimate(request({ ...input(), extra: "x".repeat(17000) }), dependencies)).status, 413);
  const limited = await handleBasketEstimate(request(input()), { ...dependencies, limit: () => ({ allowed: false, limit: 60, remaining: 0, retryAfterSeconds: 45 }) });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "45");
});

test('new concept appearances never receive the old ten-slot price or load unrelated rates',async()=>{
 for(const appearance of ['circle','regular','shift','rhythm','tilt','square','louvers']){
  const configured={...input(),design:{...input().design,appearance}};
  const response=await handleBasketEstimate(request(configured),{...dependencies,loadRates:async()=>{throw Error('Concept must not enter calibrated panel price');}});
  assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.price,null);assert.match(body.reason,/развёртки/);
 }
});
