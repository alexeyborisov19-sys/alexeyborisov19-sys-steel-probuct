import assert from "node:assert/strict";
import test from "node:test";
import type { FlatPatternSampledAudit } from "../lib/instant-quote/flat-pattern-audit";
import type { SampledFlatPatternContourCandidate } from "../lib/instant-quote/flat-pattern-contour-candidate";
import type { FlatPatternMaterialCollisionCheck } from "../lib/instant-quote/flat-pattern-material-collision";
import type { FlatPatternRegionCandidate } from "../lib/instant-quote/flat-pattern-region";
import { verifySampledFlatPattern } from "../lib/instant-quote/flat-pattern-verification";

function region(status: FlatPatternRegionCandidate["status"] = "ready"): FlatPatternRegionCandidate {
  return {
    source: "sampled-flat-pattern-region-candidate",
    displayOnly: true,
    productionAuthoritative: false,
    status,
    rootPanelId: "panel-a",
    panelIds: ["panel-a", "panel-b"],
    bendIds: ["bend-ab"],
    componentCount: 1,
    sampledPanelNetAreaMm2: 8000,
    bendStripAreaMm2: 410,
    sampledMaterialAreaMm2: 8410,
    sampledBoundsMm: { minX: 0, minY: -34.1, maxX: 100, maxY: 50, widthMm: 100, heightMm: 84.1 },
    nodes: [],
    links: [],
    errors: status === "blocked" ? ["region blocked"] : [],
  };
}

function collisions(status: FlatPatternMaterialCollisionCheck["status"] = "clear"): FlatPatternMaterialCollisionCheck {
  return {
    source: "sampled-flat-pattern-material-collision-check",
    displayOnly: true,
    productionAuthoritative: false,
    status,
    checkedPanelIds: ["panel-a", "panel-b"],
    checkedBendIds: ["bend-ab"],
    collisions: status === "collision"
      ? [{ entityA: { kind: "panel", id: "panel-a" }, entityB: { kind: "bend-strip", id: "bend-ab" }, reason: "material-overlap" }]
      : [],
    errors: status === "blocked" ? ["collision gate blocked"] : [],
  };
}

function contour(status: SampledFlatPatternContourCandidate["status"] = "ready"): SampledFlatPatternContourCandidate {
  return {
    source: "sampled-flat-pattern-contour-candidate",
    displayOnly: true,
    productionAuthoritative: false,
    status,
    rootPanelId: "panel-a",
    outer: status === "ready" ? { id: "outer", pointsMm: [[0, 0], [100, 0], [100, 84.1], [0, 84.1]], sampledAreaMm2: 8410, sampledLengthMm: 368.2 } : undefined,
    holes: [],
    contourCount: status === "ready" ? 1 : undefined,
    sampledCutLengthMm: status === "ready" ? 368.2 : undefined,
    sampledMaterialAreaMm2: status === "ready" ? 8410 : undefined,
    areaReconciliationErrorMm2: status === "ready" ? 0 : undefined,
    sampledBoundsMm: status === "ready" ? { minX: 0, minY: 0, maxX: 100, maxY: 84.1, widthMm: 100, heightMm: 84.1 } : undefined,
    cancelledTangencyCount: 2,
    errors: status === "blocked" ? ["contour blocked"] : [],
  };
}

function audit(status: FlatPatternSampledAudit["status"] = "pass"): FlatPatternSampledAudit {
  return {
    source: "brep-vs-sampled-flat-pattern-audit",
    displayOnly: true,
    productionAuthoritative: false,
    status,
    policyId: "qa-flat-v1",
    metrics: status !== "blocked" ? {
      brepPanelAreaMm2: 8000,
      sampledPanelAreaMm2: 8000,
      panelAreaRelativeError: 0,
      approvedBendStripAreaMm2: 410,
      expectedMaterialAreaMm2: 8410,
      sampledContourAreaMm2: status === "fail" ? 8500 : 8410,
      totalAreaRelativeError: status === "fail" ? 0.0107 : 0,
      sourcePanelCount: 2,
      sourceBendCount: 1,
      contourCount: 1,
    } : undefined,
    findings: status === "pass" ? [] : [status === "fail" ? "area audit failed" : "audit blocked"],
  };
}

test("marks a fully agreeing sampled pipeline as verified-preview but never pricing or CAM eligible", () => {
  const result = verifySampledFlatPattern({ region: region(), collisions: collisions(), contour: contour(), audit: audit() });

  assert.equal(result.status, "verified-preview");
  assert.equal(result.productionAuthoritative, false);
  assert.equal(result.pricingEligible, false);
  assert.equal(result.camEligible, false);
  assert.deepEqual(result.checks, { regionReady: true, collisionClear: true, contourReady: true, auditPassed: true });
});

test("fails when a non-blocked BRep audit fails policy", () => {
  const result = verifySampledFlatPattern({ region: region(), collisions: collisions(), contour: contour(), audit: audit("fail") });

  assert.equal(result.status, "failed");
  assert.equal(result.pricingEligible, false);
  assert.match(result.findings.join(" "), /area audit failed/i);
});

test("reports collision details and fails when material overlap is found", () => {
  const result = verifySampledFlatPattern({ region: region(), collisions: collisions("collision"), contour: contour(), audit: audit() });

  assert.equal(result.status, "failed");
  assert.match(result.findings.join(" "), /material-overlap/i);
  assert.match(result.findings.join(" "), /panel-a/i);
});

test("returns blocked when any prerequisite evidence layer is blocked", () => {
  const result = verifySampledFlatPattern({ region: region("blocked"), collisions: collisions(), contour: contour(), audit: audit() });

  assert.equal(result.status, "blocked");
  assert.match(result.findings.join(" "), /region blocked/i);
});
