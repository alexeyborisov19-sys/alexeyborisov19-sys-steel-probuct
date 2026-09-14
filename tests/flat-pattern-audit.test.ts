import assert from "node:assert/strict";
import test from "node:test";
import type { BendStripRegionCandidate } from "../lib/instant-quote/bend-strip-region";
import type { NormalizedCadModel } from "../lib/instant-quote/cad-model";
import type { SampledFlatPatternContourCandidate } from "../lib/instant-quote/flat-pattern-contour-candidate";
import {
  auditSampledFlatPattern,
  type FlatPatternSampledAuditPolicy,
} from "../lib/instant-quote/flat-pattern-audit";
import type { FlatPatternRegionCandidate } from "../lib/instant-quote/flat-pattern-region";

function model(): NormalizedCadModel {
  return {
    format: "step",
    units: "mm",
    geometry: { widthMm: 100, heightMm: 50, depthMm: 30, bodyCount: 1, volumeMm3: 16_000 },
    meshes: [{ id: "mesh", positions: [0, 0, 0, 100, 0, 0, 0, 50, 30], indices: [0, 1, 2] }],
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
        { id: "panel-a", sourceFaceIds: ["a-top", "a-bottom"], centerMm: [50, 25, 1], normal: [0, 0, 1], areaMm2: 5000 },
        { id: "panel-b", sourceFaceIds: ["b-top", "b-bottom"], centerMm: [50, 1, 15], normal: [0, 1, 0], areaMm2: 3000 },
      ],
      bends: [{
        bendId: "bend-ab",
        sourceCylinderFaceIds: ["inner", "outer"],
        panelIds: ["panel-a", "panel-b"],
        axisStartMm: [0, 0, 0],
        axisEndMm: [100, 0, 0],
        angleDeg: 90,
        insideRadiusMm: 3,
      }],
      issues: [],
    },
    metadata: {
      sourceFileName: "audit.step",
      sourceBytes: 100,
      parser: "test",
      analyzedAt: "2026-09-14T12:00:00.000Z",
    },
    warnings: [],
  };
}

function region(): FlatPatternRegionCandidate {
  return {
    source: "sampled-flat-pattern-region-candidate",
    displayOnly: true,
    productionAuthoritative: false,
    status: "ready",
    rootPanelId: "panel-a",
    panelIds: ["panel-a", "panel-b"],
    bendIds: ["bend-ab"],
    componentCount: 1,
    sampledPanelNetAreaMm2: 8000,
    bendStripAreaMm2: 410,
    sampledMaterialAreaMm2: 8410,
    sampledBoundsMm: { minX: 0, minY: -34.1, maxX: 100, maxY: 50, widthMm: 100, heightMm: 84.1 },
    nodes: [
      { kind: "panel", id: "panel-a" },
      { kind: "panel", id: "panel-b" },
      { kind: "bend-strip", id: "bend-ab" },
    ],
    links: [{ bendId: "bend-ab", parentPanelId: "panel-a", childPanelId: "panel-b" }],
    errors: [],
  };
}

function strips(): BendStripRegionCandidate {
  return {
    source: "approved-bend-allowance-strip",
    displayOnly: true,
    productionAuthoritative: false,
    status: "ready",
    rootPanelId: "panel-a",
    strips: [{
      bendId: "bend-ab",
      parentPanelId: "panel-a",
      childPanelId: "panel-b",
      cornersMm: [[0, 0], [100, 0], [100, -4.1], [0, -4.1]],
      bendLengthMm: 100,
      bendAllowanceMm: 4.1,
      areaMm2: 410,
      axialEndpointErrorMm: 0,
    }],
    errors: [],
  };
}

function contour(area = 8410): SampledFlatPatternContourCandidate {
  return {
    source: "sampled-flat-pattern-contour-candidate",
    displayOnly: true,
    productionAuthoritative: false,
    status: "ready",
    rootPanelId: "panel-a",
    outer: {
      id: "outer",
      pointsMm: [[0, -34.1], [100, -34.1], [100, 50], [0, 50]],
      sampledAreaMm2: area,
      sampledLengthMm: 368.2,
    },
    holes: [],
    contourCount: 1,
    sampledCutLengthMm: 368.2,
    sampledMaterialAreaMm2: area,
    areaReconciliationErrorMm2: Math.abs(area - 8410),
    sampledBoundsMm: { minX: 0, minY: -34.1, maxX: 100, maxY: 50, widthMm: 100, heightMm: 84.1 },
    cancelledTangencyCount: 2,
    errors: [],
  };
}

function policy(overrides: Partial<FlatPatternSampledAuditPolicy> = {}): FlatPatternSampledAuditPolicy {
  return {
    id: "qa-flat-v1",
    approvedBy: "Steel Product Engineering",
    approvedAt: "2026-09-14T12:00:00.000Z",
    source: "internal validation fixture",
    maxPanelAreaRelativeError: 0.001,
    maxTotalAreaRelativeError: 0.001,
    ...overrides,
  };
}

test("passes when sampled panel and total material area agree with BRep and approved bend strips within policy", () => {
  const result = auditSampledFlatPattern({ model: model(), region: region(), contour: contour(), strips: strips(), policy: policy() });

  assert.equal(result.status, "pass");
  assert.equal(result.productionAuthoritative, false);
  assert.equal(result.policyId, "qa-flat-v1");
  assert.ok(result.metrics);
  assert.equal(result.metrics!.brepPanelAreaMm2, 8000);
  assert.equal(result.metrics!.approvedBendStripAreaMm2, 410);
  assert.equal(result.metrics!.expectedMaterialAreaMm2, 8410);
  assert.equal(result.metrics!.sampledContourAreaMm2, 8410);
  assert.equal(result.metrics!.panelAreaRelativeError, 0);
  assert.equal(result.metrics!.totalAreaRelativeError, 0);
});

test("fails when final sampled material area exceeds the approved policy tolerance", () => {
  const result = auditSampledFlatPattern({
    model: model(),
    region: region(),
    contour: contour(8500),
    strips: strips(),
    policy: policy({ maxTotalAreaRelativeError: 0.001 }),
  });

  assert.equal(result.status, "fail");
  assert.ok(result.metrics!.totalAreaRelativeError > 0.001);
  assert.match(result.findings.join(" "), /total material area relative error/i);
});

test("blocks an unapproved or malformed audit policy instead of inventing tolerances", () => {
  const result = auditSampledFlatPattern({
    model: model(),
    region: region(),
    contour: contour(),
    strips: strips(),
    policy: policy({ approvedBy: "", maxPanelAreaRelativeError: -1 }),
  });

  assert.equal(result.status, "blocked");
  assert.match(result.findings.join(" "), /policy/i);
});

test("blocks audit when sampled region panel ids do not exactly match the STEP BRep evidence", () => {
  const alteredRegion = region();
  alteredRegion.panelIds = ["panel-a"];

  const result = auditSampledFlatPattern({ model: model(), region: alteredRegion, contour: contour(), strips: strips(), policy: policy() });

  assert.equal(result.status, "blocked");
  assert.match(result.findings.join(" "), /panel ids/i);
});

test("blocks non-STEP input", () => {
  const dxf = model();
  dxf.format = "dxf";

  const result = auditSampledFlatPattern({ model: dxf, region: region(), contour: contour(), strips: strips(), policy: policy() });

  assert.equal(result.status, "blocked");
  assert.match(result.findings.join(" "), /STEP\/STP/i);
});
