import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProject } from "../lib/instant-quote/domain";
import type { ParsedDxf } from "../lib/instant-quote/dxf";
import type { StoredPriceSnapshot } from "../lib/instant-quote/material-price-feed";
import { calculateProjectProvisionalPricing } from "../lib/instant-quote/project-pricing";
import { addPartToProject, setPartQuantity, setPartThickness, updatePartGeometry } from "../lib/instant-quote/project";
import { createProvisionalQuoteSnapshot } from "../lib/instant-quote/quote-snapshot";
import { TEST_PRICING_CONTEXT } from "./fixtures/protected-pricing";

const now = new Date("2099-01-01T12:00:00.000Z");

function parsed(): ParsedDxf {
  return {
    shapes: [{
      kind: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
        { x: 500, y: 300 },
        { x: 0, y: 300 },
      ],
      bulges: [0, 0, 0, 0],
      closed: true,
    }],
    width: 500,
    height: 300,
    minX: 0,
    minY: 0,
    maxX: 500,
    maxY: 300,
    cutLength: 1600,
    contours: 1,
    closedContours: 1,
    pierces: 1,
    holeCount: 0,
    area: 150_000,
    areaStatus: "exact",
    units: "мм",
    unitsCode: 4,
    unitsSource: "insunits",
    unsupportedEntities: [],
    skippedServiceLayers: [],
  };
}

function snapshots(fetchedAt: string): StoredPriceSnapshot[] {
  return [{
    sourceId: "synthetic-supplier",
    fetchedAt,
    sourceDate: "2099-01-01",
    status: "ok",
    rows: [{
      materialId: "hot",
      thicknessMm: 2,
      rubPerTon: 100_000,
      rubPerTonFrom3t: 99_000,
      source: "Synthetic supplier fixture",
      sourceDate: "2099-01-01",
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
    areaMm2: 150_000,
    cutLengthMm: 1600,
    contourCount: 1,
    pierceCount: 1,
    holeCount: 0,
  }, now);
  return { project, id };
}

test("quote snapshot preserves source metadata while incomplete feature DFM keeps automatic ordering gated", () => {
  const { project, id } = projectFixture();
  const pricing = calculateProjectProvisionalPricing(
    project,
    { [id]: parsed() },
    snapshots(now.toISOString()),
    TEST_PRICING_CONTEXT,
    now,
  );
  const quote = createProvisionalQuoteSnapshot(project, pricing, now);

  assert.equal(quote.kind, "provisional");
  assert.equal(quote.currency, "RUB");
  assert.equal(quote.totalParts, 1);
  assert.equal(quote.calculatedParts, 1);
  assert.ok(quote.totalRub > 0);
  assert.ok(quote.pricingFormulaVersion.includes("provisional"));
  assert.equal(quote.lines[0].priceSource?.sourceId, "synthetic-supplier");
  assert.equal(quote.lines[0].priceSource?.source, "Synthetic supplier fixture");
  assert.equal(quote.lines[0].status, "manual");
  assert.ok(quote.lines[0].reviewReasons.some((reason) => reason.includes("Feature")));
  assert.equal(quote.automaticOrderReady, false);
});

test("stale supplier fixture remains reproducible and blocks automatic order readiness", () => {
  const { project, id } = projectFixture();
  const oldFetchedAt = "2098-12-01T12:00:00.000Z";
  const pricing = calculateProjectProvisionalPricing(
    project,
    { [id]: parsed() },
    snapshots(oldFetchedAt),
    TEST_PRICING_CONTEXT,
    now,
  );
  const quote = createProvisionalQuoteSnapshot(project, pricing, now);

  assert.equal(quote.lines[0].priceSource?.fetchedAt, oldFetchedAt);
  assert.equal(quote.lines[0].priceSource?.stale, true);
  assert.equal(quote.automaticOrderReady, false);
  assert.ok(quote.lines[0].reviewReasons.some((reason) => reason.includes("Прайс металла")));
});