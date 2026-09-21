import assert from "node:assert/strict";
import test from "node:test";
import { quoteAiReviewRequired } from "../lib/server/quote-engine/session-turn";

test("deployment preserves a disclosed deterministic service while the paid provider is not enabled", () => {
  assert.equal(quoteAiReviewRequired({ NODE_ENV: "production" }), false);
  assert.equal(quoteAiReviewRequired({ NODE_ENV: "production", YANDEX_AI_ENABLED: "false" }), false);
});
test("enabling AI in production requires review even when credentials are missing", () => {
  assert.equal(quoteAiReviewRequired({ NODE_ENV: "production", STEEL_PRODUCT_PAID_SERVICES_ALLOWED: "true", YANDEX_AI_ENABLED: "true" }), true);
});
test("a malformed explicit gate never silently disables verification", () => {
  assert.equal(quoteAiReviewRequired({ NODE_ENV: "production", STEEL_PRODUCT_QUOTE_AI_REVIEW_REQUIRED: "invalid" }), true);
});
test("an explicit operator override is honored", () => {
  assert.equal(quoteAiReviewRequired({ NODE_ENV: "production", STEEL_PRODUCT_PAID_SERVICES_ALLOWED: "true", YANDEX_AI_ENABLED: "true", STEEL_PRODUCT_QUOTE_AI_REVIEW_REQUIRED: "false" }), false);
  assert.equal(quoteAiReviewRequired({ NODE_ENV: "production", STEEL_PRODUCT_QUOTE_AI_REVIEW_REQUIRED: "true" }), true);
});
test("test mode avoids external services unless the gate was explicitly requested", () => {
  assert.equal(quoteAiReviewRequired({ NODE_ENV: "test" }), false);
  assert.equal(quoteAiReviewRequired({ NODE_ENV: "test", STEEL_PRODUCT_QUOTE_AI_REVIEW_REQUIRED: "true" }), true);
});
