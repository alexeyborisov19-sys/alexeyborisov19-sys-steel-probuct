import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProject } from "../lib/instant-quote/domain";
import type { ParsedDxf } from "../lib/instant-quote/dxf";
import type { StoredPriceSnapshot } from "../lib/instant-quote/material-price-feed";
import { calculateProjectProvisionalPricing } from "../lib/instant-quote/project-pricing";
import { addPartToProject, setPartQuantity, setPartThickness, updatePartGeometry } from "../lib/instant-quote/project";
import { createProvisionalQuoteSnapshot } from "../lib/instant-quote/quote-snapshot";

const now = new Date("2026-09-14T12:00:00.000Z");

function parsed(): ParsedDxf {
  return {
    shapes: [{ kind: "line", a: { x: 0, y: 0 }, b: { x: 500, y: 300 } }],
    width: 500,
    height: 300,
    minX: 0,
    minY: 0,
    maxX: 500,
    maxY: 300,
    cutLength: 1600,
    contours: 1,
    units: "мм",
    unitsCode: 4,
    unsupportedEntities: [],
  };
}

function snapshots(fetchedAt: string): StoredPriceSnapshot[] {
  return [{
    sourceId: "atlantik-smolensk",
    fetchedAt,
    sourceDate: "2026-09-14",
    status: "ok",
    rows: [{
      materialId: "hot",
      thicknessMm: 2,
      rubPerTon: 60_000,
      rubPerTonFrom3t: 59_000,
      source: "Атлантик Компани",
      sourceDate: "2026-09-14",
      fetchedAt,
    }],
  }];
}

function projectFixture() {
  let project = createEmptyProject(now);
  project = addPartToProject(project, { fileName: "part.dxf", fileSizeBytes: 100 }, now);
  const id = project.activePartId!;
  project = setPartThickness(project, id, 2, now);
  project = setPartQuantity(project, id, 10, now);
  project = updatePartGeometry(project, id, {
    widthMm: 500,
    heightMm: 300,
    areaMm2: 120_000,
    cutLengthMm: 1600,
    contourCount: 1,
    pierceCount: 1,
  }, now);
  return { project, id };
}

test("quote snapshot preserves supplier source and pricing formula version", () => {
  const { project, id } = projectFixture();
  const pricing = calculateProjectProvisionalPricing(project, { [id]: parsed() }, snapshots(now.toISOString()), now);
  const quote = createProvisionalQuoteSnapshot(project, pricing, now);

  assert.equal(quote.kind, "provisional");
  assert.equal(quote.currency, "RUB");
  assert.equal(quote.totalParts, 1);
  assert.equal(quote.calculatedParts, 1);
  assert.ok(quote.totalRub > 0);
  assert.ok(quote.pricingFormulaVersion.includes("provisional"));
  assert.equal(quote.lines[0].priceSource?.sourceId, "atlantik-smolensk");
  assert.equal(quote.lines[0].priceSource?.source, "Атлантик Компани");
  assert.equal(quote.automaticOrderReady, true);
});

test("stale supplier price remains reproducible but blocks automatic order readiness", () => {
  const { project, id } = projectFixture();
  const oldFetchedAt = "2026-09-01T12:00:00.000Z";
  const pricing = calculateProjectProvisionalPricing(project, { [id]: parsed() }, snapshots(oldFetchedAt), now);
  const quote = createProvisionalQuoteSnapshot(project, pricing, now);

  assert.equal(quote.lines[0].priceSource?.fetchedAt, oldFetchedAt);
  assert.equal(quote.lines[0].priceSource?.stale, true);
  assert.equal(quote.automaticOrderReady, false);
  assert.ok(quote.lines[0].reviewReasons.some((reason) => reason.includes("Прайс металла")));
});
