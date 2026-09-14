import assert from "node:assert/strict";
import test from "node:test";
import { buildBendBoundaryPreview2D } from "../lib/instant-quote/bend-boundary-preview";
import { buildBendOrientationPreview } from "../lib/instant-quote/bend-orientation-preview";
import type { BendUnfoldPlan } from "../lib/instant-quote/bend-unfold-plan";
import type { BRepPanelRegionEvidence } from "../lib/instant-quote/unfold-geometry";

function rectangleBoundary(
  faceId: string,
  points: Array<[number, number, number]>,
) {
  return {
    source: "brep-edge-sampling" as const,
    displayOnly: true as const,
    faceId,
    wires: [
      {
        id: "wire-0",
        edges: points.map((point, index) => ({
          id: `edge-${index}`,
          curveKind: "line",
          pointsMm: [point, points[(index + 1) % points.length]],
        })),
      },
    ],
  };
}

const panels: BRepPanelRegionEvidence[] = [
  {
    id: "panel-a",
    sourceFaceIds: ["a-top", "a-bottom"],
    centerMm: [50, 25, 0],
    normal: [0, 0, 1],
    areaMm2: 5000,
    boundary3d: rectangleBoundary("a-top", [
      [0, 0, 0],
      [100, 0, 0],
      [100, 50, 0],
      [0, 50, 0],
    ]),
  },
  {
    id: "panel-b",
    sourceFaceIds: ["b-top", "b-bottom"],
    centerMm: [50, 0, 25],
    normal: [0, 1, 0],
    areaMm2: 5000,
    boundary3d: rectangleBoundary("b-top", [
      [0, 0, 0],
      [100, 0, 0],
      [100, 0, 50],
      [0, 0, 50],
    ]),
  },
];

const plan: BendUnfoldPlan = {
  status: "ready",
  rootFaceId: "panel-a",
  panelOrder: ["panel-a", "panel-b"],
  steps: [
    {
      index: 0,
      bendId: "bend-1",
      parentFaceId: "panel-a",
      childFaceId: "panel-b",
      axisStartMm: [0, 0, 0],
      axisEndMm: [100, 0, 0],
      angleDeg: 90,
      insideRadiusMm: 3,
      bendAllowanceMm: 4.1,
    },
  ],
  errors: [],
};

test("projects rigidly flattened real BRep panel boundaries into a common 2D display frame", () => {
  const orientation = buildBendOrientationPreview({ plan, panels });
  assert.equal(orientation.status, "ready");

  const preview = buildBendBoundaryPreview2D({ orientation, panels });
  assert.equal(preview.status, "ready");
  assert.equal(preview.displayOnly, true);
  assert.equal(preview.commercialSpacingApplied, false);
  assert.equal(preview.panels.length, 2);
  assert.equal(preview.panels[0].wires[0].edges.length, 4);
  assert.ok(preview.panels.flatMap((panel) => panel.wires)
    .flatMap((wire) => wire.edges)
    .flatMap((edge) => edge.pointsMm)
    .every(([u, v]) => Number.isFinite(u) && Number.isFinite(v)));
});

test("refuses to invent a panel outline when one BRep skin boundary is missing", () => {
  const incompletePanels: BRepPanelRegionEvidence[] = [
    panels[0],
    { ...panels[1], boundary3d: undefined },
  ];
  const orientation = buildBendOrientationPreview({ plan, panels: incompletePanels });
  assert.equal(orientation.status, "ready");

  const preview = buildBendBoundaryPreview2D({ orientation, panels: incompletePanels });
  assert.equal(preview.status, "blocked");
  assert.match(preview.errors.join(" "), /no display-only BRep skin boundary/i);
});
