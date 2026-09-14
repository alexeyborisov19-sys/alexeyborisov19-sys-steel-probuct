import assert from "node:assert/strict";
import test from "node:test";
import { buildBendOrientationPreview } from "../lib/instant-quote/bend-orientation-preview";
import type { BendUnfoldPlan } from "../lib/instant-quote/bend-unfold-plan";
import type { BRepPanelRegionEvidence } from "../lib/instant-quote/unfold-geometry";

const panels: BRepPanelRegionEvidence[] = [
  {
    id: "panel-a",
    sourceFaceIds: ["a-top", "a-bottom"],
    centerMm: [50, 25, 0],
    normal: [0, 0, 1],
    areaMm2: 5000,
  },
  {
    id: "panel-b",
    sourceFaceIds: ["b-top", "b-bottom"],
    centerMm: [50, 0, 25],
    normal: [0, 1, 0],
    areaMm2: 3000,
  },
];

function plan(angleDeg = 90): BendUnfoldPlan {
  return {
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
        angleDeg,
        insideRadiusMm: 3,
        bendAllowanceMm: 4.1,
      },
    ],
    errors: [],
  };
}

test("flattens a 90-degree child panel into the root panel plane using the BRep bend axis", () => {
  const preview = buildBendOrientationPreview({ plan: plan(), panels });

  assert.equal(preview.status, "ready");
  assert.equal(preview.displayOnly, true);
  assert.equal(preview.commercialSpacingApplied, false);
  assert.equal(preview.panels.length, 2);

  const root = preview.panels.find((panel) => panel.panelId === "panel-a")!;
  const child = preview.panels.find((panel) => panel.panelId === "panel-b")!;
  const normalDot = root.transformedNormal[0] * child.transformedNormal[0]
    + root.transformedNormal[1] * child.transformedNormal[1]
    + root.transformedNormal[2] * child.transformedNormal[2];
  assert.ok(normalDot > 0.999999);
});

test("blocks orientation preview when the planar dihedral angle disagrees with the detected bend angle", () => {
  const preview = buildBendOrientationPreview({ plan: plan(60), panels });

  assert.equal(preview.status, "blocked");
  assert.match(preview.errors.join(" "), /does not agree with detected bend angle/i);
});

test("does not run when the unfold plan itself is blocked", () => {
  const preview = buildBendOrientationPreview({
    plan: { ...plan(), status: "blocked", steps: [], errors: ["missing approved allowance"] },
    panels,
  });

  assert.equal(preview.status, "blocked");
  assert.match(preview.errors.join(" "), /missing approved allowance/i);
});
