import assert from "node:assert/strict";
import test from "node:test";
import type { ApprovedBendAllowanceTable } from "../lib/instant-quote/bend-allowance";
import { buildBendUnfoldPlanFromModel } from "../lib/instant-quote/bend-unfold-plan";
import { validateNormalizedCadModel, type NormalizedCadModel } from "../lib/instant-quote/cad-model";

const panelA = "panel:a-top:a-bottom";
const panelB = "panel:b-top:b-bottom";

function model(): NormalizedCadModel {
  return {
    format: "step",
    units: "mm",
    geometry: { widthMm: 100, heightMm: 80, depthMm: 30, bodyCount: 1, volumeMm3: 20_000 },
    meshes: [{ id: "mesh", positions: [0, 0, 0, 100, 0, 0, 0, 80, 30], indices: [0, 1, 2] }],
    root: null,
    features: [],
    sheetMetal: {
      source: "brep",
      status: "candidate",
      planarFaceCount: 4,
      cylindricalFaceCount: 2,
      otherFaceCount: 0,
      thicknessCandidate: {
        thicknessMm: 2,
        confidence: "medium",
        evidencePairs: 2,
        evidenceFaceIds: ["a-top", "a-bottom", "b-top", "b-bottom"],
      },
      bendCandidates: [
        {
          id: "bend:inner:outer",
          faceIds: ["inner", "outer"],
          planarNeighborFaceIds: ["a-top", "a-bottom", "b-top", "b-bottom"],
          radiusMm: 3,
          outerRadiusMm: 5,
          angleDeg: 90,
          areaMm2: 1200,
        },
      ],
      warnings: [],
    },
    unfoldGeometry: {
      source: "brep",
      thicknessMm: 2,
      panels: [
        { id: panelA, sourceFaceIds: ["a-top", "a-bottom"], centerMm: [50, 25, 1], normal: [0, 0, 1], areaMm2: 5000 },
        { id: panelB, sourceFaceIds: ["b-top", "b-bottom"], centerMm: [50, 1, 30], normal: [0, 1, 0], areaMm2: 3000 },
      ],
      bends: [
        {
          bendId: "bend:inner:outer",
          sourceCylinderFaceIds: ["inner", "outer"],
          panelIds: [panelA, panelB],
          axisStartMm: [0, 0, 0],
          axisEndMm: [100, 0, 0],
          angleDeg: 90,
          insideRadiusMm: 3,
        },
      ],
      issues: [],
    },
    metadata: {
      sourceFileName: "bent.step",
      sourceBytes: 100,
      parser: "test",
      analyzedAt: "2026-09-14T12:00:00.000Z",
    },
    warnings: [],
  };
}

const table: ApprovedBendAllowanceTable = {
  id: "hot-2mm-r3-90",
  materialId: "hot",
  thicknessMm: 2,
  approvedAt: "2026-09-14T00:00:00.000Z",
  approvedBy: "production-engineering",
  source: "approved test fixture",
  entries: [{ insideRadiusMm: 3, angleDeg: 90, bendAllowanceMm: 4.1 }],
};

test("normalized BRep evidence plus an exact approved table produces a deterministic unfold plan", () => {
  const input = model();
  assert.deepEqual(validateNormalizedCadModel(input), { ok: true, errors: [] });

  const plan = buildBendUnfoldPlanFromModel({
    model: input,
    table,
    materialId: "hot",
    confirmedThicknessMm: 2,
  });

  assert.equal(plan.status, "ready");
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].bendId, "bend:inner:outer");
  assert.equal(plan.steps[0].bendAllowanceMm, 4.1);
  assert.deepEqual(new Set(plan.panelOrder), new Set([panelA, panelB]));
});

test("model bridge blocks before planning when confirmed thickness disagrees with BRep evidence", () => {
  const plan = buildBendUnfoldPlanFromModel({
    model: model(),
    table,
    materialId: "hot",
    confirmedThicknessMm: 1.5,
  });

  assert.equal(plan.status, "blocked");
  assert.match(plan.errors.join(" "), /does not match BRep unfold thickness/i);
});

test("model bridge refuses to invent bend allowance when the approved table has no exact row", () => {
  const plan = buildBendUnfoldPlanFromModel({
    model: model(),
    table: { ...table, entries: [{ insideRadiusMm: 4, angleDeg: 90, bendAllowanceMm: 4.8 }] },
    materialId: "hot",
    confirmedThicknessMm: 2,
  });

  assert.equal(plan.status, "blocked");
  assert.match(plan.errors.join(" "), /No approved bend allowance row/i);
});

test("model bridge blocks unfold evidence that names a bend absent from the source BRep candidates", () => {
  const input = model();
  input.unfoldGeometry!.bends[0].bendId = "bend:forged:evidence";

  const plan = buildBendUnfoldPlanFromModel({
    model: input,
    table,
    materialId: "hot",
    confirmedThicknessMm: 2,
  });

  assert.equal(plan.status, "blocked");
  assert.match(plan.errors.join(" "), /not present in the STEP BRep bend candidates/i);
});

test("normalized CAD validator rejects unfold bends that reference unknown panels", () => {
  const input = model();
  input.unfoldGeometry!.bends[0].panelIds = [panelA, "panel:missing:skin"];
  const validation = validateNormalizedCadModel(input);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes("known panel ids")));
});
