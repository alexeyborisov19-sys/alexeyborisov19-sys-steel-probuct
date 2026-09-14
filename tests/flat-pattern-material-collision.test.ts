import assert from "node:assert/strict";
import test from "node:test";
import type { FlatBoundaryWire2D } from "../lib/instant-quote/bend-boundary-preview";
import type { BendStripRegionCandidate, BendStripRegion2D } from "../lib/instant-quote/bend-strip-region";
import type { SpacedBendBoundaryPreview2D } from "../lib/instant-quote/bend-spacing-preview";
import { checkSampledFlatPatternMaterialCollisions } from "../lib/instant-quote/flat-pattern-material-collision";

function rectangleWire(id: string, x0: number, y0: number, x1: number, y1: number): FlatBoundaryWire2D {
  const points: Array<[number, number]> = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  return {
    id,
    edges: points.map((point, index) => ({
      id: `${id}-edge-${index}`,
      curveKind: "line",
      pointsMm: [point, points[(index + 1) % points.length]],
    })),
  };
}

function boundary(extraPanels: SpacedBendBoundaryPreview2D["panels"] = []): SpacedBendBoundaryPreview2D {
  return {
    source: "approved-bend-allowance-spacing",
    displayOnly: true,
    productionAuthoritative: false,
    commercialSpacingApplied: true,
    status: "ready",
    rootPanelId: "panel-a",
    panels: [
      { panelId: "panel-a", wires: [rectangleWire("a-outer", 0, 0, 100, 50)] },
      { panelId: "panel-b", wires: [rectangleWire("b-outer", 0, -34.1, 100, -4.1)] },
      ...extraPanels,
    ],
    bends: [],
    errors: [],
  };
}

function strip(
  bendId = "bend-ab",
  parentPanelId = "panel-a",
  childPanelId = "panel-b",
  cornersMm: BendStripRegion2D["cornersMm"] = [[0, 0], [100, 0], [100, -4.1], [0, -4.1]],
): BendStripRegion2D {
  const width = Math.hypot(cornersMm[3][0] - cornersMm[0][0], cornersMm[3][1] - cornersMm[0][1]);
  const length = Math.hypot(cornersMm[1][0] - cornersMm[0][0], cornersMm[1][1] - cornersMm[0][1]);
  return {
    bendId,
    parentPanelId,
    childPanelId,
    cornersMm,
    bendLengthMm: length,
    bendAllowanceMm: width,
    areaMm2: length * width,
    axialEndpointErrorMm: 0,
  };
}

function strips(values: BendStripRegion2D[] = [strip()]): BendStripRegionCandidate {
  return {
    source: "approved-bend-allowance-strip",
    displayOnly: true,
    productionAuthoritative: false,
    status: "ready",
    rootPanelId: "panel-a",
    strips: values,
    errors: [],
  };
}

test("accepts a bend strip that only touches its parent and child panels along the expected tangency edges", () => {
  const result = checkSampledFlatPatternMaterialCollisions({ boundary: boundary(), strips: strips() });

  assert.equal(result.status, "clear");
  assert.equal(result.productionAuthoritative, false);
  assert.deepEqual(result.collisions, []);
  assert.deepEqual(result.checkedBendIds, ["bend-ab"]);
});

test("detects a bend strip crossing an unrelated panel", () => {
  const result = checkSampledFlatPatternMaterialCollisions({
    boundary: boundary([
      { panelId: "panel-x", wires: [rectangleWire("x-outer", 40, -3, 60, -1)] },
    ]),
    strips: strips(),
  });

  assert.equal(result.status, "collision");
  assert.ok(result.collisions.some((collision) =>
    collision.entityA.id === "panel-x"
    && collision.entityB.id === "bend-ab"
    && collision.reason === "unexpected-boundary-intersection"));
});

test("detects material intrusion when a strip extends into its own parent panel beyond the tangency edge", () => {
  const intrusive = strip("bend-ab", "panel-a", "panel-b", [[0, 2], [100, 2], [100, -4.1], [0, -4.1]]);
  const result = checkSampledFlatPatternMaterialCollisions({ boundary: boundary(), strips: strips([intrusive]) });

  assert.equal(result.status, "collision");
  assert.ok(result.collisions.some((collision) =>
    collision.entityA.id === "panel-a"
    && collision.entityB.id === "bend-ab"));
});

test("detects crossing bend strips before flat-region assembly", () => {
  const crossing = strip(
    "bend-xy",
    "panel-x",
    "panel-y",
    [[45, 5], [55, 5], [55, -10], [45, -10]],
  );
  const result = checkSampledFlatPatternMaterialCollisions({
    boundary: boundary(),
    strips: strips([strip(), crossing]),
  });

  assert.equal(result.status, "collision");
  assert.ok(result.collisions.some((collision) => collision.reason === "strip-strip-collision"));
});
