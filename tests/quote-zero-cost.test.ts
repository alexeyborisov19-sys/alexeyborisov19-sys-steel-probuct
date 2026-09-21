import assert from "node:assert/strict";
import test from "node:test";
import { paidServicesAllowed } from "../lib/server/quote-engine/service-policy";
import { localAiConfigured, completeLocally } from "../lib/server/quote-engine/local-completion";
import { modelCompletionConfigured, completeWithConfiguredModel } from "../lib/server/quote-engine/model-completion";
import { quoteAiReviewRequired } from "../lib/server/quote-engine/review-policy";
import { discoverQuoteMarket } from "../lib/server/quote-engine/market-discovery";

const paid = {
  NODE_ENV: "production" as const, YANDEX_AI_ENABLED: "true", YANDEX_AI_API_KEY: "fixture-key",
  YANDEX_AI_FOLDER_ID: "fixture-folder", YANDEX_AI_MODEL_URI: "gpt://fixture/model/v1",
};
const local = {
  NODE_ENV: "production" as const, STEEL_PRODUCT_LOCAL_AI_ENABLED: "true",
  STEEL_PRODUCT_LOCAL_AI_MODEL: "fixture-local:1b", STEEL_PRODUCT_LOCAL_AI_DIGEST: "a".repeat(64),
  STEEL_PRODUCT_LOCAL_AI_OFFLINE_VERIFIED: "true",
};
const plan = { calculator: "metal-cassettes" as const,
  input: { type: "open" as const, thickness: "1.2" as const, quantity: 10, moduleWidthMm: 600, moduleHeightMm: 1200 } };
const noNetwork: typeof fetch = async () => { throw new Error("No network expected"); };

for (const value of [undefined, "", "false", "1", "TRUE", "yes"]) {
  test(`spending switch is denied for ${String(value)}`, () => {
    assert.equal(paidServicesAllowed({ STEEL_PRODUCT_PAID_SERVICES_ALLOWED: value }), false);
  });
}
test("an API key and enabled service do not authorize paid model or search calls", async () => {
  let calls = 0;
  const request: typeof fetch = async () => { calls++; throw new Error("No call permitted"); };
  assert.equal(modelCompletionConfigured(paid), false);
  assert.equal(await completeWithConfiguredModel("system", { quantity: 10 }, 400, paid, request), null);
  const search = await discoverQuoteMarket(plan, { ...paid, STEEL_PRODUCT_MARKET_SEARCH_ENABLED: "true",
    YANDEX_SEARCH_API_KEY: "fixture", YANDEX_SEARCH_FOLDER_ID: "fixture" }, request);
  assert.equal(search.status, "not-configured");
  assert.equal(calls, 0);
  assert.equal(quoteAiReviewRequired(paid), false);
});
test("a separately selected local model requires the audit in production", () => {
  assert.equal(quoteAiReviewRequired(local), true);
  assert.equal(localAiConfigured(local), true);
});
for (const override of [
  { STEEL_PRODUCT_LOCAL_AI_OFFLINE_VERIFIED: "false" },
  { STEEL_PRODUCT_LOCAL_AI_DIGEST: "" },
  { STEEL_PRODUCT_LOCAL_AI_MODEL: "fixture:cloud" },
  { STEEL_PRODUCT_LOCAL_AI_MODEL: "fixture:latest" },
  { STEEL_PRODUCT_LOCAL_AI_MODEL: "https://remote.invalid/model" },
]) {
  test(`invalid local configuration sends nothing: ${JSON.stringify(override)}`, async () => {
    assert.equal(localAiConfigured({ ...local, ...override }), false);
    assert.equal(await completeLocally("system", "{}", 400, { ...local, ...override }, noNetwork), null);
  });
}
function fixtureRequest(change: Record<string, unknown> = {}, result: Record<string, unknown> = {}) {
  const calls: Array<{ url: string; options?: RequestInit }> = [];
  const request: typeof fetch = async (input, options) => {
    const url = String(input); calls.push({ url, options });
    if (url.endsWith("/api/tags")) return Response.json({ models: [{ name: local.STEEL_PRODUCT_LOCAL_AI_MODEL,
      digest: local.STEEL_PRODUCT_LOCAL_AI_DIGEST, size: 500_000_000, details: { format: "gguf" }, ...change }] });
    assert.equal(url, "http://127.0.0.1:11434/api/generate");
    assert.equal(options?.redirect, "error");
    assert.deepEqual(options?.headers, { "Content-Type": "application/json" });
    const body = JSON.parse(String(options?.body));
    assert.equal(body.stream, false); assert.equal(body.format, "json"); assert.equal(body.keep_alive, 0);
    assert.equal(body.model, local.STEEL_PRODUCT_LOCAL_AI_MODEL);
    return Response.json({ done: true, done_reason: "stop", response: '{"quantity":10}', ...result });
  };
  return { request, calls };
}
test("local adapter uses installed pinned weights and no credential or cloud request", async () => {
  const { request, calls } = fixtureRequest();
  const value = await completeWithConfiguredModel("Only JSON", { quantity: 10 }, 400, local, request);
  assert.equal(value, '{"quantity":10}');
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.url.startsWith("http://127.0.0.1:11434/")));
});
for (const change of [{ digest: "b".repeat(64) }, { size: 0 }, { details: { format: "remote" } }, { remote_host: "https://ollama.com" }]) {
  test(`unverified model cannot generate: ${JSON.stringify(change)}`, async () => {
    const { request, calls } = fixtureRequest(change);
    assert.equal(await completeLocally("Only JSON", "{}", 400, local, request), null);
    assert.equal(calls.length, 1);
  });
}
for (const result of [{ done: false }, { done_reason: "length" }, { response: "invalid JSON" }, { error: "unavailable" }]) {
  test(`incomplete local response is not an audit: ${JSON.stringify(result)}`, async () => {
    const { request } = fixtureRequest({}, result);
    assert.equal(await completeLocally("Only JSON", "{}", 400, local, request), null);
  });
}
test("local failure never switches to paid service, even with a paid key and opt-in present", async () => {
  let calls = 0;
  const request: typeof fetch = async (url) => { calls++; assert.ok(String(url).startsWith("http://127.0.0.1:11434/")); throw new Error("offline"); };
  assert.equal(await completeWithConfiguredModel("system", {}, 400,
    { ...paid, ...local, STEEL_PRODUCT_PAID_SERVICES_ALLOWED: "true" }, request), null);
  assert.equal(calls, 1);
});
test("oversized local prompts and token budgets do not initiate requests", async () => {
  assert.equal(await completeLocally("x".repeat(6001), "{}", 400, local, noNetwork), null);
  assert.equal(await completeLocally("system", "{}", 1201, local, noNetwork), null);
});
