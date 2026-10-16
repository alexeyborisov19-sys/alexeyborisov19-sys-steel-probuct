import assert from "node:assert/strict";
import test from "node:test";
import {
  completeLocally,
  localAiConfigured,
  localAiTimeoutMs,
} from "../lib/server/quote-engine/local-completion";

const digest = "a".repeat(64);
const env = {
  STEEL_PRODUCT_LOCAL_AI_ENABLED: "true",
  STEEL_PRODUCT_LOCAL_AI_MODEL: "qwen3.5:9b",
  STEEL_PRODUCT_LOCAL_AI_DIGEST: digest,
  STEEL_PRODUCT_LOCAL_AI_OFFLINE_VERIFIED: "true",
};

test("local neural backend is off unless digest, model and offline approval are present", () => {
  assert.equal(localAiConfigured({ ...env, STEEL_PRODUCT_LOCAL_AI_MODEL: "qwen3.5:latest" }), false);
  assert.equal(localAiConfigured({ ...env, STEEL_PRODUCT_LOCAL_AI_MODEL: "qwen3.5:9b-cloud" }), false);
  assert.equal(localAiConfigured({ ...env, STEEL_PRODUCT_LOCAL_AI_DIGEST: "unknown" }), false);
  assert.equal(localAiConfigured({ ...env, STEEL_PRODUCT_LOCAL_AI_OFFLINE_VERIFIED: "false" }), false);
  assert.equal(localAiConfigured({ ...env, STEEL_PRODUCT_LOCAL_AI_ENABLED: "false" }), false);
  assert.equal(localAiConfigured(env), true);
});

test("bounded local inference timeout supports CPU/GPU cold starts", () => {
  assert.equal(localAiTimeoutMs(env), 45_000);
  assert.equal(localAiTimeoutMs({ ...env, STEEL_PRODUCT_LOCAL_AI_TIMEOUT_MS: "12000" }), 15_000);
  assert.equal(localAiTimeoutMs({ ...env, STEEL_PRODUCT_LOCAL_AI_TIMEOUT_MS: "60000" }), 60_000);
  assert.equal(localAiTimeoutMs({ ...env, STEEL_PRODUCT_LOCAL_AI_TIMEOUT_MS: "999999" }), 90_000);
  assert.equal(localAiTimeoutMs({ ...env, STEEL_PRODUCT_LOCAL_AI_TIMEOUT_MS: "-1" }), 45_000);
});

test("Qwen inference is only sent to localhost after manifest digest check", async () => {
  const calls: string[] = [];
  const request = (async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/api/tags")) {
      return new Response(JSON.stringify({ models: [{
        name: "qwen3.5:9b", digest,
        size: 7_000_000_000, details: { format: "gguf" },
      }] }), { status: 200 });
    }
    assert.equal(url, "http://127.0.0.1:11434/api/generate");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.model, "qwen3.5:9b");
    assert.equal(body.stream, false);
    assert.equal(body.format, "json");
    assert.equal(body.think, false);
    assert.equal(body.options.temperature, 0);
    return new Response(JSON.stringify({
      response: JSON.stringify({ answer: "Параметры требуют проверки инженером." }),
      done: true, done_reason: "stop",
    }), { status: 200 });
  }) as typeof fetch;

  const actual = await completeLocally("Системная инструкция", '{"question":"Что проверить?"}', 200, env, request);
  assert.equal(JSON.parse(actual ?? "{}").answer, "Параметры требуют проверки инженером.");
  assert.deepEqual(calls, ["http://127.0.0.1:11434/api/tags", "http://127.0.0.1:11434/api/generate"]);
});

test("different installed digest prevents any neural inference", async () => {
  const calls: string[] = [];
  const request = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ models: [{
      name: "qwen3.5:9b", digest: "b".repeat(64),
      size: 7_000_000_000, details: { format: "gguf" },
    }] }), { status: 200 });
  }) as typeof fetch;
  assert.equal(await completeLocally("rules", "request", 100, env, request), null);
  assert.equal(calls.length, 1, "no model generation after a mismatched digest");
});
