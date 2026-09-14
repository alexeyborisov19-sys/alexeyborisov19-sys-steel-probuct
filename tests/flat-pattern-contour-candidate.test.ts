import assert from "node:assert/strict";
import test from "node:test";
import type { FlatBoundaryWire2D } from "../lib/instant-quote/bend-boundary-preview";
import type { BendStripRegionCandidate, BendStripRegion2D } from "../lib/instant-quote/bend-strip-region";
import type { SpacedBendBoundaryPreview2D } from "../lib/instant-quote/bend-spacing-preview";
import type { FlatPatternMaterialCollisionCheck } from "../lib/instant-quote/flat-pattern-material-collision";
import { buildSampledFlatPatternContourCandidate } from "../lib/instant-quote/flat-pattern-contour-candidate";
import { buildFlatPatternRegionCandidate } from "../lib/instant-quote/flat-pattern-region";

function rectangleWire(id: string, x0: number, y0: number, x1: number, y1: number): FlatBoundaryWire2D {
  const points: Array<[number, number]> = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  return {
    id,
    edges: points.map((point, index) => ({
      id: `${id}-edge-${index}`,
      curveKind: "line",
      pointsMm: [point, points[(index + 1) % points.length]],
    })),
  };
}

function boundary(includeHole = false): SpacedBendBoundaryPreview2D {
  return {
    source: "approved-bend-allowance-spacing",
    displayOnly: true,
    productionAuthoritative: false,
    commercialSpacingApplied: true,
    status: "ready",
    rootPanelId: "panel-a",
    panels: [
      {
        panelId: "panel-a",
        wires: [
          rectangleWire("a-outer", 0, 0, 100, 50),
          ...(includeHole ? [rectangleWire("a-hole", 10, 10, 20, 20)] : []),
        ],
      },
      { panelId: "panel-b", wires: [rectangleWire("b-outer", 0, -34.1, 100, -4.1)] },
    ],
    bends: [],
    errors: [],
  };
}

function strip(cornersMm: BendStripRegion2D["cornersMm"] = [[0, 0], [100, 0], [100, -4.1], [0, -4.1]]): BendStripRegionCandidate {
  const bendLengthMm = Math.hypot(cornersMm[1][0] - cornersMm[0][0], cornersMm[1][1] - cornersMm[0][1]);
  const bendAllowanceMm = Math.hypot(cornersMm[3][0] - cornersMm[0][0], cornersMm[3][1] - cornersMm[0][1]);
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
      cornersMm,
      bendLengthMm,
      bendAllowanceMm,
      areaMm2: bendLengthMm * bendAllowanceMm,
      axialEndpointErrorMm: 0,
    }],
    errors: [],
  };
}

function collision(): FlatPatternMaterialCollisionCheck {
  return {
    source: "sampled-flat-pattern-material-collision-check",
    displayOnly: true,
    productionAuthoritative: false,
    status: "clear",
    checkedPanelIds: ["panel-a", "panel-b"],
    checkedBendIds: ["bend-ab"],
    collisions: [],
    errors: [],
  };
}

function build(includeHole = false, strips = strip()) {
  const spacedBoundary = boundary(includeHole);
  const checked = collision();
  const region = buildFlatPatternRegionCandidate({ boundary: spacedBoundary, strips, collisions: checked });
  return buildSampledFlatPatternContourCandidate({ boundary: spacedBoundary, strips, collisions: checked, region });
}

test("reconstructs one sampled outer contour after cancelling the two exact bend tangency edges", () => {
  const result = build();

  assert.equal(result.status, "ready");
  assert.equal(result.productionAuthoritative, false);
  assert.equal(result.cancelledTangencyCount, 2);
  assert.equal(result.contourCount, 1);
  assert.equal(result.holes.length, 0);
  assert.ok(Math.abs(result.sampledMaterialAreaMm2! - 8410) < 1e-8);
  assert.ok(Math.abs(result.sampledCutLengthMm! - 368.2) < 1e-8);
  assert.ok(Math.abs(result.sampledBoundsMm!.widthMm - 100) < 1e-8);
  assert.ok(Math.abs(result.sampledBoundsMm!.heightMm - 84.1) < 1e-8);
  assert.ok(result.areaReconciliationErrorMm2! < 1e-8);
});

test("preserves an internal sampled hole in the reconstructed whole-part contour", () => {
  const result = build(true);

  assert.equal(result.status, "ready");
  assert.equal(result.contourCount, 2);
  assert.equal(result.holes.length, 1);
  assert.ok(Math.abs(result.sampledMaterialAreaMm2! - 8310) < 1e-8);
  assert.ok(Math.abs(result.sampledCutLengthMm! - 408.2) < 1e-8);
});

test("blocks partial tangency overlap instead of splitting a panel edge heuristically", () => {
  const result = build(false, strip([[10, 0], [90, 0], [90, -4.1], [10, -4.1]]));

  assert.equal(result.status, "blocked");
  assert.match(result.errors.join(" "), /exactly one full endpoint-matched outer-boundary segment/i);
});
