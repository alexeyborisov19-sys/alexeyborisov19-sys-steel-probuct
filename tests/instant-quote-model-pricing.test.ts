import assert from "node:assert/strict";
import test from "node:test";
import type { NormalizedCadModel } from "../lib/instant-quote/cad-model";
import { createEmptyProject } from "../lib/instant-quote/domain";
import type { StoredPriceSnapshot } from "../lib/instant-quote/material-price-feed";
import { calculateModelProjectPricing } from "../lib/instant-quote/model-pricing";
import { addPartToProject, setPartThickness, updatePartGeometry } from "../lib/instant-quote/project";
import { TEST_PRICING_CONTEXT } from "./fixtures/protected-pricing";

const now = new Date("2099-01-01T12:00:00.000Z");
const snapshots: StoredPriceSnapshot[] = [
  {
    sourceId: "synthetic-supplier",
    fetchedAt: "2099-01-01T11:00:00.000Z",
    sourceDate: "2099-01-01",
    status: "ok",
    rows: [
      { materialId: "hot", thicknessMm: 2, rubPerTon: 100_000, source: "fixture", sourceDate: "2099-01-01", fetchedAt: "2099-01-01T11:00:00.000Z", exactThickness: true },
    ],
  },
];

function model(format: "dxf" | "step", geometry: NormalizedCadModel["geometry"]): NormalizedCadModel {
  return {
    format,
    units: "mm",
    geometry,
    meshes: format === "step" ? [{ id: "body", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] }] : [],
    root: null,
    features: [],
    metadata: { sourceFileName: `part.${format}`, sourceBytes: 10, parser: "test", analyzedAt: now.toISOString() },
    warnings: [],
  };
}

test("normalized DXF can produce a provisional price only with protected pricing context", () => {
  let project = createEmptyProject(now);
  project = addPartToProject(project, { fileName: "plate.dxf", fileSizeBytes: 10 }, now);
  const id = project.activePartId!;
  const geometry = { widthMm: 500, heightMm: 300, blankAreaMm2: 150_000, areaMm2: 145_000, cutLengthMm: 1_600, pierceCount: 2 };
  project = setPartThickness(project, id, 2, now);
  project = updatePartGeometry(project, id, geometry, now);

  const result = calculateModelProjectPricing(project, { [id]: model("dxf", geometry) }, snapshots, TEST_PRICING_CONTEXT, now);
  assert.equal(result.calculatedParts, 1);
  assert.ok(result.parts[0].price);
  assert.ok(result.totalRub > 0);
});

test("raw STEP is inspectable but not silently priced before a trustworthy flat pattern exists", () => {
  let project = createEmptyProject(now);
  project = addPartToProject(project, { fileName: "housing.step", fileSizeBytes: 10 }, now);
  const id = project.activePartId!;
  const geometry = { widthMm: 500, heightMm: 300, depthMm: 120, bodyCount: 1, volumeMm3: 2_000_000 };
  project = setPartThickness(project, id, 2, now);
  project = updatePartGeometry(project, id, geometry, now);

  const result = calculateModelProjectPricing(project, { [id]: model("step", geometry) }, snapshots, TEST_PRICING_CONTEXT, now);
  assert.equal(result.parts[0].status, "manual");
  assert.equal(result.parts[0].price, null);
  assert.ok(result.parts[0].reviewReasons.some((reason) => reason.includes("развёртка")));
});
