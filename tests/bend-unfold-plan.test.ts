import assert from "node:assert/strict";
import test from "node:test";
import { buildBendUnfoldPlan } from "../lib/instant-quote/bend-unfold-plan";
import type { BendTopologyGraph } from "../lib/instant-quote/bend-topology";

const graph: BendTopologyGraph = {
  status: "tree",
  nodes: [
    { faceId: "A", bendIds: ["b1"] },
    { faceId: "B", bendIds: ["b1", "b2"] },
    { faceId: "C", bendIds: ["b2"] },
  ],
  edges: [
    { bendId: "b1", fromFaceId: "A", toFaceId: "B", angleDeg: 90, insideRadiusMm: 2 },
    { bendId: "b2", fromFaceId: "B", toFaceId: "C", angleDeg: 45, insideRadiusMm: 2 },
  ],
  rootFaceId: "A",
  traversalFaceIds: ["A", "B", "C"],
  issues: [],
};

const panels = [
  { faceId: "A", centerMm: [0, 0, 0] as [number, number, number], normal: [0, 0, 1] as [number, number, number] },
  { faceId: "B", centerMm: [50, 0, 20] as [number, number, number], normal: [0, 1, 0] as [number, number, number] },
  { faceId: "C", centerMm: [100, 20, 20] as [number, number, number], normal: [1, 0, 0] as [number, number, number] },
];

const bendAxes = [
  { bendId: "b1", startMm: [0, 0, 0] as [number, number, number], endMm: [0, 100, 0] as [number, number, number] },
  { bendId: "b2", startMm: [50, 0, 20] as [number, number, number], endMm: [50, 100, 20] as [number, number, number] },
];

const allowances = [
  { bendId: "b1", tableId: "approved", insideRadiusMm: 2, angleDeg: 90, bendAllowanceMm: 3.2 },
  { bendId: "b2", tableId: "approved", insideRadiusMm: 2, angleDeg: 45, bendAllowanceMm: 1.6 },
];

test("creates deterministic parent-child unfold steps only when every input is present", () => {
  const plan = buildBendUnfoldPlan({ graph, panels, bendAxes, allowances });

  assert.equal(plan.status, "ready");
  assert.equal(plan.rootFaceId, "A");
  assert.deepEqual(plan.panelOrder, ["A", "B", "C"]);
  assert.deepEqual(plan.steps.map((step) => [step.bendId, step.parentFaceId, step.childFaceId]), [
    ["b1", "A", "B"],
    ["b2", "B", "C"],
  ]);
  assert.deepEqual(plan.steps.map((step) => step.bendAllowanceMm), [3.2, 1.6]);
});

test("blocks unfold planning when any bend axis is missing", () => {
  const plan = buildBendUnfoldPlan({ graph, panels, bendAxes: bendAxes.slice(0, 1), allowances });
  assert.equal(plan.status, "blocked");
  assert.equal(plan.steps.length, 0);
  assert.match(plan.errors.join(" "), /bend axis.*b2/i);
});

test("blocks unfold planning when a planar region has no exact BRep geometry", () => {
  const plan = buildBendUnfoldPlan({ graph, panels: panels.filter((panel) => panel.faceId !== "C"), bendAxes, allowances });
  assert.equal(plan.status, "blocked");
  assert.match(plan.errors.join(" "), /face C/i);
});

test("blocks unfold planning when an approved allowance is missing", () => {
  const plan = buildBendUnfoldPlan({ graph, panels, bendAxes, allowances: allowances.slice(0, 1) });
  assert.equal(plan.status, "blocked");
  assert.match(plan.errors.join(" "), /allowance.*b2/i);
});
