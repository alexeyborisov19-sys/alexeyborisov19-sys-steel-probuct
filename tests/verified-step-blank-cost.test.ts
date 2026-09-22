import assert from "node:assert/strict";
import test from "node:test";
import type { NormalizedCadModel } from "../lib/instant-quote/cad-model";
import { verifiedStepBlankCostSource } from "../lib/instant-quote/verified-step-blank-cost";

function model(): NormalizedCadModel {
  const warning = "Additional processing excluded from the blank estimate";
  return {
    format: "step", units: "mm", meshes: [], root: null, features: [],
    metadata: { sourceFileName: "synthetic.step", sourceBytes: 1, parser: "fixture", analyzedAt: "2099-01-01" },
    geometry: { widthMm: 100, heightMm: 80, areaMm2: 7900, blankAreaMm2: 8000, cutLengthMm: 400,
      contourCount: 2, pierceCount: 2, bodyCount: 1, bendCount: 0, volumeMm3: 7900 * 2 * .99 },
    sheetMetal: { source: "brep", status: "candidate", planarFaceCount: 2, cylindricalFaceCount: 1, otherFaceCount: 1,
      thicknessCandidate: { thicknessMm: 2, confidence: "medium", evidencePairs: 1, evidenceFaceIds: ["a", "b"] },
      bendCandidates: [], warnings: [] },
    preliminaryBlank: { source: "planar-face-preliminary", widthMm: 100, heightMm: 80, areaMm2: 7900, blankAreaMm2: 8000,
      cutLengthMm: 400, contourCount: 2, thicknessMm: 2, removedVolumeFraction: .01,
      excludedOperations: ["edge-finishing"], warning },
    warnings: [warning],
  };
}

test("measured blank only obtains the estimate marker with matching server geometry and retained warning", () => {
  assert.equal(verifiedStepBlankCostSource(model()), "measured-step-blank");
});

test("blank estimate rejects inconsistent evidence, incomplete scope and suppressed diagnostics", () => {
  const mutations: Array<(m: NormalizedCadModel) => void> = [
    m => { delete m.preliminaryBlank; }, m => { m.geometry.bodyCount = 2; },
    m => { m.geometry.bendCount = 1; }, m => { m.geometry.cutLengthMm = 1; },
    m => { m.geometry.volumeMm3 = 100; }, m => { m.preliminaryBlank!.removedVolumeFraction = .06; },
    m => { m.preliminaryBlank!.removedVolumeFraction = NaN; }, m => { m.geometry.pierceCount = 0; },
    m => { m.warnings = []; }, m => { m.warnings.push("Unresolved kernel defect"); },
    m => { m.sheetMetal!.thicknessCandidate!.thicknessMm = 3; },
    m => { m.preliminaryBlank!.excludedOperations = [] as unknown as ["edge-finishing"]; },
  ];
  for (const mutate of mutations) { const candidate = model(); mutate(candidate); assert.equal(verifiedStepBlankCostSource(candidate), undefined); }
});
