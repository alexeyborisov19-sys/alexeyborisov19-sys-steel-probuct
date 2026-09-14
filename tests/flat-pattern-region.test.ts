import assert from "node:assert/strict";
import test from "node:test";
import type { FlatBoundaryWire2D } from "../lib/instant-quote/bend-boundary-preview";
import type { BendStripRegionCandidate } from "../lib/instant-quote/bend-strip-region";
import type { SpacedBendBoundaryPreview2D } from "../lib/instant-quote/bend-spacing-preview";
import type { FlatPatternMaterialCollisionCheck } from "../lib/instant-quote/flat-pattern-material-collision";
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

function boundary(includeHole = false, extraPanels: SpacedBendBoundaryPreview2D["panels"] = []): SpacedBendBoundaryPreview2D {
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
      ...extraPanels,
    ],
    bends: [],
    errors: [],
  };
}

function strips(rootPanelId = "panel-a"): BendStripRegionCandidate {
  return {
    source: "approved-bend-allowance-strip",
    displayOnly: true,
    productionAuthoritative: false,
    status: "ready",
    rootPanelId,
    strips: [
      {
        bendId: "bend-ab",
        parentPanelId: "panel-a",
        childPanelId: "panel-b",
        cornersMm: [[0, 0], [100, 0], [100, -4.1], [0, -4.1]],
        bendLengthMm: 100,
        bendAllowanceMm: 4.1,
        areaMm2: 410,
        axialEndpointErrorMm: 0,
      },
    ],
    errors: [],
  };
}

function collision(panelIds = ["panel-a", "panel-b"], status: FlatPatternMaterialCollisionCheck["status"] = "clear"): FlatPatternMaterialCollisionCheck {
  return {
    source: "sampled-flat-pattern-material-collision-check",
    displayOnly: true,
    productionAuthoritative: false,
    status,
    checkedPanelIds: panelIds,
    checkedBendIds: ["bend-ab"],
    collisions: status === "collision"
      ? [{ entityA: { kind: "panel", id: "panel-a" }, entityB: { kind: "panel", id: "panel-b" }, reason: "panel-panel-collision" }]
      : [],
    errors: [],
  };
}

test("builds one connected non-authoritative material-region candidate from two panels and one approved bend strip", () => {
  const result = buildFlatPatternRegionCandidate({
    boundary: boundary(),
    strips: strips(),
    collisions: collision(),
  });

  assert.equal(result.status, "ready");
  assert.equal(result.productionAuthoritative, false);
  assert.equal(result.componentCount, 1);
  assert.deepEqual(new Set(result.panelIds), new Set(["panel-a", "panel-b"]));
  assert.deepEqual(result.bendIds, ["bend-ab"]);
  assert.ok(Math.abs(result.sampledPanelNetAreaMm2! - 8000) < 1e-8);
  assert.ok(Math.abs(result.bendStripAreaMm2! - 410) < 1e-8);
  assert.ok(Math.abs(result.sampledMaterialAreaMm2! - 8410) < 1e-8);
  assert.ok(Math.abs(result.sampledBoundsMm!.widthMm - 100) < 1e-8);
  assert.ok(Math.abs(result.sampledBoundsMm!.heightMm - 84.1) < 1e-8);
});

test("subtracts sampled hole loops from panel material area", () => {
  const result = buildFlatPatternRegionCandidate({
    boundary: boundary(true),
    strips: strips(),
    collisions: collision(),
  });

  assert.equal(result.status, "ready");
  assert.ok(Math.abs(result.sampledPanelNetAreaMm2! - 7900) < 1e-8);
  assert.ok(Math.abs(result.sampledMaterialAreaMm2! - 8310) < 1e-8);
});

test("blocks a flat-pattern region when an unrelated panel is disconnected from the bend-strip graph", () => {
  const result = buildFlatPatternRegionCandidate({
    boundary: boundary(false, [
      { panelId: "panel-x", wires: [rectangleWire("x-outer", 200, 0, 220, 20)] },
    ]),
    strips: strips(),
    collisions: collision(["panel-a", "panel-b", "panel-x"]),
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.componentCount, 2);
  assert.match(result.errors.join(" "), /disconnected components/i);
});

test("refuses region assembly when the sampled material collision gate is not clear", () => {
  const result = buildFlatPatternRegionCandidate({
    boundary: boundary(),
    strips: strips(),
    collisions: collision(["panel-a", "panel-b"], "collision"),
  });

  assert.equal(result.status, "blocked");
  assert.match(result.errors.join(" "), /collision gate/i);
});

test("blocks evidence whose boundary and bend-strip roots disagree", () => {
  const result = buildFlatPatternRegionCandidate({
    boundary: boundary(),
    strips: strips("panel-b"),
    collisions: collision(),
  });

  assert.equal(result.status, "blocked");
  assert.match(result.errors.join(" "), /disagree on the root panel/i);
});
