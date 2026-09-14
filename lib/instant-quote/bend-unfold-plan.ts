import type { ResolvedBendAllowance } from "@/lib/instant-quote/bend-allowance";
import type { BendTopologyGraph } from "@/lib/instant-quote/bend-topology";
import type { Vector3 } from "@/lib/instant-quote/sheet-metal";

export type PlanarRegionGeometryEvidence = {
  faceId: string;
  centerMm: Vector3;
  normal: Vector3;
};

export type BendAxisGeometryEvidence = {
  bendId: string;
  startMm: Vector3;
  endMm: Vector3;
};

export type BendUnfoldStep = {
  index: number;
  bendId: string;
  parentFaceId: string;
  childFaceId: string;
  axisStartMm: Vector3;
  axisEndMm: Vector3;
  angleDeg: number;
  insideRadiusMm: number;
  bendAllowanceMm: number;
};

export type BendUnfoldPlan = {
  status: "ready" | "blocked";
  rootFaceId?: string;
  panelOrder: string[];
  steps: BendUnfoldStep[];
  errors: string[];
};

function finiteVector(vector: Vector3) {
  return vector.length === 3 && vector.every(Number.isFinite);
}

function vectorLength(a: Vector3, b: Vector3) {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

function normalUsable(normal: Vector3) {
  return finiteVector(normal) && Math.hypot(normal[0], normal[1], normal[2]) > 1e-8;
}

/**
 * Produces the deterministic parent/child sequence required by a future 3D→2D
 * transform engine. It does not rotate panels or construct a commercial flat
 * pattern. Missing panel geometry, finite bend axes or resolved production bend
 * allowances block the plan before any coordinate calculation begins.
 */
export function buildBendUnfoldPlan(input: {
  graph: BendTopologyGraph;
  panels: PlanarRegionGeometryEvidence[];
  bendAxes: BendAxisGeometryEvidence[];
  allowances: ResolvedBendAllowance[];
}): BendUnfoldPlan {
  const { graph, panels, bendAxes, allowances } = input;
  const errors: string[] = [];

  if (graph.status !== "tree" || !graph.rootFaceId) {
    return {
      status: "blocked",
      rootFaceId: graph.rootFaceId,
      panelOrder: graph.traversalFaceIds,
      steps: [],
      errors: ["Automatic unfold planning requires an unambiguous connected bend tree with a root panel."],
    };
  }

  const panelById = new Map(panels.map((panel) => [panel.faceId, panel]));
  for (const node of graph.nodes) {
    const panel = panelById.get(node.faceId);
    if (!panel) {
      errors.push(`Missing planar BRep geometry for face ${node.faceId}.`);
      continue;
    }
    if (!finiteVector(panel.centerMm) || !normalUsable(panel.normal)) {
      errors.push(`Planar BRep geometry for face ${node.faceId} has an invalid center or normal.`);
    }
  }

  const axisByBend = new Map(bendAxes.map((axis) => [axis.bendId, axis]));
  const allowanceByBend = new Map(allowances.map((allowance) => [allowance.bendId, allowance]));
  for (const edge of graph.edges) {
    const axis = axisByBend.get(edge.bendId);
    if (!axis || !finiteVector(axis.startMm) || !finiteVector(axis.endMm) || vectorLength(axis.startMm, axis.endMm) <= 1e-8) {
      errors.push(`Missing finite BRep bend axis for ${edge.bendId}.`);
    }
    const allowance = allowanceByBend.get(edge.bendId);
    if (!allowance || !Number.isFinite(allowance.bendAllowanceMm) || allowance.bendAllowanceMm <= 0) {
      errors.push(`Missing resolved approved bend allowance for ${edge.bendId}.`);
    }
  }

  const duplicateAllowances = allowances.length !== new Set(allowances.map((item) => item.bendId)).size;
  if (duplicateAllowances) errors.push("Resolved bend allowances contain duplicate bend ids.");
  const duplicateAxes = bendAxes.length !== new Set(bendAxes.map((item) => item.bendId)).size;
  if (duplicateAxes) errors.push("BRep bend-axis evidence contains duplicate bend ids.");

  if (errors.length) {
    return {
      status: "blocked",
      rootFaceId: graph.rootFaceId,
      panelOrder: graph.traversalFaceIds,
      steps: [],
      errors,
    };
  }

  const adjacency = new Map<string, Array<{ faceId: string; bendId: string }>>();
  graph.nodes.forEach((node) => adjacency.set(node.faceId, []));
  graph.edges.forEach((edge) => {
    adjacency.get(edge.fromFaceId)?.push({ faceId: edge.toFaceId, bendId: edge.bendId });
    adjacency.get(edge.toFaceId)?.push({ faceId: edge.fromFaceId, bendId: edge.bendId });
  });

  const parent = new Map<string, { faceId: string; bendId: string }>();
  const queue = [graph.rootFaceId];
  const seen = new Set<string>([graph.rootFaceId]);
  while (queue.length) {
    const current = queue.shift()!;
    const neighbors = [...(adjacency.get(current) ?? [])].sort((a, b) => a.faceId.localeCompare(b.faceId));
    for (const neighbor of neighbors) {
      if (seen.has(neighbor.faceId)) continue;
      seen.add(neighbor.faceId);
      parent.set(neighbor.faceId, { faceId: current, bendId: neighbor.bendId });
      queue.push(neighbor.faceId);
    }
  }

  const edgeById = new Map(graph.edges.map((edge) => [edge.bendId, edge]));
  const steps: BendUnfoldStep[] = [];
  for (const childFaceId of graph.traversalFaceIds.slice(1)) {
    const relation = parent.get(childFaceId);
    if (!relation) {
      errors.push(`Traversal lost parent relation for panel ${childFaceId}.`);
      continue;
    }
    const edge = edgeById.get(relation.bendId)!;
    const axis = axisByBend.get(relation.bendId)!;
    const allowance = allowanceByBend.get(relation.bendId)!;
    steps.push({
      index: steps.length,
      bendId: edge.bendId,
      parentFaceId: relation.faceId,
      childFaceId,
      axisStartMm: axis.startMm,
      axisEndMm: axis.endMm,
      angleDeg: edge.angleDeg,
      insideRadiusMm: edge.insideRadiusMm,
      bendAllowanceMm: allowance.bendAllowanceMm,
    });
  }

  if (errors.length || steps.length !== graph.edges.length) {
    return {
      status: "blocked",
      rootFaceId: graph.rootFaceId,
      panelOrder: graph.traversalFaceIds,
      steps: [],
      errors: errors.length ? errors : ["Unfold traversal did not cover every bend exactly once."],
    };
  }

  return {
    status: "ready",
    rootFaceId: graph.rootFaceId,
    panelOrder: graph.traversalFaceIds,
    steps,
    errors: [],
  };
}
