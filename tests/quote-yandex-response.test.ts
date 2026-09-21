import assert from "node:assert/strict";
import test from "node:test";
import { quoteCompletionEndpoint, YANDEX_QUOTE_COMPLETION_ENDPOINT, readYandexCompletion, yandexCompletionText } from "../lib/server/quote-engine/yandex-response";
import { QUOTE_REVIEW_STAGES, reviewQuoteStages, reviewStagesWithYandex, type StageEvidence } from "../lib/server/quote-engine/stage-review";
import { proposeWithYandex, extractWithAi } from "../lib/server/quote-engine/ai-extraction";
import { emptyLeadState } from "../lib/assistant/state";

const alternative = (text = "{}") => ({ status: "ALTERNATIVE_STATUS_FINAL", message: { role: "assistant", text } });
function stageReply(): string {
  return JSON.stringify({ stages: QUOTE_REVIEW_STAGES.map((stage) => ({ stage, status: stage === "market" ? "not-applicable" : "pass", codes: [] })) });
}
function evidence(): StageEvidence {
  return {
    classification: { calculator: "metal-parts" },
    inputs: { parameters: { widthMm: 100, heightMm: 100, thicknessMm: 1, quantity: 10 } },
    geometry: { deterministicCheckPassed: true, method: "protected-cad-analysis" },
    operations: { requestedScope: ["laser-cutting"], pricedScope: ["material", "laser-cutting"] },
    calculation: { complete: true, deterministicCheckPassed: true },
    market: { available: false },
    pricing: { calculatedRubBatch: 1000, finalRubBatch: 1000, floorProtected: true },
    disclaimer: { clientMessage: "Предварительный расчёт. Не является офертой." },
  };
}
async function configuredFixture(run: () => Promise<void>): Promise<void> {
  const values: Record<string, string | undefined> = {
    STEEL_PRODUCT_PAID_SERVICES_ALLOWED: "true", YANDEX_AI_ENABLED: "true", YANDEX_AI_API_KEY: "synthetic-test-key",
    YANDEX_AI_FOLDER_ID: "fixture", YANDEX_AI_MODEL_URI: "gpt://fixture/yandexgpt/stable",
    YANDEX_AI_ENDPOINT: undefined,
  };
  const old = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  try { await run(); }
  finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test("current and legacy Yandex completion envelopes are accepted", () => {
  assert.equal(yandexCompletionText({ alternatives: [alternative()] }), "{}");
  assert.equal(yandexCompletionText({ result: { alternatives: [alternative()] } }), "{}");
  assert.equal(yandexCompletionText({ alternatives: [{ message: { text: " {} " } }] }), "{}");
});

for (const status of ["ALTERNATIVE_STATUS_TRUNCATED_FINAL", "ALTERNATIVE_STATUS_PARTIAL", "ALTERNATIVE_STATUS_CONTENT_FILTER", "UNKNOWN"]) {
  test(`a ${status} completion cannot approve a quote`, () => {
    assert.equal(yandexCompletionText({ alternatives: [{ ...alternative(), status }] }), null);
  });
}

test("errors, conflicting wrappers, multiple alternatives and tool calls are rejected", () => {
  for (const value of [
    { error: { message: "failure" }, alternatives: [alternative()] },
    { alternatives: [alternative()], result: { alternatives: [alternative("{\"x\":1}")] } },
    { alternatives: [alternative(), alternative()] },
    { alternatives: [] },
    { alternatives: [{ message: { text: 1 } }] },
    { alternatives: [{ message: { role: "user", text: "{}" } }] },
    { alternatives: [{ message: { text: "{}", toolCallList: {} } }] },
  ]) assert.equal(yandexCompletionText(value), null);
});

test("only explicitly approved official endpoints may receive an API key", () => {
  assert.equal(quoteCompletionEndpoint({}), YANDEX_QUOTE_COMPLETION_ENDPOINT);
  assert.equal(quoteCompletionEndpoint({ YANDEX_AI_ENDPOINT: "https://ai.api.cloud.yandex.net/foundationModels/v1/completion" }), "https://ai.api.cloud.yandex.net/foundationModels/v1/completion");
  for (const endpoint of [
    "http://127.0.0.1/completion", "https://example.test/completion",
    `${YANDEX_QUOTE_COMPLETION_ENDPOINT}?redirect=other`,
    "https://llm.api.cloud.yandex.net.example.test/foundationModels/v1/completion",
    "https://user:password@llm.api.cloud.yandex.net/foundationModels/v1/completion",
  ]) assert.equal(quoteCompletionEndpoint({ YANDEX_AI_ENDPOINT: endpoint }), null);
});

test("bounded reader accepts UTF-8 and rejects malformed or oversized provider bodies", async () => {
  assert.equal(await readYandexCompletion(new Response(JSON.stringify({ alternatives: [alternative("{\"text\":\"Пример\"}")] }))), '{"text":"Пример"}');
  assert.equal(await readYandexCompletion(new Response("not json")), null);
  assert.equal(await readYandexCompletion(new Response("x", { status: 503 })), null);
  assert.equal(await readYandexCompletion(new Response("x", { headers: { "content-length": "65537" } })), null);
  assert.equal(await readYandexCompletion(new Response("x".repeat(65537))), null);
  assert.equal(await readYandexCompletion(new Response(new Uint8Array([0xff, 0xfe]))), null);
});

test("real stage adapter requests JSON and accepts current top-level response without external network", async (t) => {
  await configuredFixture(async () => {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
      calls++;
      assert.equal(url, YANDEX_QUOTE_COMPLETION_ENDPOINT);
      assert.equal(init.redirect, "error");
      const body = JSON.parse(String(init.body));
      assert.equal(body.jsonObject, true);
      assert.equal(body.completionOptions.stream, false);
      assert.deepEqual(Object.keys(JSON.parse(body.messages[1].text)), [...QUOTE_REVIEW_STAGES]);
      return new Response(JSON.stringify({ alternatives: [alternative(stageReply())] }));
    });
    assert.equal((await reviewQuoteStages(evidence())).status, "passed");
    assert.equal(calls, 1);
  });
});

test("real extraction adapter accepts current envelope and requests strict JSON", async (t) => {
  await configuredFixture(async () => {
    t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
      assert.equal(url, YANDEX_QUOTE_COMPLETION_ENDPOINT);
      assert.equal(init.redirect, "error");
      assert.equal(JSON.parse(String(init.body)).jsonObject, true);
      return new Response(JSON.stringify({ alternatives: [alternative('{"quantity":{"value":"10 шт","quote":"10 шт"}}')] }));
    });
    const result = await extractWithAi(emptyLeadState(), "10 шт");
    assert.equal(result.state.quantity, "10 шт");
  });
});

test("oversized requests are refused before any provider request instead of truncating evidence", async (t) => {
  await configuredFixture(async () => {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error("Must not call provider"); });
    const large = evidence(); large.operations.extra = "x".repeat(19000);
    assert.equal(await reviewStagesWithYandex(large), null);
    assert.equal(await proposeWithYandex("x".repeat(19000), emptyLeadState()), null);
    assert.equal(calls, 0);
  });
});

test("injected extraction provider cannot mutate previously agreed fields", async () => {
  const state = { ...emptyLeadState(), quantity: "100 шт" };
  const before = JSON.stringify(state);
  await extractWithAi(state, "уточнение", async (_message, copy) => { copy.quantity = "1 шт"; return null; });
  assert.equal(JSON.stringify(state), before);
});
