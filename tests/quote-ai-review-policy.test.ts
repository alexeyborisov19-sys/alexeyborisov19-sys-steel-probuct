import assert from "node:assert/strict";
import test from "node:test";
import { quoteAiReviewRequired } from "../lib/server/quote-engine/session-turn";

test("production requires AI review by default", () => {
  assert.equal(quoteAiReviewRequired({ NODE_ENV: "production" }), true);
});
test("a malformed production setting never disables AI review", () => {
  assert.equal(quoteAiReviewRequired({ NODE_ENV: "production", STEEL_PRODUCT_QUOTE_AI_REVIEW_REQUIRED: "invalid" }), true);
});
test("only an explicit operator false setting enables the optional-review fallback", () => {
  assert.equal(quoteAiReviewRequired({ NODE_ENV: "production", STEEL_PRODUCT_QUOTE_AI_REVIEW_REQUIRED: "false" }), false);
});
test("development can run deterministic tests without credentials, while explicit true still requires review", () => {
  assert.equal(quoteAiReviewRequired({ NODE_ENV: "test" }), false);
  assert.equal(quoteAiReviewRequired({ NODE_ENV: "test", STEEL_PRODUCT_QUOTE_AI_REVIEW_REQUIRED: "true" }), true);
});
