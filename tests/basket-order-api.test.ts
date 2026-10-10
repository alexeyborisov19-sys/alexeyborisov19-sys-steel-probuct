import "../scripts/repo-alias-hook.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { defaultBasketDesign } from "../lib/quote/basket-design";
import { defaultBasketReview } from "../lib/quote/basket-review";
import { createBasketOrderSnapshot } from "../lib/quote/basket-order-contract";
import { PRODUCT_CALCULATION_NOTICE } from "../lib/product-calculation-notice";
import { MAX_BASKET_PROJECT_BYTES } from "../lib/quote/basket-project";
import { handleBasketOrderQuote } from "../lib/server/instant-quote/basket-order-handler";

function input() {
  return {
    schemaVersion: 1, orderId: "synthetic-order", orderRevision: 7, requestId: "request-7",
    positions: [2, 9].map((quantity, i) => ({
      positionId: `position-${i}`,
      brief: {
        width: 1000, height: 700, depth: 550, quantity, ral: "7024", screen: "round",
        design: { ...defaultBasketDesign(), mount: "existing" },
        review: { ...defaultBasketReview(), mark: "PRIVATE-MARK", equipment: "PRIVATE-EQUIPMENT", facadeNotes: "PRIVATE-NOTES" },
      },
    })),
  };
}
function request(value: unknown, headers: Record<string, string> = {}) {
  return new Request("https://www.steelprodukt.ru/api/basket-order-quote", {
    method: "POST", headers: { origin: "https://www.steelprodukt.ru", "Content-Type": "application/json", ...headers }, body: JSON.stringify(value),
  });
}
const dependencies = { key: () => "synthetic-client", limit: () => null };

test("mixed basket order returns correlated unpriced row states and a digest, never a partial price", async () => {
  const value = input();
  const response = await handleBasketOrderQuote(request(value), dependencies);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.schemaVersion, 1);
  assert.equal(body.orderId, value.orderId);
  assert.equal(body.orderRevision, 7);
  assert.equal(body.requestId, value.requestId);
  assert.equal(body.orderFingerprint, createHash("sha256").update(createBasketOrderSnapshot(value).fingerprint).digest("hex"));
  assert.match(body.orderFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(body.totalBasketQuantity, 11);
  assert.equal(body.state, "incomplete");
  assert.equal(body.price, null);
  assert.equal(body.notice, PRODUCT_CALCULATION_NOTICE);
  assert.ok(body.reasons.includes("production-source-unavailable"));
  assert.deepEqual(body.positions.map((position: { positionId: string; quantity: number }) => [position.positionId, position.quantity]), [["position-0", 2], ["position-1", 9]]);
  for (const position of body.positions) {
    assert.equal(position.state, "incomplete");
    assert.equal(position.price, null);
    assert.ok(position.reasons.includes("bom-revision-missing"));
    assert.ok(position.reasons.includes("components-missing"));
  }
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE-|blockWidth|clearanceSource|facadeNotes|"brief"|"design"|"analysisGroups"|"manufacturingIdentity"/);
});

test("100 positions and quantities through10000 are accepted without changing10/11 policy", async () => {
  for (const quantity of [1, 10, 11, 10000]) {
    const value = input(); value.positions = [value.positions[0]]; value.positions[0].brief.quantity = quantity;
    const response = await handleBasketOrderQuote(request(value), dependencies);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.totalBasketQuantity, quantity);
    assert.equal(body.price, null);
  }
  const value = input();
  value.positions = Array.from({ length: 100 }, (_, i) => ({ ...input().positions[0], positionId: `p-${i}`, brief: { ...input().positions[0].brief, quantity: 10000 } }));
  const response = await handleBasketOrderQuote(request(value), dependencies);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.totalBasketQuantity, 1000000);
  assert.equal(body.positions.length, 100);
});

test("zero, negative, fractional, nonfinite, oversized and wrong-type quantities fail atomically", async () => {
  for (const quantity of [0, -1, 1.5, NaN, Infinity, 10001, "2", null]) {
    const value = input(); Object.assign(value.positions[1].brief, { quantity });
    const response = await handleBasketOrderQuote(request(value), dependencies);
    assert.equal(response.status, 400);
    assert.deepEqual(Object.keys(await response.json()).sort(), ["code", "message", "notice", "ok", "price"]);
  }
  const oversized = input();
  oversized.positions = Array.from({ length: 101 }, (_, i) => ({ ...input().positions[0], positionId: `p-${i}` }));
  assert.equal((await handleBasketOrderQuote(request(oversized), dependencies)).status, 400);
});

test("malformed shapes, duplicate IDs and invalid correlation metadata are rejected", async () => {
  for (const value of [null, [], {}, { ...input(), schemaVersion: 2 }, { ...input(), orderRevision: -.5 }, { ...input(), requestId: "" }, { ...input(), requestId: "x".repeat(129) }, { ...input(), requestId: "bad\u0000id" }, { ...input(), positions: [] }]) {
    assert.equal((await handleBasketOrderQuote(request(value), dependencies)).status, 400);
  }
  const duplicate = input(); duplicate.positions[1].positionId = duplicate.positions[0].positionId;
  assert.equal((await handleBasketOrderQuote(request(duplicate), dependencies)).status, 400);
  for (const body of ["{", "", "NaN"]) {
    const malformed = new Request("https://www.steelprodukt.ru/api/basket-order-quote", { method: "POST", headers: { origin: "https://www.steelprodukt.ru" }, body });
    assert.equal((await handleBasketOrderQuote(malformed, dependencies)).status, 400);
  }
});

test("same-origin protection runs before limits and bodies are read", async () => {
  const cases: Record<string, string>[] = [{ origin: "https://other.example" }, { origin: "null" }, { "sec-fetch-site": "cross-site" }];
  for (const headers of cases) {
    let consumed = false;
    const response = await handleBasketOrderQuote(request(input(), headers), { key: () => { consumed = true; return "unexpected"; }, limit: () => null });
    assert.equal(response.status, 403);
    assert.equal(consumed, false);
    assert.equal((await response.json()).price, null);
  }
});

test("512KB cap applies to declared length, actual bytes, and multibyte payloads", async () => {
  for (const oversized of [
    request(input(), { "content-length": String(MAX_BASKET_PROJECT_BYTES + 1) }),
    request({ ...input(), ignored: "x".repeat(MAX_BASKET_PROJECT_BYTES) }),
    request({ ...input(), ignored: "я".repeat(MAX_BASKET_PROJECT_BYTES / 2) }),
  ]) {
    const response = await handleBasketOrderQuote(oversized, dependencies);
    assert.equal(response.status, 413);
    assert.equal((await response.json()).price, null);
  }
});

test("rate limit has independent minute/day rules, retry-after and no priced response", async () => {
  let actualRules: { id: string; limit: number; windowMs: number }[] = [];
  const response = await handleBasketOrderQuote(request(input()), {
    key: () => "synthetic-client",
    limit: (key, rules) => {
      assert.equal(key, "synthetic-client"); actualRules = rules;
      return { allowed: false, limit: 60, remaining: 0, retryAfterSeconds: 43 };
    },
  });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "43");
  assert.deepEqual(actualRules.map(rule => rule.id), ["basket-order-quote-minute", "basket-order-quote-day"]);
  assert.ok(actualRules.every(rule => rule.limit > 0 && rule.windowMs > 0));
  assert.equal((await response.json()).price, null);
});

test("browser ready/rates/price/components cannot establish production evidence or trigger a fallback", async () => {
  const value = input();
  const clean = await (await handleBasketOrderQuote(request(value), dependencies)).json();
  const injected = structuredClone(value);
  Object.assign(injected, { state: "ready", price: 1, rates: { secretRate: .1 }, internalEvidence: { state: "ready" } });
  Object.assign(injected.positions[0], {
    state: "ready", price: 1,
    components: [{
      componentId: "synthetic-component", quantityPerBasket: 1,
      templateId: "PRIVATE-TEMPLATE", templateRevision: "PRIVATE-TEMPLATE-REVISION", materialId: "PRIVATE-MATERIAL", materialRevision: "PRIVATE-MATERIAL-REVISION", thicknessMm: 1,
      finishId: "PRIVATE-FINISH", finishRevision: "PRIVATE-FINISH-REVISION",
      state: "ready", flatPatternRevision: "fake-ready", analysisRevision: "fake-ready", price: 1,
    }],
  });
  const response = await handleBasketOrderQuote(request(injected), dependencies);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.state, "incomplete");
  assert.equal(body.price, null);
  assert.equal(body.positions[0].price, null);
  assert.ok(body.positions[0].reasons.includes("flat-pattern-missing"));
  assert.ok(body.positions[0].reasons.includes("component-analysis-missing"));
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE-|secretRate|fake-ready|rubPer|analysisGroups/);
  const extraneousOnly = { ...value, price: 1, state: "ready", internalEvidence: { state: "ready" } };
  assert.deepEqual(await (await handleBasketOrderQuote(request(extraneousOnly), dependencies)).json(), clean);
});

test("quantity, removal, reorder and revision changes produce current correlated fingerprints", async () => {
  const original = await (await handleBasketOrderQuote(request(input()), dependencies)).json();
  for (const change of [
    (value: ReturnType<typeof input>) => { value.positions[0].brief.quantity += 1; },
    (value: ReturnType<typeof input>) => { value.positions.pop(); },
    (value: ReturnType<typeof input>) => { value.positions.reverse(); },
    (value: ReturnType<typeof input>) => { value.orderRevision += 1; },
  ]) {
    const value = input(); change(value); value.requestId = "new-request";
    const body = await (await handleBasketOrderQuote(request(value), dependencies)).json();
    assert.notEqual(body.orderFingerprint, original.orderFingerprint);
    assert.equal(body.orderRevision, value.orderRevision);
    assert.equal(body.requestId, "new-request");
  }
});

test("unexpected server failures expose neither private paths nor partial order data", async () => {
  const response = await handleBasketOrderQuote(request(input()), { ...dependencies, key: () => { throw Error("/secret/private-rate-book.json rates=999"); } });
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.doesNotMatch(body, /secret|999|PRIVATE-|rate-book/);
  assert.equal(JSON.parse(body).price, null);
});

test("public route is node-only and does not import a CAD or private price fallback", () => {
  const route = readFileSync(new URL("../app/api/basket-order-quote/route.ts", import.meta.url), "utf8");
  assert.match(route, /runtime\s*=\s*["']nodejs["']/);
  assert.match(route, /handleBasketOrderQuote\(request\)/);
  const handler = readFileSync(new URL("../lib/server/instant-quote/basket-order-handler.ts", import.meta.url), "utf8");
  assert.match(handler, /import ["']server-only["']/);
  assert.doesNotMatch(handler, /basketConfiguredPrice|basketVolumePrice|loadPrivateBasketRates|calculateProject|analyzeCad|runConfidential/);
});
