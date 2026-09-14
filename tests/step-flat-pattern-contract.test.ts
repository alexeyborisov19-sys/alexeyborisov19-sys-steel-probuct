import assert from "node:assert/strict";
import test from "node:test";
import { validateNormalizedCadModel } from "../lib/instant-quote/cad-model";

function modelWithFlatPattern(volumeConsistencyError: number) {
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
    meshes: [{ id: "mesh", positions: [0, 0, 0, 100, 0, 0, 0, 50, 2], indices: [0, 1, 2] }],
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
        volumeConsistencyError,
      },
      warnings: [],
    },
    metadata: {
      sourceFileName: "plate.step",
      sourceBytes: 10,
      parser: "test",
      analyzedAt: "2026-09-14T12:00:00.000Z",
    },
    warnings: [],
  };
}

function modelWithPreview(preview: unknown) {
  const model = modelWithFlatPattern(0.01);
  return {
    ...model,
    sheetMetal: {
      ...model.sheetMetal,
      flatPatternCandidate: {
        ...model.sheetMetal.flatPatternCandidate,
        preview,
      },
    },
  };
}

test("accepts a coherent trusted planar STEP contract", () => {
  const validation = validateNormalizedCadModel(modelWithFlatPattern(0.01));
  assert.deepEqual(validation, { ok: true, errors: [] });
});

test("rejects a claimed trusted planar STEP when volume consistency is outside the gate", () => {
  const validation = validateNormalizedCadModel(modelWithFlatPattern(0.25));
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes("volume consistency")));
});

test("accepts a finite display-only BRep boundary preview", () => {
  const model = modelWithPreview({
    source: "brep-edge-sampling",
    displayOnly: true,
    wires: [{ id: "wire-0", edges: [{ id: "edge-0", curveKind: "line", pointsMm: [[0, 0], [100, 0]] }] }],
  });

  assert.deepEqual(validateNormalizedCadModel(model), { ok: true, errors: [] });
});

test("rejects non-finite or price-authoritative STEP preview data", () => {
  const model = modelWithPreview({
    source: "brep-edge-sampling",
    displayOnly: false,
    wires: [{ id: "wire-0", edges: [{ id: "edge-0", curveKind: "line", pointsMm: [[0, 0], [Number.NaN, 0]] }] }],
  });

  const validation = validateNormalizedCadModel(model);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes("display-only")));
  assert.ok(validation.errors.some((error) => error.includes("finite UV pairs")));
});
