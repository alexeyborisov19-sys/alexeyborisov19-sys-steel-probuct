import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyLeadState } from "../lib/assistant/state";
import type { AssistantSession } from "../lib/assistant/types";
import { runSessionQuoteTurn } from "../lib/server/quote-engine/session-turn";
import { quoteSnapshotForLead } from "../lib/server/quote-engine/quote-snapshot";
import { reviewCassetteAreaCalculation } from "../lib/server/quote-engine/cassette-area-review";
import { specializedMarketContextFromRegistry } from "../lib/server/quote-engine/specialized-market-context";
import { readPrivateMarketRegistry } from "../lib/server/quote-engine/private-market-registry";
import { hydrateMarketRegistry, offersFromFeed, publicFeedAddress, publicFeedUrl } from "../lib/server/quote-engine/trusted-market-feeds";
import { decideMarketFloor, type MarketQuoteSpec } from "../lib/quote-engine/market-floor";
import { QUOTE_REVIEW_STAGES } from "../lib/server/quote-engine/stage-review";
import { assistantCrmWebhook, deliverAssistantLeadToCrm, type AssistantCrmLead } from "../lib/server/crm/assistant-lead-delivery";

// Synthetic prices, contacts and source data. No paid provider or real client is contacted.
const basis = { material: "zinc", finish: "none", scope: ["material", "cassette-forming"], vat: "included" as const, vatRatePct: 20 };
const areaQuery = { kind: "facade-area" as const, thicknessMm: 0.7, widthMm: 1170, heightMm: 545,
  quantity: 1, cassetteType: "open" as const, pricedAreaM2: 100 };
const areaSpec: MarketQuoteSpec = { calculator: "metal-cassettes", product: "facade-area", ...basis,
  thicknessMm: 0.7, widthMm: 1170, heightMm: 545, quantity: 1, cassetteType: "open", pricedAreaM2: 100 };
const input = { mode: "area" as const, type: "open" as const, thickness: "0.7" as const, areaM2: 100 };
function offers(specification: MarketQuoteSpec = areaSpec, price = 3000) {
  return [0, 1, 2].map((n) => ({ supplierId: `fixture-${n}`, sourceUrl: `https://supplier-${n}.example.com/prices.json`,
    capturedAt: new Date().toISOString(), checkedAt: new Date().toISOString(), sourceDate: new Date().toISOString(),
    checkedBy: "fixture", evidence: "Synthetic structured source", specification, priceRub: price + n * 10,
    priceUnit: "per-m2", minQuantity: 1, maxQuantity: 1, minAreaM2: 50, maxAreaM2: 200,
    minimumBatchRub: 0, currency: "RUB", priceKind: "exact", includesDelivery: false, includesInstallation: false }));
}
const passed = () => JSON.stringify({ stages: QUOTE_REVIEW_STAGES.map((stage) => ({ stage, status: "pass", codes: [] })) });

test("cassette area audit uses the same verified mean and calculation floor", async () => {
  const context = specializedMarketContextFromRegistry(areaQuery, { version: "verified-market-offers-v1", priceBasis: { "facade-area": basis }, offers: offers() });
  const result = await reviewCassetteAreaCalculation(input, { marketContext: context, requireAiReview: true, aiReviewCaller: async () => passed() });
  assert.equal(result.publicResult.approximateTotalRub, 301000);
  assert.equal(result.publicResult.marketVerified, true);
  assert.equal(result.publicResult.reviewStatus, "passed");
  assert.equal(result.internal.review.stages.length, 8);
  assert.doesNotMatch(JSON.stringify(result.publicResult), /supplier-|sourceUrl|checkedBy|priceDecision|costRub/);
});
test("area rates below the calculator cannot lower the final price", async () => {
  const result = await reviewCassetteAreaCalculation(input, { marketContext: { status: "loaded", target: areaSpec, offers: offers(areaSpec, 1000) }, aiReviewCaller: async () => passed() });
  assert.equal(result.publicResult.approximateTotalRub, 176400);
  assert.equal(result.internal.decision.status, "calculated-floor");
});
test("a model failure cannot publish a supposedly AI-reviewed area price", async () => {
  const result = await reviewCassetteAreaCalculation(input, { requireAiReview: true, aiReviewCaller: async () => null });
  assert.equal(result.publicResult.approximateTotalRub, null);
  assert.equal(result.publicResult.approximateRateRubM2, null);
  assert.equal(result.publicResult.marketVerified, false);
  assert.equal(result.publicResult.reviewStatus, "needs-review");
});
test("an unconfigured area model is explicitly disclosed instead of being reported as passed", async () => {
  const result = await reviewCassetteAreaCalculation(input, { requireAiReview: false, aiReviewCaller: null });
  assert.equal(result.publicResult.approximateTotalRub, 176400);
  assert.equal(result.publicResult.reviewStatus, "unavailable");
  assert.match(result.publicResult.message, /ИИ-проверка не выполнена/);
});
test("an area quote cannot consume piece prices or a different priced area", async () => {
  for (const modified of [offers().map((offer) => ({ ...offer, priceUnit: "per-piece" })), offers().map((offer) => ({ ...offer, minAreaM2: undefined }))]) {
    assert.equal(decideMarketFloor(1000, areaSpec, modified).marketMeanRubBatch, null);
  }
  const result = await reviewCassetteAreaCalculation(input, { aiReviewCaller: null,
    marketContext: { status: "loaded", target: { ...areaSpec, pricedAreaM2: 200 }, offers: offers() } });
  assert.equal(result.publicResult.marketVerified, false);
});
test("CAD market identity cannot be replaced by matching bounding dimensions", () => {
  const spec: MarketQuoteSpec = { ...areaSpec, calculator: "metal-parts", product: "cad-part", cassetteType: null,
    quantity: 10, drawingSha256: "a".repeat(64), processSignature: "b".repeat(64), pricedAreaM2: undefined };
  const compatible = offers(spec, 1000).map((offer) => ({ ...offer, priceUnit: "per-piece", minQuantity: 1, maxQuantity: 100 }));
  assert.equal(decideMarketFloor(5000, spec, compatible).marketMeanRubBatch, 10100);
  for (const changed of [{ drawingSha256: "c".repeat(64) }, { processSignature: "d".repeat(64) }, { product: "flat-rectangle" as const }]) {
    assert.equal(decideMarketFloor(5000, spec, compatible.map((offer) => ({ ...offer, specification: { ...spec, ...changed } }))).marketMeanRubBatch, null);
  }
});
for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "198.18.0.1", "203.0.113.1", "::1", "::ffff:127.0.0.1", "240.1.1.1"]) {
  test(`feed egress rejects ${ip}`, () => assert.equal(publicFeedAddress(ip), false));
}
for (const url of ["http://supplier.ru/prices", "https://127.0.0.1/prices", "https://evil.local/feed", "https://user:password@supplier.ru/feed", "https://supplier.ru:8443/feed", "file:///etc/passwd"]) {
  test(`untrusted feed URL rejected: ${url}`, () => assert.equal(publicFeedUrl(url), null));
}
test("feed checks preserve the supplier's publication date but not forged verification metadata", () => {
  const row = { ...offers()[0], supplierId: "forged", sourceUrl: "https://other.ru", checkedBy: "model-said-so" };
  const result = offersFromFeed({ version: "market-source-offers-v1", offers: [row] }, { supplierId: "operator-id", url: "https://supplier.example.com/feed" }) as Array<Record<string, unknown>>;
  assert.equal(result[0].supplierId, "operator-id");
  assert.equal(result[0].sourceDate, row.sourceDate);
  assert.equal(result[0].sourceUrl, "https://supplier.example.com/feed");
  assert.match(String(result[0].checkedBy), /^structured-source-v1:[a-f0-9]{64}$/);
  assert.match(String(result[0].evidence), /Synthetic structured source/);
});
test("source fetching stays opt-in and never fetches arbitrary search candidates", async () => {
  const registry = { version: "verified-market-offers-v1", offers: [], trustedFeeds: [{ supplierId: "fixture", url: "https://supplier.example.com/feed" }] };
  let calls = 0;
  const reader = async () => { calls++; return { version: "market-source-offers-v1", offers: [offers()[0]] }; };
  assert.equal(await hydrateMarketRegistry(registry, {}, reader), registry);
  assert.equal(calls, 0);
  const result = await hydrateMarketRegistry(registry, { STEEL_PRODUCT_MARKET_SOURCE_FETCH_ENABLED: "true" }, reader) as typeof registry;
  assert.equal(calls, 1); assert.equal(result.offers.length, 1);
});
test("private registry rejects a file under the release tree and reads a protected external file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "quote-registry-test-"));
  try {
    const path = join(dir, "market.json");
    await writeFile(path, '{"version":"verified-market-offers-v1","offers":[]}', { mode: 0o600 });
    assert.equal((await readPrivateMarketRegistry({ STEEL_PRODUCT_MARKET_REFERENCE_FILE: path })).status, "loaded");
    assert.equal((await readPrivateMarketRegistry({ STEEL_PRODUCT_MARKET_REFERENCE_FILE: join(process.cwd(), "package.json") })).status, "unavailable");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("quote snapshots are private immutable copies and are invalidated by a new incomplete turn", async () => {
  const session: AssistantSession = { id: "fixture", ownerKey: "fixture", state: emptyLeadState(), history: [], createdAt: Date.now(), updatedAt: Date.now() };
  await runSessionQuoteTurn(session, "100 кассет открытого типа 600×1200 мм толщина 1,2 мм", "metal-cassettes");
  const snapshot = quoteSnapshotForLead(session); assert.ok(snapshot);
  assert.equal(snapshot.record?.finalPriceRubBatch, 165600);
  snapshot.state.quantity = "999 шт";
  assert.equal(session.state.quantity, "100 шт");
  assert.equal(quoteSnapshotForLead(undefined), null);
  await runSessionQuoteTurn(session, "толщина -2 мм");
  assert.equal(quoteSnapshotForLead(session), null);
});
const env = { BITRIX_WEBHOOK_URL: "https://fixture.bitrix24.ru/rest/1/fixture_token", BITRIX_INTEGRATION_ENABLED: "true", BITRIX_DATA_TRANSFER_APPROVED: "true" };
const lead: AssistantCrmLead = { requestId: "SP-AI-20260921-ABCD1234", name: "Fixture", phone: null, email: "fixture@example.test", company: null,
  summary: "Synthetic order", quoteSnapshot: null, consent: { personalData: true } };
test("CRM stays off without both the operator's transfer approval and configured webhook", async () => {
  let calls = 0; const caller = async () => { calls++; return []; };
  assert.equal((await deliverAssistantLeadToCrm(lead, {}, caller)).status, "not-approved");
  assert.equal((await deliverAssistantLeadToCrm(lead, { ...env, BITRIX_INTEGRATION_ENABLED: "false" }, caller)).status, "not-configured");
  assert.equal(calls, 0);
});
test("CRM correlates a site request without overwriting an unrelated order by phone", async () => {
  const methods: string[] = [];
  const result = await deliverAssistantLeadToCrm(lead, env, async (method, data) => {
    methods.push(method);
    if (method === "crm.lead.list") { assert.equal((data.filter as Record<string, unknown>)["=ORIGIN_ID"], lead.requestId); return []; }
    assert.doesNotMatch(JSON.stringify(data), /costRub|rates|sourceUrl|pricingScenarios|private/); return 42;
  });
  assert.deepEqual(methods, ["crm.lead.list", "crm.lead.add"]);
  assert.equal(result.status, "delivered"); assert.equal(result.leadId, 42);
});
test("a CRM retry confirms the existing request instead of creating another", async () => {
  let calls = 0;
  const result = await deliverAssistantLeadToCrm(lead, env, async (method) => {
    calls++; assert.equal(method, "crm.lead.list"); return [{ ID: "42" }];
  });
  assert.equal(calls, 1); assert.equal(result.leadId, 42);
});
test("CRM timeout is not reported as successful delivery", async () => {
  assert.equal((await deliverAssistantLeadToCrm(lead, env, async () => { throw new Error("Synthetic timeout"); })).status, "needs-retry");
  assert.equal(assistantCrmWebhook({ BITRIX_WEBHOOK_URL: "https://arbitrary.example.com/rest/1/token" }), null);
  assert.equal(assistantCrmWebhook({ BITRIX_WEBHOOK_URL: "https://fixture.bitrix24.ru.evil.com/rest/1/token" }), null);
});
