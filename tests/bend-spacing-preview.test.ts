import assert from "node:assert/strict";
import test from "node:test";
import { buildBendBoundaryPreview2D } from "../lib/instant-quote/bend-boundary-preview";
import {
  buildBendOrientationPreview,
  type BendOrientationPreview,
} from "../lib/instant-quote/bend-orientation-preview";
import {
  applyBendAllowanceSpacingToBoundaryPreview,
  buildBendAllowanceSpacingPreview,
} from "../lib/instant-quote/bend-spacing-preview";
import type { BendUnfoldPlan } from "../lib/instant-quote/bend-unfold-plan";
import type {
  BRepBendGeometryEvidence,
  BRepPanelRegionEvidence,
} from "../lib/instant-quote/unfold-geometry";

function rectangleBoundary(
  faceId: string,
  baseHash: number,
  points: Array<[number, number, number]>,
) {
  return {
    source: "brep-edge-sampling" as const,
    displayOnly: true as const,
    faceId,
    wires: [
      {
        id: `wire-${faceId}`,
        edges: points.map((point, index) => ({
          id: `edge-${baseHash + index}`,
          edgeHash: baseHash + index,
          curveKind: "line",
          pointsMm: [point, points[(index + 1) % points.length]],
        })),
      },
    ],
  };
}

function panelEvidence(childCenter: [number, number, number] = [50, 1, 30]): BRepPanelRegionEvidence[] {
  return [
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
      centerMm: childCenter,
      normal: [0, 1, 0],
      areaMm2: 3000,
      boundary3d: rectangleBoundary("b-bottom", 20, [
        [0, 0, 0],
        [100, 0, 0],
        [100, 0, 50],
        [0, 0, 50],
      ]),
    },
  ];
}

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

const bend: BRepBendGeometryEvidence = {
  bendId: "bend-1",
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
};

test("inserts the exact approved bend allowance between flattened BRep tangency lines", () => {
  const panels = panelEvidence();
  const orientation = buildBendOrientationPreview({ plan, panels });
  assert.equal(orientation.status, "ready");

  const spacing = buildBendAllowanceSpacingPreview({ plan, orientation, bends: [bend] });
  assert.equal(spacing.status, "ready");
  assert.equal(spacing.productionAuthoritative, false);
  assert.equal(spacing.commercialSpacingApplied, true);
  assert.equal(spacing.bends.length, 1);
  assert.ok(Math.abs(spacing.bends[0].gapBeforeMm) < 1e-8);
  assert.ok(Math.abs(spacing.bends[0].gapAfterMm - 4.1) < 1e-8);

  const childTranslation = spacing.panelTranslationsMm.find((item) => item.panelId === "panel-b")?.translationMm;
  assert.ok(childTranslation);
  assert.ok(Math.abs(Math.hypot(childTranslation[0], childTranslation[1]) - 4.1) < 1e-8);
});

test("applies subtree bend spacing to real projected BRep boundaries without making them price-authoritative", () => {
  const panels = panelEvidence();
  const orientation = buildBendOrientationPreview({ plan, panels });
  const boundary = buildBendBoundaryPreview2D({ orientation, panels });
  const spacing = buildBendAllowanceSpacingPreview({ plan, orientation, bends: [bend] });
  const spaced = applyBendAllowanceSpacingToBoundaryPreview({ boundary, spacing });

  assert.equal(boundary.status, "ready");
  assert.equal(spacing.status, "ready");
  assert.equal(spaced.status, "ready");
  assert.equal(spaced.productionAuthoritative, false);
  assert.equal(spaced.commercialSpacingApplied, true);
  assert.equal(spaced.panels.length, 2);

  const before = boundary.panels.find((panel) => panel.panelId === "panel-b")!.wires[0].edges[0].pointsMm[0];
  const after = spaced.panels.find((panel) => panel.panelId === "panel-b")!.wires[0].edges[0].pointsMm[0];
  assert.ok(Math.abs(Math.hypot(after[0] - before[0], after[1] - before[1]) - 4.1) < 1e-8);
});

test("blocks spacing when BRep tangency evidence is absent", () => {
  const panels = panelEvidence();
  const orientation = buildBendOrientationPreview({ plan, panels });
  const spacing = buildBendAllowanceSpacingPreview({
    plan,
    orientation,
    bends: [{ ...bend, tangentSegments: undefined }],
  });

  assert.equal(spacing.status, "blocked");
  assert.equal(spacing.commercialSpacingApplied, false);
  assert.match(spacing.errors.join(" "), /no paired BRep tangency segments/i);
});

test("blocks spacing when rigid flattening puts both panel interiors on the same side of the tangent", () => {
  const panels = panelEvidence([50, 1, -30]);
  const orientation = buildBendOrientationPreview({ plan, panels });
  assert.equal(orientation.status, "ready");

  const spacing = buildBendAllowanceSpacingPreview({ plan, orientation, bends: [bend] });
  assert.equal(spacing.status, "blocked");
  assert.match(spacing.errors.join(" "), /same side of the tangency line/i);
});

test("propagates upstream spacing through a two-bend panel tree before applying the child allowance", () => {
  const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const;
  const twoBendPlan: BendUnfoldPlan = {
    status: "ready",
    rootFaceId: "panel-a",
    panelOrder: ["panel-a", "panel-b", "panel-c"],
    steps: [
      {
        index: 0,
        bendId: "bend-ab",
        parentFaceId: "panel-a",
        childFaceId: "panel-b",
        axisStartMm: [0, 0, 0],
        axisEndMm: [100, 0, 0],
        angleDeg: 90,
        insideRadiusMm: 3,
        bendAllowanceMm: 4,
      },
      {
        index: 1,
        bendId: "bend-bc",
        parentFaceId: "panel-b",
        childFaceId: "panel-c",
        axisStartMm: [0, -50, 0],
        axisEndMm: [100, -50, 0],
        angleDeg: 90,
        insideRadiusMm: 3,
        bendAllowanceMm: 6,
      },
    ],
    errors: [],
  };
  const orientation: BendOrientationPreview = {
    source: "brep-rigid-rotation",
    displayOnly: true,
    commercialSpacingApplied: false,
    status: "ready",
    rootPanelId: "panel-a",
    panels: [
      {
        panelId: "panel-a",
        transformedCenterMm: [50, 25, 0],
        transformedNormal: [0, 0, 1],
        transform: { rotation: [...identity], translation: [0, 0, 0] },
      },
      {
        panelId: "panel-b",
        transformedCenterMm: [50, -25, 0],
        transformedNormal: [0, 0, 1],
        transform: { rotation: [...identity], translation: [0, 0, 0] },
      },
      {
        panelId: "panel-c",
        transformedCenterMm: [50, -75, 0],
        transformedNormal: [0, 0, 1],
        transform: { rotation: [...identity], translation: [0, 0, 0] },
      },
    ],
    errors: [],
  };
  const bends: BRepBendGeometryEvidence[] = [
    {
      bendId: "bend-ab",
      sourceCylinderFaceIds: ["ab-inner", "ab-outer"],
      panelIds: ["panel-a", "panel-b"],
      axisStartMm: [0, 0, 0],
      axisEndMm: [100, 0, 0],
      angleDeg: 90,
      insideRadiusMm: 3,
      tangentSegments: [
        { panelId: "panel-a", startMm: [0, 0, 0], endMm: [100, 0, 0], sourceEdgeHashes: [301, 401] },
        { panelId: "panel-b", startMm: [0, 0, 0], endMm: [100, 0, 0], sourceEdgeHashes: [302, 402] },
      ],
    },
    {
      bendId: "bend-bc",
      sourceCylinderFaceIds: ["bc-inner", "bc-outer"],
      panelIds: ["panel-b", "panel-c"],
      axisStartMm: [0, -50, 0],
      axisEndMm: [100, -50, 0],
      angleDeg: 90,
      insideRadiusMm: 3,
      tangentSegments: [
        { panelId: "panel-b", startMm: [0, -50, 0], endMm: [100, -50, 0], sourceEdgeHashes: [303, 403] },
        { panelId: "panel-c", startMm: [0, -50, 0], endMm: [100, -50, 0], sourceEdgeHashes: [304, 404] },
      ],
    },
  ];

  const spacing = buildBendAllowanceSpacingPreview({ plan: twoBendPlan, orientation, bends });
  assert.equal(spacing.status, "ready");
  assert.equal(spacing.bends.length, 2);
  assert.ok(Math.abs(spacing.bends[0].gapAfterMm - 4) < 1e-8);
  assert.ok(Math.abs(spacing.bends[1].gapAfterMm - 6) < 1e-8);

  const translationA = spacing.panelTranslationsMm.find((item) => item.panelId === "panel-a")!.translationMm;
  const translationB = spacing.panelTranslationsMm.find((item) => item.panelId === "panel-b")!.translationMm;
  const translationC = spacing.panelTranslationsMm.find((item) => item.panelId === "panel-c")!.translationMm;
  assert.deepEqual(translationA, [0, 0]);
  assert.ok(Math.abs(Math.hypot(translationB[0], translationB[1]) - 4) < 1e-8);
  assert.ok(Math.abs(Math.hypot(translationC[0] - translationB[0], translationC[1] - translationB[1]) - 6) < 1e-8);
  assert.ok(Math.abs(Math.hypot(translationC[0], translationC[1]) - 10) < 1e-8);
});
