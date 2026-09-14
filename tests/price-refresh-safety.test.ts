import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TRUSTED_METAL_PRICE_SOURCES } from "../lib/instant-quote/material-price-feed";

test("Atlantik automatic source scope matches the currently verified parser", () => {
  const source = TRUSTED_METAL_PRICE_SOURCES.find((item) => item.id === "atlantik-smolensk");
  assert.ok(source);
  assert.deepEqual(source.materials, ["hot", "cold", "zinc"]);
  assert.equal(source.enabled, true);
});

test("supplier refresh is dry-run unless commit is explicit", () => {
  const route = readFileSync("app/api/internal/online-order/refresh-prices/route.ts", "utf8");
  const service = readFileSync("lib/server/instant-quote/refresh-atlantik-prices.ts", "utf8");

  assert.match(route, /searchParams\.get\("commit"\) === "1"/);
  assert.match(route, /persist: commit/);
  assert.match(service, /const persist = options\.persist === true/);
  assert.doesNotMatch(route, /rows:\s*result\./);
});

test("cron helper sends its bearer token only to loopback", () => {
  const script = readFileSync("scripts/refresh-steel-product-prices.mjs", "utf8");
  assert.match(script, /http:\/\/127\.0\.0\.1:/);
  assert.doesNotMatch(script, /PRICE_REFRESH_URL/);
  assert.match(script, /args\.has\("--commit"\)/);
});
