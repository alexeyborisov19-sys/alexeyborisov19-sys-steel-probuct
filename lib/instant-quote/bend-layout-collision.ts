import type {
  FlatBoundaryWire2D,
} from "@/lib/instant-quote/bend-boundary-preview";
import type { SpacedBendBoundaryPreview2D } from "@/lib/instant-quote/bend-spacing-preview";

export type Vector2 = [number, number];

export type BendLayoutCollisionFinding = {
  panelA: string;
  panelB: string;
  reason: "boundary-intersection" | "material-containment";
};

export type BendLayoutCollisionCheck = {
  source: "sampled-brep-boundary-collision-check";
  displayOnly: true;
  productionAuthoritative: false;
  status: "clear" | "collision" | "blocked";
  checkedPanelIds: string[];
  collisions: BendLayoutCollisionFinding[];
  errors: string[];
};

type ClosedLoop2D = {
  wireId: string;
  points: Vector2[];
  signedAreaMm2: number;
};

type PanelRegion2D = {
  panelId: string;
  outer: ClosedLoop2D;
  holes: ClosedLoop2D[];
};

const STITCH_TOLERANCE_MM = 0.01;
const GEOMETRY_EPSILON = 1e-9;

function subtract(a: Vector2, b: Vector2): Vector2 {
  return [a[0] - b[0], a[1] - b[1]];
}

function cross(a: Vector2, b: Vector2) {
  return a[0] * b[1] - a[1] * b[0];
}

function distance(a: Vector2, b: Vector2) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function close(a: Vector2, b: Vector2) {
  return distance(a, b) <= STITCH_TOLERANCE_MM;
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

function pointOnSegment(point: Vector2, start: Vector2, end: Vector2) {
  const segment = subtract(end, start);
  const relative = subtract(point, start);
  if (Math.abs(cross(segment, relative)) > STITCH_TOLERANCE_MM) return false;
  const minX = Math.min(start[0], end[0]) - STITCH_TOLERANCE_MM;
  const maxX = Math.max(start[0], end[0]) + STITCH_TOLERANCE_MM;
  const minY = Math.min(start[1], end[1]) - STITCH_TOLERANCE_MM;
  const maxY = Math.max(start[1], end[1]) + STITCH_TOLERANCE_MM;
  return point[0] >= minX && point[0] <= maxX && point[1] >= minY && point[1] <= maxY;
}

function segmentsIntersect(a0: Vector2, a1: Vector2, b0: Vector2, b1: Vector2) {
  const a = subtract(a1, a0);
  const b = subtract(b1, b0);
  const c1 = cross(a, subtract(b0, a0));
  const c2 = cross(a, subtract(b1, a0));
  const c3 = cross(b, subtract(a0, b0));
  const c4 = cross(b, subtract(a1, b0));

  const oppositeA = (c1 > GEOMETRY_EPSILON && c2 < -GEOMETRY_EPSILON)
    || (c1 < -GEOMETRY_EPSILON && c2 > GEOMETRY_EPSILON);
  const oppositeB = (c3 > GEOMETRY_EPSILON && c4 < -GEOMETRY_EPSILON)
    || (c3 < -GEOMETRY_EPSILON && c4 > GEOMETRY_EPSILON);
  if (oppositeA && oppositeB) return true;

  if (Math.abs(c1) <= GEOMETRY_EPSILON && pointOnSegment(b0, a0, a1)) return true;
  if (Math.abs(c2) <= GEOMETRY_EPSILON && pointOnSegment(b1, a0, a1)) return true;
  if (Math.abs(c3) <= GEOMETRY_EPSILON && pointOnSegment(a0, b0, b1)) return true;
  if (Math.abs(c4) <= GEOMETRY_EPSILON && pointOnSegment(a1, b0, b1)) return true;
  return false;
}

function dedupeConsecutive(points: Vector2[]) {
  const output: Vector2[] = [];
  for (const point of points) {
    if (!output.length || !close(output[output.length - 1], point)) output.push(point);
  }
  if (output.length > 1 && close(output[0], output[output.length - 1])) output.pop();
  return output;
}

function stitchWire(wire: FlatBoundaryWire2D): { loop?: ClosedLoop2D; error?: string } {
  if (!wire.edges.length) return { error: `Wire ${wire.id} has no sampled BRep edges.` };
  const remaining = wire.edges.map((edge) => ({
    id: edge.id,
    points: edge.pointsMm.map((point) => [point[0], point[1]] as Vector2),
  }));
  if (remaining.some((edge) => edge.points.length < 2)) {
    return { error: `Wire ${wire.id} contains an edge with fewer than two sampled points.` };
  }

  const first = remaining.shift()!;
  const chain = [...first.points];
  while (remaining.length) {
    const end = chain[chain.length - 1];
    const matchIndex = remaining.findIndex((edge) => close(edge.points[0], end) || close(edge.points[edge.points.length - 1], end));
    if (matchIndex < 0) return { error: `Wire ${wire.id} sampled BRep edges cannot be stitched into one closed chain.` };
    const [match] = remaining.splice(matchIndex, 1);
    const aligned = close(match.points[0], end) ? match.points : [...match.points].reverse();
    chain.push(...aligned.slice(1));
  }

  if (!close(chain[0], chain[chain.length - 1])) {
    return { error: `Wire ${wire.id} sampled BRep chain is open after stitching.` };
  }

  const points = dedupeConsecutive(chain);
  if (points.length < 3) return { error: `Wire ${wire.id} has fewer than three unique points.` };
  const area = signedArea(points);
  if (!Number.isFinite(area) || Math.abs(area) <= GEOMETRY_EPSILON) {
    return { error: `Wire ${wire.id} has zero or non-finite sampled area.` };
  }

  return { loop: { wireId: wire.id, points, signedAreaMm2: area } };
}

function loopSegments(loop: ClosedLoop2D) {
  return loop.points.map((point, index) => [point, loop.points[(index + 1) % loop.points.length]] as [Vector2, Vector2]);
}

function loopSelfIntersects(loop: ClosedLoop2D) {
  const segments = loopSegments(loop);
  for (let left = 0; left < segments.length; left += 1) {
    for (let right = left + 1; right < segments.length; right += 1) {
      if (right === left + 1) continue;
      if (left === 0 && right === segments.length - 1) continue;
      if (segmentsIntersect(segments[left][0], segments[left][1], segments[right][0], segments[right][1])) return true;
    }
  }
  return false;
}

function loopsIntersect(left: ClosedLoop2D, right: ClosedLoop2D) {
  const leftSegments = loopSegments(left);
  const rightSegments = loopSegments(right);
  return leftSegments.some(([a0, a1]) => rightSegments.some(([b0, b1]) => segmentsIntersect(a0, a1, b0, b1)));
}

function pointInLoop(point: Vector2, loop: ClosedLoop2D) {
  let inside = false;
  for (let index = 0, previous = loop.points.length - 1; index < loop.points.length; previous = index, index += 1) {
    const current = loop.points[index];
    const before = loop.points[previous];
    if (pointOnSegment(point, before, current)) return true;
    const crosses = (current[1] > point[1]) !== (before[1] > point[1]);
    if (!crosses) continue;
    const x = (before[0] - current[0]) * (point[1] - current[1]) / (before[1] - current[1]) + current[0];
    if (point[0] < x) inside = !inside;
  }
  return inside;
}

function pointInMaterial(point: Vector2, region: PanelRegion2D) {
  if (!pointInLoop(point, region.outer)) return false;
  return !region.holes.some((hole) => pointInLoop(point, hole));
}

function buildRegion(panelId: string, wires: FlatBoundaryWire2D[]): { region?: PanelRegion2D; errors: string[] } {
  const errors: string[] = [];
  const loops: ClosedLoop2D[] = [];
  for (const wire of wires) {
    const stitched = stitchWire(wire);
    if (!stitched.loop) {
      errors.push(stitched.error ?? `Wire ${wire.id} could not be reconstructed.`);
      continue;
    }
    if (loopSelfIntersects(stitched.loop)) {
      errors.push(`Wire ${wire.id} self-intersects after sampled BRep reconstruction.`);
      continue;
    }
    loops.push(stitched.loop);
  }

  if (errors.length || loops.length !== wires.length || !loops.length) return { errors };
  loops.sort((left, right) => Math.abs(right.signedAreaMm2) - Math.abs(left.signedAreaMm2));
  const [outer, ...holes] = loops;
  for (const hole of holes) {
    if (!pointInLoop(hole.points[0], outer) || loopsIntersect(hole, outer)) {
      errors.push(`Panel ${panelId} contains a sampled inner wire that is not strictly inside its outer wire.`);
    }
  }
  for (let left = 0; left < holes.length; left += 1) {
    for (let right = left + 1; right < holes.length; right += 1) {
      if (loopsIntersect(holes[left], holes[right])
        || pointInLoop(holes[left].points[0], holes[right])
        || pointInLoop(holes[right].points[0], holes[left])) {
        errors.push(`Panel ${panelId} contains overlapping or nested sampled hole wires.`);
      }
    }
  }

  return errors.length ? { errors } : { region: { panelId, outer, holes }, errors: [] };
}

function regionBoundariesIntersect(left: PanelRegion2D, right: PanelRegion2D) {
  const leftLoops = [left.outer, ...left.holes];
  const rightLoops = [right.outer, ...right.holes];
  return leftLoops.some((leftLoop) => rightLoops.some((rightLoop) => loopsIntersect(leftLoop, rightLoop)));
}

/**
 * Conservative collision gate over sampled BRep boundaries after approved bend
 * allowance spacing. A positive finding blocks later contour reconstruction.
 * A clear result is still not production-authoritative because curved BRep edges
 * are represented by display samples rather than exact analytic intersections.
 */
export function checkSampledBendLayoutCollisions(
  preview: SpacedBendBoundaryPreview2D,
): BendLayoutCollisionCheck {
  if (preview.status !== "ready" || !preview.commercialSpacingApplied) {
    return {
      source: "sampled-brep-boundary-collision-check",
      displayOnly: true,
      productionAuthoritative: false,
      status: "blocked",
      checkedPanelIds: [],
      collisions: [],
      errors: preview.errors.length ? [...preview.errors] : ["Collision checking requires a ready bend-spaced boundary preview."],
    };
  }

  const errors: string[] = [];
  const regions: PanelRegion2D[] = [];
  for (const panel of preview.panels) {
    const built = buildRegion(panel.panelId, panel.wires);
    errors.push(...built.errors);
    if (built.region) regions.push(built.region);
  }
  if (errors.length || regions.length !== preview.panels.length) {
    return {
      source: "sampled-brep-boundary-collision-check",
      displayOnly: true,
      productionAuthoritative: false,
      status: "blocked",
      checkedPanelIds: regions.map((region) => region.panelId),
      collisions: [],
      errors: errors.length ? errors : ["Not every spaced panel has a reconstructable sampled BRep material region."],
    };
  }

  const collisions: BendLayoutCollisionFinding[] = [];
  for (let left = 0; left < regions.length; left += 1) {
    for (let right = left + 1; right < regions.length; right += 1) {
      const a = regions[left];
      const b = regions[right];
      if (regionBoundariesIntersect(a, b)) {
        collisions.push({ panelA: a.panelId, panelB: b.panelId, reason: "boundary-intersection" });
        continue;
      }
      if (pointInMaterial(a.outer.points[0], b) || pointInMaterial(b.outer.points[0], a)) {
        collisions.push({ panelA: a.panelId, panelB: b.panelId, reason: "material-containment" });
      }
    }
  }

  return {
    source: "sampled-brep-boundary-collision-check",
    displayOnly: true,
    productionAuthoritative: false,
    status: collisions.length ? "collision" : "clear",
    checkedPanelIds: regions.map((region) => region.panelId),
    collisions,
    errors: [],
  };
}
