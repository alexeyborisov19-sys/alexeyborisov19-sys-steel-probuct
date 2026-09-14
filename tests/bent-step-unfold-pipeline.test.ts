import assert from "node:assert/strict";
import test from "node:test";
import type { ApprovedBendAllowanceTable } from "../lib/instant-quote/bend-allowance";
import { runBentStepUnfoldPreview } from "../lib/instant-quote/bent-step-unfold-pipeline";
import type { NormalizedCadModel } from "../lib/instant-quote/cad-model";
import type { FlatPatternSampledAuditPolicy } from "../lib/instant-quote/flat-pattern-audit";

function rectangleBoundary(
  faceId: string,
  baseHash: number,
  points: Array<[number, number, number]>,
) {
  return {
    source: "brep-edge-sampling" as const,
    displayOnly: true as const,
    faceId,
    wires: [{
      id: `wire-${faceId}`,
      edges: points.map((point, index) => ({
        id: `edge-${baseHash + index}`,
        edgeHash: baseHash + index,
        curveKind: "line",
        pointsMm: [point, points[(index + 1) % points.length]],
      })),
    }],
  };
}

function model(): NormalizedCadModel {
  return {
    format: "step",
    units: "mm",
    geometry: {
      widthMm: 100,
      heightMm: 50,
      depthMm: 32,
      bodyCount: 1,
      volumeMm3: 16_820,
    },
    meshes: [{
      id: "mesh",
      positions: [0, 0, 0, 100, 0, 0, 0, 50, 0],
      indices: [0, 1, 2],
    }],
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
      bendCandidates: [{
        id: "bend-ab",
        faceIds: ["inner", "outer"],
        planarNeighborFaceIds: ["a-top", "a-bottom", "b-top", "b-bottom"],
        radiusMm: 3,
        outerRadiusMm: 5,
        angleDeg: 90,
        areaMm2: 1000,
      }],
      warnings: [],
    },
    unfoldGeometry: {
      source: "brep",
      thicknessMm: 2,
      panels: [
        {
          id: "panel-a",
          sourceFaceIds: ["a-top", "a-bottom"],
          centerMm: [50, 25, 1],
          normal: [0, 0, 1],
          areaMm2: 5000,
          boundary3d: rectangleBoundary("a-bottom", 10, [
            [0, 0, 0],
            [100, 0, 0],
            [100, 50, 0],
            [0, 50, 0],
          ]),
        },
        {
          id: "panel-b",
          sourceFaceIds: ["b-top", "b-bottom"],
          centerMm: [50, 1, 15],
          normal: [0, 1, 0],
          areaMm2: 3000,
          boundary3d: rectangleBoundary("b-bottom", 20, [
            [0, 0, 0],
            [100, 0, 0],
            [100, 0, 30],
            [0, 0, 30],
          ]),
        },
      ],
      bends: [{
        bendId: "bend-ab",
        sourceCylinderFaceIds: ["inner", "outer"],
        panelIds: ["panel-a", "panel-b"],
        axisStartMm: [0, 0, 0],
        axisEndMm: [100, 0, 0],
        angleDeg: 90,
        insideRadiusMm: 3,
        tangentSegments: [
          {
            panelId: "panel-a",
            startMm: [0, 0, 1],
            endMm: [100, 0, 1],
            sourceEdgeHashes: [101, 201],
          },
          {
            panelId: "panel-b",
            startMm: [0, 1, 0],
            endMm: [100, 1, 0],
            sourceEdgeHashes: [102, 202],
          },
        ],
      }],
      issues: [],
    },
    metadata: {
      sourceFileName: "bent-preview.step",
      sourceBytes: 1000,
      parser: "test",
      analyzedAt: "2026-09-14T12:00:00.000Z",
    },
    warnings: [],
  };
}

function table(entries = [{ insideRadiusMm: 3, angleDeg: 90, bendAllowanceMm: 4.1 }]): ApprovedBendAllowanceTable {
  return {
    id: "bend-table-test",
    materialId: "hot",
    thicknessMm: 2,
    approvedAt: "2026-09-14T12:00:00.000Z",
    approvedBy: "Steel Product Engineering Fixture",
    source: "automated test fixture only",
    entries,
  };
}

const auditPolicy: FlatPatternSampledAuditPolicy = {
  id: "flat-audit-test",
  approvedBy: "Steel Product Engineering Fixture",
  approvedAt: "2026-09-14T12:00:00.000Z",
  source: "automated test fixture only",
  maxPanelAreaRelativeError: 0.001,
  maxTotalAreaRelativeError: 0.001,
};

test("runs one bent STEP through the full fail-closed sampled pipeline to verified-preview only", () => {
  const result = runBentStepUnfoldPreview({
    model: model(),
    allowanceTable: table(),
    auditPolicy,
    materialId: "hot",
    confirmedThicknessMm: 2,
  });

  assert.equal(result.status, "verified-preview");
  assert.equal(result.productionAuthoritative, false);
  assert.equal(result.pricingEligible, false);
  assert.equal(result.camEligible, false);
  assert.equal(result.stoppedAt, undefined);
  assert.equal(result.verification?.status, "verified-preview");
  assert.equal(result.collisions?.status, "clear");
  assert.equal(result.contour?.contourCount, 1);
  assert.ok(Math.abs(result.contour!.sampledMaterialAreaMm2! - 8410) < 1e-8);
  assert.ok(Math.abs(result.contour!.sampledCutLengthMm! - 368.2) < 1e-8);
  assert.equal(result.audit?.status, "pass");
});

test("stops at the unfold plan when no exact approved bend-allowance row exists", () => {
  const result = runBentStepUnfoldPreview({
    model: model(),
    allowanceTable: table([]),
    auditPolicy,
    materialId: "hot",
    confirmedThicknessMm: 2,
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.stoppedAt, "plan");
  assert.equal(result.pricingEligible, false);
  assert.equal(result.camEligible, false);
  assert.match(result.findings.join(" "), /bend allowance/i);
});
