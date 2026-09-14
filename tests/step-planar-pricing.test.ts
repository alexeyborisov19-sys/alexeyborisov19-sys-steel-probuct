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
      { materialId: "hot", thicknessMm: 1.5, rubPerTon: 101_000, source: "fixture", sourceDate: "2099-01-01", fetchedAt: "2099-01-01T11:00:00.000Z", exactThickness: true },
    ],
  },
];

function trustedPlanarStep(): NormalizedCadModel {
  return {
    format: "step",
    units: "mm",
    geometry: {
      widthMm: 100,
      heightMm: 50,
      depthMm: 2,
      areaMm2: 5_000,
      blankAreaMm2: 5_000,
      cutLengthMm: 300,
      contourCount: 1,
      pierceCount: 1,
      bodyCount: 1,
      volumeMm3: 10_000,
    },
    meshes: [{ id: "body", positions: [0, 0, 0, 100, 0, 0, 0, 50, 2], indices: [0, 1, 2] }],
    root: null,
    features: [],
    sheetMetal: {
      source: "brep",
      status: "candidate",
      planarFaceCount: 2,
      cylindricalFaceCount: 0,
      otherFaceCount: 0,
      thicknessCandidate: {
        thicknessMm: 2,
        confidence: "medium",
        evidencePairs: 1,
        evidenceFaceIds: ["top", "bottom"],
      },
      bendCandidates: [],
      flatPatternCandidate: {
        source: "planar-prism",
        faceId: "top",
        oppositeFaceId: "bottom",
        confidence: "high",
        widthMm: 100,
        heightMm: 50,
        areaMm2: 5_000,
        blankAreaMm2: 5_000,
        cutLengthMm: 300,
        contourCount: 1,
        volumeConsistencyError: 0,
      },
      warnings: [],
    },
    metadata: { sourceFileName: "plate.step", sourceBytes: 10, parser: "test", analyzedAt: now.toISOString() },
    warnings: [],
  };
}

function projectForThickness(thicknessMm: number) {
  let project = createEmptyProject(now);
  project = addPartToProject(project, { fileName: "plate.step", fileSizeBytes: 10 }, now);
  const id = project.activePartId!;
  const model = trustedPlanarStep();
  project = setPartThickness(project, id, thicknessMm, now);
  project = updatePartGeometry(project, id, model.geometry, now);
  return { project, id, model };
}

test("trusted planar STEP can reach protected provisional pricing when selected thickness matches BRep", () => {
  const { project, id, model } = projectForThickness(2);
  const result = calculateModelProjectPricing(project, { [id]: model }, snapshots, TEST_PRICING_CONTEXT, now);

  assert.ok(result.parts[0].price);
  assert.equal(result.calculatedParts, 1);
  assert.notEqual(result.parts[0].status, "blocked");
});

test("trusted planar STEP is blocked when selected thickness contradicts BRep", () => {
  const { project, id, model } = projectForThickness(1.5);
  const result = calculateModelProjectPricing(project, { [id]: model }, snapshots, TEST_PRICING_CONTEXT, now);

  assert.equal(result.parts[0].status, "blocked");
  assert.equal(result.parts[0].price, null);
  assert.match(result.parts[0].blockingReasons.join(" "), /1\.5 мм.*2 мм/);
});
