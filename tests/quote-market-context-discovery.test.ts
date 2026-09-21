import assert from "node:assert/strict";
import test from "node:test";
import { marketContextFromRegistry, loadQuoteMarketContext } from "../lib/server/quote-engine/market-context";
import { discoverQuoteMarket, marketDiscoveryQuery, parseDiscoveredSources } from "../lib/server/quote-engine/market-discovery";

const plan = { calculator: "metal-parts" as const, input: { materialId: "zinc" as const, thicknessMm: 2, widthMm: 500, heightMm: 400, quantity: 10 } };
function registry(basis = {}) {
  return { version: "verified-market-offers-v1", offers: [], priceBasis: {
    "metal-parts": { finish: "none", scope: ["material", "laser-cutting"], vat: "included", vatRatePct: 22, ...basis },
  } };
}
test("market dimensions and quantity come from the actual calculator plan", () => {
  const context = marketContextFromRegistry(plan, undefined, registry({ widthMm: 999, quantity: 999 }));
  assert.equal(context.status, "loaded");
  assert.equal(context.target?.widthMm, 500);
  assert.equal(context.target?.quantity, 10);
});
test("market context does not invent missing tax treatment", () => {
  assert.equal(marketContextFromRegistry(plan, undefined, registry({ vat: undefined })).status, "basis-mismatch");
});
test("a reference registry cannot relabel the included-VAT parts price as tax-exclusive", () => {
  assert.equal(marketContextFromRegistry(plan, undefined, registry({ vat: "excluded" })).status, "basis-mismatch");
});
test("a registry cannot add unpriced powder coating to a flat laser estimate", () => {
  assert.equal(marketContextFromRegistry(plan, undefined, registry({ finish: "powder:7024" })).status, "basis-mismatch");
});
test("an absent registry is explicitly not configured", async () => {
  assert.equal((await loadQuoteMarketContext(plan, undefined, { NODE_ENV: "test" })).status, "not-configured");
});
test("relative and missing reference paths fail without returning filesystem details", async () => {
  for (const path of ["public/market.json", "/missing-test-reference-market-file.json"]) {
    const context = await loadQuoteMarketContext(plan, undefined, { NODE_ENV: "test", STEEL_PRODUCT_MARKET_REFERENCE_FILE: path });
    assert.equal(context.status, "unavailable");
    assert.doesNotMatch(JSON.stringify(context), /public|missing-test/);
  }
});
test("search query uses normalized product fields, not customer conversation", () => {
  const query = marketDiscoveryQuery(plan);
  assert.match(query, /500х400/);
  assert.match(query, /10 шт/);
  assert.ok(query.length <= 400);
});
test("search parsing extracts bounded HTTPS candidates and never treats snippets as quotes", () => {
  const parsed = parseDiscoveredSources('<doc><url>https://one.test/a?a=1&amp;b=2</url><title>Цена &lt;b&gt;100&lt;/b&gt;</title></doc>'
    + '<doc><url>http://two.test/</url></doc><doc><url>https://user:pass@three.test/</url></doc>'
    + '<doc><url>https://one.test/a?a=1&amp;b=2</url></doc>');
  assert.deepEqual(parsed, [{ url: "https://one.test/a?a=1&b=2", title: "Цена 100" }]);
});
test("disabled discovery performs no network request", async () => {
  const response = await discoverQuoteMarket(plan, { NODE_ENV: "test" }, async () => { throw new Error("must not request"); });
  assert.equal(response.status, "not-configured");
});
test("configured discovery calls the official Search API and decodes base64 XML", async () => {
  let calls = 0;
  const response = await discoverQuoteMarket(plan, {
    NODE_ENV: "test", STEEL_PRODUCT_PAID_SERVICES_ALLOWED: "true", STEEL_PRODUCT_MARKET_SEARCH_ENABLED: "true", YANDEX_SEARCH_API_KEY: "synthetic-test-key", YANDEX_SEARCH_FOLDER_ID: "synthetic-folder",
  }, async (url, options) => {
    calls += 1;
    assert.equal(url, "https://searchapi.api.cloud.yandex.net/v2/web/search");
    assert.equal(options?.redirect, "error");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.query.searchType, "SEARCH_TYPE_RU");
    assert.equal(body.query.familyMode, "FAMILY_MODE_STRICT");
    assert.equal(body.folderId, "synthetic-folder");
    return new Response(JSON.stringify({ rawData: Buffer.from('<doc><url>https://example.test/quote</url><title>Прайс</title></doc>').toString("base64") }), { status: 200 });
  });
  assert.equal(calls, 1);
  assert.equal(response.status, "completed");
  assert.equal(response.candidates.length, 1);
});
test("upstream failures never turn into empty successful search claims", async () => {
  const response = await discoverQuoteMarket(plan, {
    NODE_ENV: "test", STEEL_PRODUCT_PAID_SERVICES_ALLOWED: "true", STEEL_PRODUCT_MARKET_SEARCH_ENABLED: "true", YANDEX_SEARCH_API_KEY: "synthetic", YANDEX_SEARCH_FOLDER_ID: "synthetic",
  }, async () => new Response("failure", { status: 503 }));
  assert.equal(response.status, "unavailable");
});
