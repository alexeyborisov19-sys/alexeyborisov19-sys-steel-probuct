import type { FlatBoundaryWire2D } from "@/lib/instant-quote/bend-boundary-preview";
import type { BendStripRegionCandidate } from "@/lib/instant-quote/bend-strip-region";
import type { SpacedBendBoundaryPreview2D, Vector2 } from "@/lib/instant-quote/bend-spacing-preview";
import type { FlatPatternMaterialCollisionCheck } from "@/lib/instant-quote/flat-pattern-material-collision";

export type FlatPatternRegionNode = {
  kind: "panel" | "bend-strip";
  id: string;
};

export type FlatPatternRegionLink = {
  bendId: string;
  parentPanelId: string;
  childPanelId: string;
};

export type FlatPatternSampledBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  widthMm: number;
  heightMm: number;
};

export type FlatPatternRegionCandidate = {
  source: "sampled-flat-pattern-region-candidate";
  displayOnly: true;
  productionAuthoritative: false;
  status: "ready" | "blocked";
  rootPanelId?: string;
  panelIds: string[];
  bendIds: string[];
  componentCount: number;
  sampledPanelNetAreaMm2?: number;
  bendStripAreaMm2?: number;
  sampledMaterialAreaMm2?: number;
  sampledBoundsMm?: FlatPatternSampledBounds;
  nodes: FlatPatternRegionNode[];
  links: FlatPatternRegionLink[];
  errors: string[];
};

type ClosedSampledLoop = {
  points: Vector2[];
  absoluteAreaMm2: number;
};

const STITCH_TOLERANCE_MM = 0.01;
const AREA_EPSILON_MM2 = 1e-6;

function distance(a: Vector2, b: Vector2) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function close(a: Vector2, b: Vector2) {
  return distance(a, b) <= STITCH_TOLERANCE_MM;
}

function dedupeConsecutive(points: Vector2[]) {
  const output: Vector2[] = [];
  for (const point of points) {
    if (!output.length || !close(output[output.length - 1], point)) output.push(point);
  }
  if (output.length > 1 && close(output[0], output[output.length - 1])) output.pop();
  return output;
}

function signedArea(points: Vector2[]) {
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    twiceArea += current[0] * next[1] - next[0] * current[1];
  }
  return twiceArea / 2;
}

function stitchWire(wire: FlatBoundaryWire2D): { loop?: ClosedSampledLoop; error?: string } {
  if (!wire.edges.length) return { error: `Wire ${wire.id} has no sampled edges.` };
  const remaining = wire.edges.map((edge) => edge.pointsMm.map((point) => [point[0], point[1]] as Vector2));
  if (remaining.some((points) => points.length < 2)) return { error: `Wire ${wire.id} contains an incomplete sampled edge.` };

  const first = remaining.shift()!;
  const chain = [...first];
  while (remaining.length) {
    const end = chain[chain.length - 1];
    const matchIndex = remaining.findIndex((points) => close(points[0], end) || close(points[points.length - 1], end));
    if (matchIndex < 0) return { error: `Wire ${wire.id} cannot be stitched into one closed sampled loop.` };
    const [match] = remaining.splice(matchIndex, 1);
    const aligned = close(match[0], end) ? match : [...match].reverse();
    chain.push(...aligned.slice(1));
  }

  if (!close(chain[0], chain[chain.length - 1])) return { error: `Wire ${wire.id} remains open after sampled stitching.` };
  const points = dedupeConsecutive(chain);
  if (points.length < 3) return { error: `Wire ${wire.id} has fewer than three unique sampled points.` };
  const areaMm2 = Math.abs(signedArea(points));
  if (!Number.isFinite(areaMm2) || areaMm2 <= AREA_EPSILON_MM2) return { error: `Wire ${wire.id} has zero or non-finite sampled area.` };
  return { loop: { points, absoluteAreaMm2: areaMm2 } };
}

function panelNetArea(wires: FlatBoundaryWire2D[]) {
  const loops: ClosedSampledLoop[] = [];
  const errors: string[] = [];
  for (const wire of wires) {
    const stitched = stitchWire(wire);
    if (stitched.loop) loops.push(stitched.loop);
    else errors.push(stitched.error ?? `Wire ${wire.id} could not be reconstructed.`);
  }
  if (errors.length || loops.length !== wires.length || !loops.length) return { errors };
  loops.sort((left, right) => right.absoluteAreaMm2 - left.absoluteAreaMm2);
  const outer = loops[0].absoluteAreaMm2;
  const holes = loops.slice(1).reduce((sum, loop) => sum + loop.absoluteAreaMm2, 0);
  const netAreaMm2 = outer - holes;
  if (!Number.isFinite(netAreaMm2) || netAreaMm2 <= AREA_EPSILON_MM2) {
    return { errors: ["Sampled panel net area is zero or negative after subtracting inner wires."] };
  }
  return { netAreaMm2, errors: [] as string[] };
}

function sampledBounds(points: Vector2[]): FlatPatternSampledBounds | undefined {
  if (!points.length || points.some((point) => !Number.isFinite(point[0]) || !Number.isFinite(point[1]))) return undefined;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const widthMm = maxX - minX;
  const heightMm = maxY - minY;
  if (!(widthMm > 0) || !(heightMm > 0)) return undefined;
  return { minX, minY, maxX, maxY, widthMm, heightMm };
}

function connectedComponentCount(nodes: FlatPatternRegionNode[], links: FlatPatternRegionLink[]) {
  if (!nodes.length) return 0;
  const adjacency = new Map(nodes.map((node) => [`${node.kind}:${node.id}`, new Set<string>()]));
  for (const link of links) {
    const stripKey = `bend-strip:${link.bendId}`;
    const parentKey = `panel:${link.parentPanelId}`;
    const childKey = `panel:${link.childPanelId}`;
    adjacency.get(stripKey)?.add(parentKey);
    adjacency.get(stripKey)?.add(childKey);
    adjacency.get(parentKey)?.add(stripKey);
    adjacency.get(childKey)?.add(stripKey);
  }

  const visited = new Set<string>();
  let components = 0;
  for (const key of adjacency.keys()) {
    if (visited.has(key)) continue;
    components += 1;
    const queue = [key];
    visited.add(key);
    while (queue.length) {
      const current = queue.shift()!;
      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return components;
}

/**
 * Builds a sampled material-region candidate after bend spacing and collision
 * gates. This deliberately stops short of a geometric boolean union: it records
 * connected panel/strip topology, sampled net area and bounds only. A ready
 * candidate is still non-authoritative and must not feed pricing or CAM until an
 * exact outer/hole contour is reconstructed and independently audited.
 */
export function buildFlatPatternRegionCandidate(input: {
  boundary: SpacedBendBoundaryPreview2D;
  strips: BendStripRegionCandidate;
  collisions: FlatPatternMaterialCollisionCheck;
}): FlatPatternRegionCandidate {
  const { boundary, strips, collisions } = input;
  const rootPanelId = boundary.rootPanelId ?? strips.rootPanelId;
  const blockedBase: Omit<FlatPatternRegionCandidate, "status" | "errors"> = {
    source: "sampled-flat-pattern-region-candidate",
    displayOnly: true,
    productionAuthoritative: false,
    rootPanelId,
    panelIds: [],
    bendIds: [],
    componentCount: 0,
    nodes: [],
    links: [],
  };

  const preconditionErrors: string[] = [];
  if (boundary.status !== "ready" || !boundary.commercialSpacingApplied) preconditionErrors.push(...(boundary.errors.length ? boundary.errors : ["Flat-pattern region requires a ready bend-spaced boundary preview."]));
  if (strips.status !== "ready") preconditionErrors.push(...(strips.errors.length ? strips.errors : ["Flat-pattern region requires ready bend-strip evidence."]));
  if (collisions.status !== "clear") {
    preconditionErrors.push(...(collisions.errors.length ? collisions.errors : [`Flat-pattern material collision gate is ${collisions.status}.`]));
  }
  if (!rootPanelId) preconditionErrors.push("Flat-pattern region requires a root panel id.");
  if (boundary.rootPanelId && strips.rootPanelId && boundary.rootPanelId !== strips.rootPanelId) preconditionErrors.push("Boundary and bend-strip evidence disagree on the root panel.");
  if (preconditionErrors.length) return { ...blockedBase, status: "blocked", errors: preconditionErrors };

  const panelIds = boundary.panels.map((panel) => panel.panelId);
  const bendIds = strips.strips.map((strip) => strip.bendId);
  const errors: string[] = [];
  if (new Set(panelIds).size !== panelIds.length) errors.push("Flat-pattern region contains duplicate panel ids.");
  if (new Set(bendIds).size !== bendIds.length) errors.push("Flat-pattern region contains duplicate bend ids.");
  if (!panelIds.includes(rootPanelId!)) errors.push("Flat-pattern root panel is missing from the spaced panel regions.");

  const panelIdSet = new Set(panelIds);
  const links: FlatPatternRegionLink[] = strips.strips.map((strip) => ({
    bendId: strip.bendId,
    parentPanelId: strip.parentPanelId,
    childPanelId: strip.childPanelId,
  }));
  for (const link of links) {
    if (!panelIdSet.has(link.parentPanelId) || !panelIdSet.has(link.childPanelId)) errors.push(`Bend ${link.bendId} references a panel absent from the spaced boundary preview.`);
    if (link.parentPanelId === link.childPanelId) errors.push(`Bend ${link.bendId} cannot connect a panel to itself.`);
  }

  const checkedPanels = new Set(collisions.checkedPanelIds);
  const checkedBends = new Set(collisions.checkedBendIds);
  if (panelIds.some((id) => !checkedPanels.has(id))) errors.push("Collision gate did not cover every flat-pattern panel.");
  if (bendIds.some((id) => !checkedBends.has(id))) errors.push("Collision gate did not cover every bend strip.");

  let sampledPanelNetAreaMm2 = 0;
  for (const panel of boundary.panels) {
    const area = panelNetArea(panel.wires);
    errors.push(...area.errors.map((error) => `Panel ${panel.panelId}: ${error}`));
    if (area.netAreaMm2 != null) sampledPanelNetAreaMm2 += area.netAreaMm2;
  }
  const bendStripAreaMm2 = strips.strips.reduce((sum, strip) => sum + strip.areaMm2, 0);
  if (!Number.isFinite(bendStripAreaMm2) || bendStripAreaMm2 < 0) errors.push("Bend-strip sampled area is invalid.");

  const nodes: FlatPatternRegionNode[] = [
    ...panelIds.map((id) => ({ kind: "panel" as const, id })),
    ...bendIds.map((id) => ({ kind: "bend-strip" as const, id })),
  ];
  const componentCount = connectedComponentCount(nodes, links);
  if (componentCount !== 1) errors.push(`Flat-pattern material graph has ${componentCount} disconnected components; exactly one is required.`);

  const allPoints: Vector2[] = [];
  for (const panel of boundary.panels) {
    for (const wire of panel.wires) for (const edge of wire.edges) allPoints.push(...edge.pointsMm);
  }
  for (const strip of strips.strips) allPoints.push(...strip.cornersMm);
  const bounds = sampledBounds(allPoints);
  if (!bounds) errors.push("Flat-pattern sampled bounds are missing or degenerate.");

  if (errors.length) {
    return {
      ...blockedBase,
      status: "blocked",
      panelIds,
      bendIds,
      componentCount,
      nodes,
      links,
      errors,
    };
  }

  const sampledMaterialAreaMm2 = sampledPanelNetAreaMm2 + bendStripAreaMm2;
  return {
    source: "sampled-flat-pattern-region-candidate",
    displayOnly: true,
    productionAuthoritative: false,
    status: "ready",
    rootPanelId,
    panelIds,
    bendIds,
    componentCount,
    sampledPanelNetAreaMm2,
    bendStripAreaMm2,
    sampledMaterialAreaMm2,
    sampledBoundsMm: bounds,
    nodes,
    links,
    errors: [],
  };
}
