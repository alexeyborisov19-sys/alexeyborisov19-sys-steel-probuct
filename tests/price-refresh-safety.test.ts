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

test("the timer's refresh holds no secret, because it makes no request", () => {
  const script = readFileSync("scripts/refresh-steel-product-prices.ts", "utf8");

  // The bearer token existed only so the server could authenticate to itself
  // over loopback. The refresh now calls the service in-process, so there is no
  // secret to hold, leak or rotate, and no request that could be pointed
  // anywhere other than where it was meant to go.
  assert.doesNotMatch(script, /STEEL_PRODUCT_PRICE_REFRESH_TOKEN/);
  assert.doesNotMatch(script, /fetch\(/);
  assert.doesNotMatch(script, /127\.0\.0\.1|localhost|https?:\/\//);
  assert.match(script, /refreshAtlantikPriceSnapshot/);

  // Persistence still requires the explicit flag, as it did over HTTP.
  assert.match(script, /args\.has\("--commit"\)/);
  assert.match(script, /persist: commit/);

  // The project declares no module type, so tsx transpiles this to CommonJS,
  // where top-level await does not exist. The timer failed its dry run on
  // exactly that, so the work stays inside main().
  assert.doesNotMatch(script, /^await /m);
  assert.doesNotMatch(script, /^const \w+ = await /m);
  assert.match(script, /^main\(\)\.then\(/m);
});

test("the timer unit runs the refresh the one way that resolves server-only", () => {
  const unit = readFileSync("deploy/systemd/steelprodukt-metal-prices.service", "utf8");

  // The refresh imports server-only modules, which throw outside Next.js
  // unless the react-server condition is set. Without it the unit would fail
  // on every run, so the flag is part of the contract, not a detail.
  assert.match(unit, /^ExecStart=.*--conditions react-server .*--import tsx .*refresh-steel-product-prices\.ts --commit$/m);

  // The server modules import each other through the project's "@/" alias,
  // which Next resolves from tsconfig and a plain node process does not know.
  // Without the hook the timer dies on its first import.
  assert.match(unit, /^ExecStart=.*repo-alias-hook\.mjs.*$/m);
});

test("a dry run explains why it could not start, a commit run does not", () => {
  const script = readFileSync("scripts/refresh-steel-product-prices.ts", "utf8");

  // A dry run writes nothing and is read by whoever is installing the timer,
  // so it says what failed. A commit run's output is not being read by anyone
  // who can act on it, so it stays terse and discloses no paths.
  assert.match(script, /commit\s*\?[\s\S]*error\.name[\s\S]*:[\s\S]*error\.message/);
});
