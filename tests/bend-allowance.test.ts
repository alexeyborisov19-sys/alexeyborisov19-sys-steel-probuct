import assert from "node:assert/strict";
import test from "node:test";
import { resolveApprovedBendAllowances, validateApprovedBendAllowanceTable } from "../lib/instant-quote/bend-allowance";
import type { BendTopologyGraph } from "../lib/instant-quote/bend-topology";

const graph: BendTopologyGraph = {
  status: "tree",
  nodes: [
    { faceId: "A", bendIds: ["bend-1"] },
    { faceId: "B", bendIds: ["bend-1", "bend-2"] },
    { faceId: "C", bendIds: ["bend-2"] },
  ],
  edges: [
    { bendId: "bend-1", fromFaceId: "A", toFaceId: "B", angleDeg: 90, insideRadiusMm: 2 },
    { bendId: "bend-2", fromFaceId: "B", toFaceId: "C", angleDeg: 45, insideRadiusMm: 2 },
  ],
  rootFaceId: "A",
  traversalFaceIds: ["A", "B", "C"],
  issues: [],
};

function table() {
  return {
    id: "steel-2mm-approved-2026-09",
    materialId: "hot",
    thicknessMm: 2,
    approvedAt: "2026-09-14T09:00:00.000Z",
    approvedBy: "production-engineering",
    source: "approved bend test table",
    entries: [
      { insideRadiusMm: 2, angleDeg: 90, bendAllowanceMm: 3.2 },
      { insideRadiusMm: 2, angleDeg: 45, bendAllowanceMm: 1.6 },
    ],
  };
}

test("resolves every bend only from explicit approved rows", () => {
  const result = resolveApprovedBendAllowances({
    graph,
    table: table(),
    materialId: "hot",
    confirmedThicknessMm: 2,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.values.map(({ bendId, bendAllowanceMm }) => ({ bendId, bendAllowanceMm })), [
    { bendId: "bend-1", bendAllowanceMm: 3.2 },
    { bendId: "bend-2", bendAllowanceMm: 1.6 },
  ]);
});

test("does not interpolate or choose a nearest bend row", () => {
  const missing = table();
  missing.entries = missing.entries.filter((entry) => entry.angleDeg !== 45);

  const result = resolveApprovedBendAllowances({
    graph,
    table: missing,
    materialId: "hot",
    confirmedThicknessMm: 2,
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.values, []);
  assert.match(result.errors.join(" "), /No approved bend allowance row.*bend-2/i);
});

test("rejects a table for another material or thickness", () => {
  const wrong = table();
  wrong.materialId = "zinc";
  wrong.thicknessMm = 1.5;

  const result = resolveApprovedBendAllowances({
    graph,
    table: wrong,
    materialId: "hot",
    confirmedThicknessMm: 2,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /approved for zinc/i);
  assert.match(result.errors.join(" "), /does not match confirmed thickness/i);
});

test("rejects duplicate explicit table coordinates", () => {
  const duplicate = table();
  duplicate.entries.push({ insideRadiusMm: 2, angleDeg: 90, bendAllowanceMm: 3.3 });
  const validation = validateApprovedBendAllowanceTable(duplicate);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join(" "), /Duplicate bend allowance entry/i);
});
