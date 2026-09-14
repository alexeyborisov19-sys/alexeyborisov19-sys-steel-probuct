import type { SheetMetalAnalysis, SheetMetalBendCandidate } from "@/lib/instant-quote/sheet-metal";

export type BendTopologyNode = {
  faceId: string;
  bendIds: string[];
};

export type BendTopologyEdge = {
  bendId: string;
  fromFaceId: string;
  toFaceId: string;
  angleDeg: number;
  insideRadiusMm: number;
};

export type BendTopologyGraph = {
  status: "empty" | "tree" | "cyclic" | "ambiguous" | "disconnected";
  nodes: BendTopologyNode[];
  edges: BendTopologyEdge[];
  rootFaceId?: string;
  traversalFaceIds: string[];
  issues: string[];
};

function finitePositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

function exactPlanarPair(bend: SheetMetalBendCandidate) {
  const ids = [...new Set(bend.planarNeighborFaceIds.filter(Boolean))].sort();
  return ids.length === 2 ? (ids as [string, string]) : null;
}

function buildAdjacency(nodes: string[], edges: BendTopologyEdge[]) {
  const adjacency = new Map<string, Array<{ faceId: string; bendId: string }>>();
  nodes.forEach((faceId) => adjacency.set(faceId, []));
  edges.forEach((edge) => {
    adjacency.get(edge.fromFaceId)?.push({ faceId: edge.toFaceId, bendId: edge.bendId });
    adjacency.get(edge.toFaceId)?.push({ faceId: edge.fromFaceId, bendId: edge.bendId });
  });
  return adjacency;
}

function traverse(rootFaceId: string, adjacency: ReturnType<typeof buildAdjacency>) {
  const queue = [rootFaceId];
  const visited = new Set<string>();
  const order: string[] = [];

  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    order.push(current);
    const neighbors = [...(adjacency.get(current) ?? [])].sort((a, b) => a.faceId.localeCompare(b.faceId));
    neighbors.forEach(({ faceId }) => {
      if (!visited.has(faceId)) queue.push(faceId);
    });
  }

  return order;
}

/**
 * Builds only the connectivity graph needed before any geometric unfolding.
 * It deliberately does not calculate coordinates, bend allowance or a flat
 * pattern. Every accepted bend must connect exactly two planar BRep regions.
 */
export function buildBendTopologyGraph(sheetMetal?: SheetMetalAnalysis): BendTopologyGraph {
  const bends = sheetMetal?.bendCandidates ?? [];
  if (!bends.length) {
    return {
      status: "empty",
      nodes: [],
      edges: [],
      traversalFaceIds: [],
      issues: [],
    };
  }

  const issues: string[] = [];
  const edges: BendTopologyEdge[] = [];
  const seenBendIds = new Set<string>();

  for (const bend of bends) {
    if (!bend.id || seenBendIds.has(bend.id)) {
      issues.push(`Bend id '${bend.id || "<empty>"}' is missing or duplicated.`);
      continue;
    }
    seenBendIds.add(bend.id);

    const pair = exactPlanarPair(bend);
    if (!pair) {
      issues.push(`Bend ${bend.id} must connect exactly two distinct planar BRep faces.`);
      continue;
    }
    if (!finitePositive(bend.angleDeg) || !finitePositive(bend.radiusMm)) {
      issues.push(`Bend ${bend.id} has invalid angle or inside radius.`);
      continue;
    }

    edges.push({
      bendId: bend.id,
      fromFaceId: pair[0],
      toFaceId: pair[1],
      angleDeg: bend.angleDeg,
      insideRadiusMm: bend.radiusMm,
    });
  }

  if (issues.length || edges.length !== bends.length) {
    return {
      status: "ambiguous",
      nodes: [],
      edges,
      traversalFaceIds: [],
      issues,
    };
  }

  const faceIds = [...new Set(edges.flatMap((edge) => [edge.fromFaceId, edge.toFaceId]))].sort();
  const adjacency = buildAdjacency(faceIds, edges);
  const nodes = faceIds.map((faceId) => ({
    faceId,
    bendIds: [...(adjacency.get(faceId) ?? [])].map((item) => item.bendId).sort(),
  }));
  const rootFaceId = [...nodes].sort((a, b) => a.bendIds.length - b.bendIds.length || a.faceId.localeCompare(b.faceId))[0]?.faceId;
  const traversalFaceIds = rootFaceId ? traverse(rootFaceId, adjacency) : [];

  if (traversalFaceIds.length !== faceIds.length) {
    return {
      status: "disconnected",
      nodes,
      edges,
      rootFaceId,
      traversalFaceIds,
      issues: ["Bend topology contains disconnected planar regions."],
    };
  }

  if (edges.length >= nodes.length) {
    return {
      status: "cyclic",
      nodes,
      edges,
      rootFaceId,
      traversalFaceIds,
      issues: ["Bend topology contains a cycle; automatic traversal must not assume a unique unfold path."],
    };
  }

  if (edges.length !== Math.max(0, nodes.length - 1)) {
    return {
      status: "disconnected",
      nodes,
      edges,
      rootFaceId,
      traversalFaceIds,
      issues: ["Bend topology does not form a connected tree."],
    };
  }

  return {
    status: "tree",
    nodes,
    edges,
    rootFaceId,
    traversalFaceIds,
    issues: [],
  };
}
