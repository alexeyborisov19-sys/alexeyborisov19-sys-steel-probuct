import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("commercial pricing stays server-only and is sourced from the private basis", async () => {
  const pricing = await source("lib/server/instant-quote/private-commercial-pricing.ts");
  const basis = await source("lib/server/instant-quote/private-calculation-basis.ts");
  const service = await source("lib/server/instant-quote/run-confidential-calculation.ts");

  assert.match(pricing, /import\s+["']server-only["']/);
  assert.match(pricing, /calculation\.status\s*!==\s*["']complete["']/);
  assert.match(pricing, /return\s+roundMoney\(approvedRubEach\s*\*\s*calculation\.quantity\)/);
  assert.match(basis, /commercialPricing\?:\s*PrivateCommercialPricing/);
  assert.match(basis, /commercialPricing:\s*commercialPricing\(root\.commercialPricing\)/);
  assert.match(service, /const commercialPricing = basis\.commercialPricing \?\? null/);
  assert.doesNotMatch(pricing, /STEEL_PRODUCT_COMMERCIAL_/);
});

test("confidential orchestrator adds laser internally but never adds it to the public project", async () => {
  const service = await source("lib/server/instant-quote/run-confidential-calculation.ts");
  assert.match(service, /withRequiredLaserCutting/);
  assert.match(service, /["']laser-cutting["']/);
  assert.match(service, /calculateProjectFactualCost\(\s*projectForCalculation/);
  assert.match(service, /return\s+createClientCalculationView\(project,\s*signals\)/);
});

test("bent STEP stays fail-closed for price until authoritative flat geometry exists", async () => {
  const service = await source("lib/server/instant-quote/run-confidential-calculation.ts");
  assert.match(service, /гнутой STEP-модели нужна подтверждённая производственная развёртка DXF/);
  assert.match(service, /approvedSalePriceRub\s*=\s*commercialPricing/);
  assert.match(service, /calculateApprovedSalePriceRub\(part\.calculation,\s*commercialPricing\)/);
});

test("owner calculator import parses constants without executing uploaded JavaScript", async () => {
  const importer = await source("lib/server/instant-quote/import-private-calculator.ts");
  assert.match(importer, /import\s+["']server-only["']/);
  assert.match(importer, /var FACTORY = \{/);
  assert.match(importer, /materialPriceSnapshots:\s*\[\]/);
  assert.match(importer, /weldRubPerM:\s*null/);
  assert.match(importer, /fresh|official|официаль/i);
  assert.doesNotMatch(importer, /\beval\s*\(/);
  assert.doesNotMatch(importer, /new\s+Function\s*\(/);
});

test("one-time import endpoint is same-origin, token-protected and refreshes official supplier prices", async () => {
  const route = await source("app/api/internal/online-order/import-private-calculator/route.ts");
  assert.match(route, /assertSameOriginRequest\(request\)/);
  assert.match(route, /STEEL_PRODUCT_PRIVATE_BASIS_IMPORT_TOKEN_SHA256/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /writePrivateCalculationBasis\(imported\.basis\)/);
  assert.match(route, /refreshAtlantikPriceSnapshot\(now, \{ persist: true \}\)/);
  assert.match(route, /owner-import-consumed/);
  assert.match(route, /Cache-Control["']:\s*["']no-store/);
});

test("public calculation client contains no private economics or import implementation", async () => {
  const client = await source("components/ClientManufacturingWorkspace.tsx");
  const dto = await source("lib/instant-quote/client-calculation-view.ts");
  for (const text of [client, dto]) {
    assert.doesNotMatch(text, /STEEL_PRODUCT_COMMERCIAL_|STEEL_PRODUCT_PRIVATE_BASIS_IMPORT/);
    assert.doesNotMatch(text, /private-commercial-pricing|import-private-calculator/);
    assert.doesNotMatch(text, /fixedAddRubEach|materialMultiplier|drawPct|finalPct/);
  }
});
