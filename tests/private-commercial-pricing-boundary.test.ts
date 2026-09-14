import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("commercial pricing stays server-only and loads settings from protected environment", async () => {
  const pricing = await source("lib/server/instant-quote/private-commercial-pricing.ts");
  assert.match(pricing, /import\s+["']server-only["']/);
  assert.match(pricing, /STEEL_PRODUCT_COMMERCIAL_MATERIAL_MULTIPLIER/);
  assert.match(pricing, /STEEL_PRODUCT_COMMERCIAL_DRAW_PCT/);
  assert.match(pricing, /STEEL_PRODUCT_COMMERCIAL_FINAL_PCT/);
  assert.match(pricing, /STEEL_PRODUCT_COMMERCIAL_FIXED_ADD_RUB/);
  assert.match(pricing, /STEEL_PRODUCT_COMMERCIAL_FIXED_ADD_ENABLED/);
  assert.match(pricing, /STEEL_PRODUCT_COMMERCIAL_ROUND_STEP_RUB/);
  assert.match(pricing, /calculation\.status\s*!==\s*["']complete["']/);
  assert.match(pricing, /return\s+roundMoney\(approvedRubEach\s*\*\s*calculation\.quantity\)/);
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

test("public client sources contain no commercial environment keys or private pricing module", async () => {
  const client = await source("components/ClientManufacturingWorkspace.tsx");
  const dto = await source("lib/instant-quote/client-calculation-view.ts");
  for (const text of [client, dto]) {
    assert.doesNotMatch(text, /STEEL_PRODUCT_COMMERCIAL_/);
    assert.doesNotMatch(text, /private-commercial-pricing/);
    assert.doesNotMatch(text, /fixedAddRubEach|materialMultiplier|drawPct|finalPct/);
  }
});
