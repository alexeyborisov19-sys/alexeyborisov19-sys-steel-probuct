import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const analyticsSource = readFileSync("components/Analytics.tsx", "utf8");
const ecommerceSource = readFileSync("components/YandexEcommerce.tsx", "utf8");
const publicLayoutSource = readFileSync("app/(public)/layout.tsx", "utf8");

test("Yandex ecommerce is consent-gated and uses the canonical dataLayer container", () => {
  assert.match(analyticsSource, /window\.dataLayer = window\.dataLayer \|\| \[\]/);
  assert.match(analyticsSource, /ecommerce:\"dataLayer\"/);
  assert.match(ecommerceSource, /hasAnalyticsConsent\(\)/);
  assert.match(publicLayoutSource, /<YandexEcommerce \/>/);
});

test("B2B ecommerce reports catalog interest without inventing online sales", () => {
  assert.match(ecommerceSource, /impressions: products/);
  assert.match(ecommerceSource, /detail:\s*\{/);
  assert.doesNotMatch(ecommerceSource, /purchase:\s*\{/);
  assert.doesNotMatch(ecommerceSource, /add:\s*\{/);
  assert.doesNotMatch(ecommerceSource, /remove:\s*\{/);
  assert.doesNotMatch(ecommerceSource, /revenue:\s*/);
  assert.doesNotMatch(ecommerceSource, /price:\s*/);
});
