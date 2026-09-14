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

test("a bent STEP requires an approved bend rule and matching thickness", () => {
  const bent = model({
    cylindricalFaceCount: 2,
    bendCandidates: [
      {
        id: "bend:a:b",
        faceIds: ["a", "b"],
        planarNeighborFaceIds: ["p1", "p2", "p3", "p4"],
        radiusMm: 3,
        outerRadiusMm: 5,
        angleDeg: 90,
        areaMm2: 1000,
      },
    ],
  });

  const withoutRule = evaluateFlatPatternReadiness({
    model: bent,
    confirmedThicknessMm: 2,
    boundary: { contourCount: 1, cutLengthMm: 400, areaMm2: 6000 },
  });
  assert.equal(withoutRule.ready, false);
  assert.equal(withoutRule.gates.find((gate) => gate.code === "bend-rule")?.status, "blocked");

  const withRule = evaluateFlatPatternReadiness({
    model: bent,
    confirmedThicknessMm: 2,
    bendRule: {
      id: "approved-2mm-rule",
      materialId: "hot",
      thicknessMm: 2,
      kFactor: 0.42,
      approvedAt: "2026-09-14T00:00:00Z",
    },
    boundary: { contourCount: 1, cutLengthMm: 400, areaMm2: 6000 },
  });
  assert.equal(withRule.ready, true);
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
