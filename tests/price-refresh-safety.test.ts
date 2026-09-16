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

test("a dry run also explains why the refresh itself failed", () => {
  const script = readFileSync("scripts/refresh-steel-product-prices.ts", "utf8");

  // The refusal to disclose applied to the run that actually does the work
  // too, so an unreachable supplier, a changed price list and an unreadable
  // basis all printed one sentence and the dry run could diagnose none of them.
  assert.match(script, /Supplier price refresh failed: \$\{describeFailure\(error\)\}/);
  // A commit run says that it failed and stops there.
  assert.match(script, /if \(commit\) \{\s*\n\s*console\.error\("Supplier price refresh failed\."\);/);

  // Node reports a failed fetch as a bare "fetch failed" and keeps the reason
  // on the cause, so the cause is the part worth having.
  assert.match(script, /error\.cause instanceof Error/);

  // Disclosure still stops at filesystem paths.
  assert.match(script, /replace\(.*<path>.*\)/);
});

test("a failed dry run describes the supplier document it could not parse", () => {
  const script = readFileSync("scripts/refresh-steel-product-prices.ts", "utf8");
  const service = readFileSync("lib/server/instant-quote/refresh-atlantik-prices.ts", "utf8");

  // "hot=0, cold=0, zinc=0" says the layout changed and nothing about which
  // part of it. The shape of the document says which, and carries no prices:
  // every digit in the samples is replaced by 9.
  assert.match(script, /inspectAtlantikSource\(\)/);
  assert.match(service, /export async function inspectAtlantikSource/);
  assert.match(service, /describeAtlantikSourceShape/);

  // Only the dry run. A commit run's output is not read by anyone who can act
  // on it, so it says nothing beyond that it failed.
  const commitBranch = script.slice(script.indexOf("if (commit) {"), script.indexOf("inspectAtlantikSource"));
  assert.equal(commitBranch.includes("Source shape"), false);
});

test("the timer resolves Next's build markers, which are not packages", async () => {
  const { readFile } = await import("node:fs/promises");
  const [resolver, packageJson] = await Promise.all([
    readFile("scripts/repo-alias-resolver.mjs", "utf8"),
    readFile("package.json", "utf8"),
  ]);

  // "server-only" is a build marker Next substitutes while bundling, not a
  // dependency — it is in neither the manifest nor the lockfile. Outside Next
  // nothing resolves it, and the refresh dies on its first import.
  const manifest = JSON.parse(packageJson) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  assert.equal(manifest.dependencies?.["server-only"], undefined);
  assert.equal(manifest.devDependencies?.["server-only"], undefined);

  assert.match(resolver, /BUILD_MARKERS[\s\S]*"server-only"[\s\S]*"client-only"/);

  // Both sides have to be covered. tsx transpiles the project's TypeScript to
  // CommonJS, so an import inside those files becomes a require, which
  // module.register() hooks never see — registering only the ESM hook loaded
  // the entry module and then died on the first require inside it.
  const hook = await readFile("scripts/repo-alias-hook.mjs", "utf8");
  assert.match(hook, /register\(/);
  assert.match(hook, /Module\._resolveFilename/);
  assert.match(resolver, /build-marker-module\.cjs/);

  // CommonJS on purpose: tsx transpiles the project's TypeScript to CommonJS,
  // so the marker is reached through require(), and an .mjs file would need a
  // Node new enough to require ESM.
  const marker = await readFile("scripts/build-marker-module.cjs", "utf8");
  assert.match(marker, /module\.exports/);
});
