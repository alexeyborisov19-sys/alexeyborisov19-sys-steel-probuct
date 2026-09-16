import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProject } from "../lib/instant-quote/domain";
import { addPartToProject, setPartQuantity, setPartThickness, updatePartGeometry } from "../lib/instant-quote/project";
import { calculateProjectProvisionalPricing } from "../lib/instant-quote/project-pricing";
import type { ParsedDxf } from "../lib/instant-quote/dxf";
import type { StoredPriceSnapshot } from "../lib/instant-quote/material-price-feed";
import { TEST_PRICING_CONTEXT } from "./fixtures/protected-pricing";

const now = new Date("2099-01-01T12:00:00.000Z");

function parsed(width: number, height: number, cutLength: number): ParsedDxf {
  return {
    shapes: [{ kind: "line", a: { x: 0, y: 0 }, b: { x: width, y: height } }],
    width,
    height,
    minX: 0,
    minY: 0,
    maxX: width,
    maxY: height,
    cutLength,
    contours: 1,
    closedContours: 0,
    pierces: null,
    holeCount: null,
    area: null,
    areaStatus: "unavailable",
    units: "мм",
    unitsCode: 4,
    unitsSource: "insunits",
    unsupportedEntities: [],
    skippedServiceLayers: [],
  };
}

const snapshots: StoredPriceSnapshot[] = [
  {
    sourceId: "synthetic-supplier",
    fetchedAt: "2099-01-01T09:00:00.000Z",
    sourceDate: "2099-01-01",
    status: "ok",
    rows: [
      { materialId: "hot", thicknessMm: 1, rubPerTon: 100_000, rubPerTonFrom3t: 99_000, source: "fixture", sourceDate: "2099-01-01", fetchedAt: "2099-01-01T09:00:00.000Z" },
      { materialId: "hot", thicknessMm: 2, rubPerTon: 98_000, rubPerTonFrom3t: 97_000, source: "fixture", sourceDate: "2099-01-01", fetchedAt: "2099-01-01T09:00:00.000Z" },
    ],
  },
];

test("sums provisional prices for all DXF parts with protected pricing context", () => {
  let project = createEmptyProject(now);
  project = addPartToProject(project, { fileName: "a.dxf", fileSizeBytes: 100 }, now);
  const a = project.activePartId!;
  project = setPartThickness(project, a, 1, now);
  project = setPartQuantity(project, a, 10, now);
  project = updatePartGeometry(project, a, { widthMm: 500, heightMm: 300, cutLengthMm: 1800, contourCount: 1 }, now);

  project = addPartToProject(project, { fileName: "b.dxf", fileSizeBytes: 100 }, new Date("2099-01-01T12:00:02.000Z"));
  const b = project.activePartId!;
  project = setPartThickness(project, b, 2, now);
  project = setPartQuantity(project, b, 5, now);
  project = updatePartGeometry(project, b, { widthMm: 700, heightMm: 400, cutLengthMm: 2400, contourCount: 1 }, now);

  const result = calculateProjectProvisionalPricing(
    project,
    { [a]: parsed(500, 300, 1800), [b]: parsed(700, 400, 2400) },
    snapshots,
    TEST_PRICING_CONTEXT,
    now,
  );

  assert.equal(result.totalParts, 2);
  assert.equal(result.calculatedParts, 2);
  assert.ok(result.totalRub > 0);
  assert.equal(result.parts.every((part) => part.price !== null), true);
});

test("a blocked oversize part does not contribute a misleading price", () => {
  let project = createEmptyProject(now);
  project = addPartToProject(project, { fileName: "oversize.dxf", fileSizeBytes: 100 }, now);
  const id = project.activePartId!;
  project = setPartThickness(project, id, 2, now);
  project = updatePartGeometry(project, id, { widthMm: 3100, heightMm: 1000, cutLengthMm: 8000, contourCount: 1 }, now);

  const result = calculateProjectProvisionalPricing(
    project,
    { [id]: parsed(3100, 1000, 8000) },
    snapshots,
    TEST_PRICING_CONTEXT,
    now,
  );

  assert.equal(result.parts[0].status, "blocked");
  assert.equal(result.parts[0].price, null);
  assert.equal(result.totalRub, 0);
  assert.equal(result.hasBlockingParts, true);
});
