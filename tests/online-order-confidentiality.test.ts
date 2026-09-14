import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("public online-order route uses only the client-safe workspace", async () => {
  const page = await source("app/(public)/online-order/page.tsx");
  assert.match(page, /ClientManufacturingWorkspace/);
  assert.doesNotMatch(page, /ManufacturingWorkspace[^A-Za-z]/);
});

test("client workspace does not import private economics or detailed DFM engines", async () => {
  const client = await source("components/ClientManufacturingWorkspace.tsx");
  const forbidden = [
    "FALLBACK_METAL_PRICE_SNAPSHOTS",
    "calculateModelProjectPricing",
    "calculateProjectFactualCost",
    "calculateFactualProductionCost",
    "runVerifiedLaserDfm",
    "rubPerTon",
    "rateRub",
    "internalSubtotalRubEach",
    "confirmedDirectCostRub",
    "pierceCount",
    "cutLengthMm",
  ];
  for (const token of forbidden) assert.equal(client.includes(token), false, `client workspace contains ${token}`);
});

test("public supplier seed contains no supplier prices", async () => {
  const seed = await source("lib/instant-quote/price-seed.ts");
  assert.match(seed, /FALLBACK_METAL_PRICE_SNAPSHOTS:\s*StoredPriceSnapshot\[\]\s*=\s*\[\]/);
  assert.doesNotMatch(seed, /rubPerTon\s*:/);
});

test("legacy public pricing module contains no embedded production tariff table", async () => {
  const pricing = await source("lib/instant-quote/pricing.ts");
  assert.match(pricing, /PROVISIONAL_STEEL_CUTTING_RATES:\s*CuttingRate\[\]\s*=\s*\[\]/);
  assert.doesNotMatch(pricing, /thicknessMm:\s*\d+(?:\.\d+)?,\s*baseRubPerM:/);
});
