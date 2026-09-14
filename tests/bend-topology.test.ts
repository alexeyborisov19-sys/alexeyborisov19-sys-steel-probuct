import assert from "node:assert/strict";
import test from "node:test";
import { buildBendTopologyGraph } from "../lib/instant-quote/bend-topology";
import type { SheetMetalAnalysis, SheetMetalBendCandidate } from "../lib/instant-quote/sheet-metal";

function bend(id: string, neighbors: string[]): SheetMetalBendCandidate {
  return {
    id,
    faceIds: [`${id}-inner`, `${id}-outer`],
    planarNeighborFaceIds: neighbors,
    radiusMm: 2,
    outerRadiusMm: 4,
    angleDeg: 90,
    areaMm2: 200,
  };
}

function analysis(bends: SheetMetalBendCandidate[]): SheetMetalAnalysis {
  return {
    source: "brep",
    status: "candidate",
    planarFaceCount: 4,
    cylindricalFaceCount: bends.length * 2,
    otherFaceCount: 0,
    thicknessCandidate: {
      thicknessMm: 2,
      confidence: "medium",
      evidencePairs: 2,
      evidenceFaceIds: ["A", "B"],
    },
    bendCandidates: bends,
    warnings: [],
  };
}

test("builds a deterministic tree traversal for an unambiguous bent sheet", () => {
  const graph = buildBendTopologyGraph(analysis([
    bend("bend-1", ["A", "B"]),
    bend("bend-2", ["B", "C"]),
  ]));

  assert.equal(graph.status, "tree");
  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.edges.length, 2);
  assert.equal(graph.rootFaceId, "A");
  assert.deepEqual(graph.traversalFaceIds, ["A", "B", "C"]);
  assert.deepEqual(graph.issues, []);
});

test("rejects a bend connected to more than two planar regions", () => {
  const graph = buildBendTopologyGraph(analysis([
    bend("bend-1", ["A", "B", "C"]),
  ]));

  assert.equal(graph.status, "ambiguous");
  assert.match(graph.issues.join(" "), /exactly two distinct planar/i);
});

test("marks a closed bend cycle as non-unique for automatic unfold traversal", () => {
  const graph = buildBendTopologyGraph(analysis([
    bend("bend-1", ["A", "B"]),
    bend("bend-2", ["B", "C"]),
    bend("bend-3", ["C", "A"]),
  ]));

  assert.equal(graph.status, "cyclic");
  assert.match(graph.issues.join(" "), /cycle/i);
});

test("returns empty topology when no bends are detected", () => {
  assert.deepEqual(buildBendTopologyGraph(analysis([])), {
    status: "empty",
    nodes: [],
    edges: [],
    traversalFaceIds: [],
    issues: [],
  });
});
