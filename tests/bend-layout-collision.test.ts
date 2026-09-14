import assert from "node:assert/strict";
import test from "node:test";
import { checkSampledBendLayoutCollisions } from "../lib/instant-quote/bend-layout-collision";
import type { FlatBoundaryWire2D } from "../lib/instant-quote/bend-boundary-preview";
import type { SpacedBendBoundaryPreview2D } from "../lib/instant-quote/bend-spacing-preview";

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

function preview(panels: SpacedBendBoundaryPreview2D["panels"]): SpacedBendBoundaryPreview2D {
  return {
    source: "approved-bend-allowance-spacing",
    displayOnly: true,
    productionAuthoritative: false,
    commercialSpacingApplied: true,
    status: "ready",
    rootPanelId: panels[0]?.panelId,
    panels,
    bends: [],
    errors: [],
  };
}

test("reports no sampled collision for two separated bend-spaced panel regions", () => {
  const result = checkSampledBendLayoutCollisions(preview([
    { panelId: "panel-a", wires: [rectangleWire("a-outer", 0, 0, 100, 50)] },
    { panelId: "panel-b", wires: [rectangleWire("b-outer", 0, -34.1, 100, -4.1)] },
  ]));

  assert.equal(result.status, "clear");
  assert.equal(result.productionAuthoritative, false);
  assert.deepEqual(result.collisions, []);
  assert.deepEqual(result.checkedPanelIds, ["panel-a", "panel-b"]);
});

test("detects sampled boundary intersections between flattened panels", () => {
  const result = checkSampledBendLayoutCollisions(preview([
    { panelId: "panel-a", wires: [rectangleWire("a-outer", 0, 0, 100, 50)] },
    { panelId: "panel-b", wires: [rectangleWire("b-outer", 50, 25, 120, 70)] },
  ]));

  assert.equal(result.status, "collision");
  assert.equal(result.collisions.length, 1);
  assert.equal(result.collisions[0].reason, "boundary-intersection");
});

test("detects full material containment even when panel boundaries do not cross", () => {
  const result = checkSampledBendLayoutCollisions(preview([
    { panelId: "panel-a", wires: [rectangleWire("a-outer", 0, 0, 100, 100)] },
    { panelId: "panel-b", wires: [rectangleWire("b-outer", 20, 20, 40, 40)] },
  ]));

  assert.equal(result.status, "collision");
  assert.equal(result.collisions.length, 1);
  assert.equal(result.collisions[0].reason, "material-containment");
});

test("does not call a panel inside a sampled through-hole a material collision", () => {
  const result = checkSampledBendLayoutCollisions(preview([
    {
      panelId: "panel-a",
      wires: [
        rectangleWire("a-outer", 0, 0, 100, 100),
        rectangleWire("a-hole", 20, 20, 80, 80),
      ],
    },
    { panelId: "panel-b", wires: [rectangleWire("b-outer", 30, 30, 40, 40)] },
  ]));

  assert.equal(result.status, "clear");
  assert.deepEqual(result.collisions, []);
});

test("blocks collision analysis when a sampled BRep wire cannot be closed", () => {
  const openWire: FlatBoundaryWire2D = {
    id: "open",
    edges: [
      { id: "e1", curveKind: "line", pointsMm: [[0, 0], [10, 0]] },
      { id: "e2", curveKind: "line", pointsMm: [[10, 0], [10, 10]] },
    ],
  };
  const result = checkSampledBendLayoutCollisions(preview([
    { panelId: "panel-a", wires: [openWire] },
  ]));

  assert.equal(result.status, "blocked");
  assert.match(result.errors.join(" "), /open after stitching|cannot be stitched/i);
});
