import assert from "node:assert/strict";
import test from "node:test";
import type { NormalizedCadModel } from "../lib/instant-quote/cad-model";
import { evaluateFlatPatternReadiness } from "../lib/instant-quote/flat-pattern-readiness";

function model(overrides: Partial<NormalizedCadModel["sheetMetal"]> = {}): NormalizedCadModel {
  return {
    format: "step",
    units: "mm",
    geometry: { widthMm: 100, heightMm: 50, depthMm: 2 },
    meshes: [{ id: "m", positions: [0, 0, 0, 100, 0, 0, 0, 50, 2], indices: [0, 1, 2] }],
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
      warnings: [],
      ...overrides,
    },
    metadata: {
      sourceFileName: "part.step",
      sourceBytes: 100,
      parser: "test",
      analyzedAt: new Date("2026-09-14T00:00:00Z").toISOString(),
    },
    warnings: [],
  };
}

test("never treats a BRep thickness candidate as confirmed thickness by itself", () => {
  const result = evaluateFlatPatternReadiness({ model: model() });

  assert.equal(result.ready, false);
  assert.equal(result.confirmedThicknessMm, undefined);
  assert.equal(result.gates.find((gate) => gate.code === "thickness-candidate")?.status, "pass");
  assert.equal(result.gates.find((gate) => gate.code === "thickness-confirmation")?.status, "manual");
  assert.equal(result.gates.find((gate) => gate.code === "flat-boundary")?.status, "blocked");
});

test("a flat STEP can become flat-pattern ready only after thickness confirmation and real 2D boundary evidence", () => {
  const result = evaluateFlatPatternReadiness({
    model: model(),
    confirmedThicknessMm: 2,
    boundary: { contourCount: 2, cutLengthMm: 310, areaMm2: 4800 },
  });

  assert.equal(result.ready, true);
  assert.equal(result.confirmedThicknessMm, 2);
});

test("a bent STEP requires an explicit approved bend allowance table", () => {
  const bent = model({
    planarFaceCount: 2,
    cylindricalFaceCount: 2,
    bendCandidates: [
      {
        id: "bend:a:b",
        faceIds: ["a", "b"],
        planarNeighborFaceIds: ["p1", "p2"],
        radiusMm: 3,
        outerRadiusMm: 5,
        angleDeg: 90,
        areaMm2: 1000,
      },
    ],
  });

  const withoutRule = evaluateFlatPatternReadiness({
    model: bent,
    materialId: "hot",
    confirmedThicknessMm: 2,
    boundary: { contourCount: 1, cutLengthMm: 400, areaMm2: 6000 },
  });
  assert.equal(withoutRule.ready, false);
  assert.equal(withoutRule.gates.find((gate) => gate.code === "bend-rule")?.status, "blocked");

  const withRule = evaluateFlatPatternReadiness({
    model: bent,
    materialId: "hot",
    confirmedThicknessMm: 2,
    bendAllowanceTable: {
      id: "approved-hot-2mm",
      materialId: "hot",
      thicknessMm: 2,
      approvedAt: "2026-09-14T00:00:00Z",
      approvedBy: "production-engineering",
      source: "approved bend test table",
      entries: [{ insideRadiusMm: 3, angleDeg: 90, bendAllowanceMm: 3.4 }],
    },
    boundary: { contourCount: 1, cutLengthMm: 400, areaMm2: 6000 },
  });
  assert.equal(withRule.ready, true);
  assert.match(withRule.gates.find((gate) => gate.code === "bend-rule")?.detail ?? "", /интерполяция.*не используются/i);
});

test("unclassified cylinders keep automatic unfolding in manual review", () => {
  const result = evaluateFlatPatternReadiness({
    model: model({ cylindricalFaceCount: 3, bendCandidates: [] }),
    confirmedThicknessMm: 2,
    boundary: { contourCount: 1, cutLengthMm: 300, areaMm2: 4500 },
  });

  assert.equal(result.ready, false);
  assert.equal(result.gates.find((gate) => gate.code === "bend-topology")?.status, "manual");
});

test("cyclic bend topology blocks automatic unfold even when a table exists", () => {
  const bent = model({
    planarFaceCount: 3,
    cylindricalFaceCount: 6,
    bendCandidates: [
      { id: "b1", faceIds: ["b1i", "b1o"], planarNeighborFaceIds: ["A", "B"], radiusMm: 2, outerRadiusMm: 4, angleDeg: 90, areaMm2: 200 },
      { id: "b2", faceIds: ["b2i", "b2o"], planarNeighborFaceIds: ["B", "C"], radiusMm: 2, outerRadiusMm: 4, angleDeg: 90, areaMm2: 200 },
      { id: "b3", faceIds: ["b3i", "b3o"], planarNeighborFaceIds: ["C", "A"], radiusMm: 2, outerRadiusMm: 4, angleDeg: 90, areaMm2: 200 },
    ],
  });

  const result = evaluateFlatPatternReadiness({
    model: bent,
    materialId: "hot",
    confirmedThicknessMm: 2,
    bendAllowanceTable: {
      id: "table",
      materialId: "hot",
      thicknessMm: 2,
      approvedAt: "2026-09-14T00:00:00Z",
      approvedBy: "production-engineering",
      source: "test",
      entries: [{ insideRadiusMm: 2, angleDeg: 90, bendAllowanceMm: 3.2 }],
    },
    boundary: { contourCount: 1, cutLengthMm: 500, areaMm2: 7000 },
  });

  assert.equal(result.ready, false);
  assert.equal(result.gates.find((gate) => gate.code === "bend-topology")?.status, "blocked");
});
