import type { FlatBoundaryWire2D } from "@/lib/instant-quote/bend-boundary-preview";
import type { BendStripRegionCandidate, BendStripRegion2D } from "@/lib/instant-quote/bend-strip-region";
import {
  checkSampledBendLayoutCollisions,
  type BendLayoutCollisionCheck,
} from "@/lib/instant-quote/bend-layout-collision";
import type {
  SpacedBendBoundaryPreview2D,
  Vector2,
} from "@/lib/instant-quote/bend-spacing-preview";

export type FlatPatternMaterialEntity = {
  kind: "panel" | "bend-strip";
  id: string;
};

export type FlatPatternMaterialCollisionFinding = {
  entityA: FlatPatternMaterialEntity;
  entityB: FlatPatternMaterialEntity;
  reason:
    | "panel-panel-collision"
    | "unexpected-boundary-intersection"
    | "material-overlap"
    | "missing-expected-tangency-contact"
    | "strip-strip-collision";
};

export type FlatPatternMaterialCollisionCheck = {
  source: "sampled-flat-pattern-material-collision-check";
  displayOnly: true;
  productionAuthoritative: false;
  status: "clear" | "collision" | "blocked";
  checkedPanelIds: string[];
  checkedBendIds: string[];
  collisions: FlatPatternMaterialCollisionFinding[];
  errors: string[];
};

type ClosedLoop2D = {
  id: string;
  points: Vector2[];
  signedAreaMm2: number;
};

type PanelMaterialRegion2D = {
  panelId: string;
  outer: ClosedLoop2D;
  holes: ClosedLoop2D[];
};

const STITCH_TOLERANCE_MM = 0.01;
const GEOMETRY_EPSILON = 1e-9;

function subtract(a: Vector2, b: Vector2): Vector2 {
  return [a[0] - b[0], a[1] - b[1]];
}

function add(a: Vector2, b: Vector2): Vector2 {
  return [a[0] + b[0], a[1] + b[1]];
}

function scale(a: Vector2, factor: number): Vector2 {
  return [a[0] * factor, a[1] * factor];
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
  const segmentLength = Math.hypot(segment[0], segment[1]);
  if (!(segmentLength > GEOMETRY_EPSILON)) return close(point, start);
  if (Math.abs(cross(segment, relative)) / segmentLength > STITCH_TOLERANCE_MM) return false;
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

function segmentCollinearWithExpected(
  start: Vector2,
  end: Vector2,
  expectedStart: Vector2,
  expectedEnd: Vector2,
) {
  return pointOnSegment(start, expectedStart, expectedEnd)
    && pointOnSegment(end, expectedStart, expectedEnd);
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
  const remaining = wire.edges.map((edge) => edge.pointsMm.map((point) => [point[0], point[1]] as Vector2));
  if (remaining.some((points) => points.length < 2)) return { error: `Wire ${wire.id} has an incomplete sampled edge.` };

  const first = remaining.shift()!;
  const chain = [...first];
  while (remaining.length) {
    const end = chain[chain.length - 1];
    const matchIndex = remaining.findIndex((points) => close(points[0], end) || close(points[points.length - 1], end));
    if (matchIndex < 0) return { error: `Wire ${wire.id} cannot be stitched into one sampled closed chain.` };
    const [match] = remaining.splice(matchIndex, 1);
    const aligned = close(match[0], end) ? match : [...match].reverse();
    chain.push(...aligned.slice(1));
  }
  if (!close(chain[0], chain[chain.length - 1])) return { error: `Wire ${wire.id} remains open after sampled stitching.` };

  const points = dedupeConsecutive(chain);
  if (points.length < 3) return { error: `Wire ${wire.id} has fewer than three unique sampled points.` };
  const area = signedArea(points);
  if (!Number.isFinite(area) || Math.abs(area) <= GEOMETRY_EPSILON) return { error: `Wire ${wire.id} has zero sampled area.` };
  return { loop: { id: wire.id, points, signedAreaMm2: area } };
}

function loopSegments(loop: ClosedLoop2D) {
  return loop.points.map((point, index) => [point, loop.points[(index + 1) % loop.points.length]] as [Vector2, Vector2]);
}

function pointOnLoop(point: Vector2, loop: ClosedLoop2D) {
  return loopSegments(loop).some(([start, end]) => pointOnSegment(point, start, end));
}

function pointInLoopStrict(point: Vector2, loop: ClosedLoop2D) {
  if (pointOnLoop(point, loop)) return false;
  let inside = false;
  for (let index = 0, previous = loop.points.length - 1; index < loop.points.length; previous = index, index += 1) {
    const current = loop.points[index];
    const before = loop.points[previous];
    const crosses = (current[1] > point[1]) !== (before[1] > point[1]);
    if (!crosses) continue;
    const x = (before[0] - current[0]) * (point[1] - current[1]) / (before[1] - current[1]) + current[0];
    if (point[0] < x) inside = !inside;
  }
  return inside;
}

function pointInMaterialStrict(point: Vector2, region: PanelMaterialRegion2D) {
  if (!pointInLoopStrict(point, region.outer)) return false;
  return !region.holes.some((hole) => pointInLoopStrict(point, hole) || pointOnLoop(point, hole));
}

function buildPanelRegion(panelId: string, wires: FlatBoundaryWire2D[]) {
  const errors: string[] = [];
  const loops: ClosedLoop2D[] = [];
  for (const wire of wires) {
    const stitched = stitchWire(wire);
    if (stitched.loop) loops.push(stitched.loop);
    else errors.push(stitched.error ?? `Wire ${wire.id} could not be reconstructed.`);
  }
  if (errors.length || loops.length !== wires.length || !loops.length) return { errors };
  loops.sort((left, right) => Math.abs(right.signedAreaMm2) - Math.abs(left.signedAreaMm2));
  const [outer, ...holes] = loops;
  if (holes.some((hole) => !pointInLoopStrict(hole.points[0], outer))) {
    errors.push(`Panel ${panelId} contains an inner wire outside its sampled outer wire.`);
  }
  return errors.length ? { errors } : { region: { panelId, outer, holes } as PanelMaterialRegion2D, errors: [] };
}

function stripLoop(strip: BendStripRegion2D): ClosedLoop2D {
  return {
    id: `bend-strip:${strip.bendId}`,
    points: strip.cornersMm.map((point) => [point[0], point[1]] as Vector2),
    signedAreaMm2: signedArea(strip.cornersMm),
  };
}

function polygonCentroid(points: Vector2[]): Vector2 {
  return scale(points.reduce((sum, point) => add(sum, point), [0, 0] as Vector2), 1 / points.length);
}

function loopsHaveBoundaryIntersection(left: ClosedLoop2D, right: ClosedLoop2D) {
  return loopSegments(left).some(([a0, a1]) => loopSegments(right).some(([b0, b1]) => segmentsIntersect(a0, a1, b0, b1)));
}

function polygonOverlap(left: ClosedLoop2D, right: ClosedLoop2D) {
  if (loopsHaveBoundaryIntersection(left, right)) return true;
  if (left.points.some((point) => pointInLoopStrict(point, right))) return true;
  if (right.points.some((point) => pointInLoopStrict(point, left))) return true;
  return pointInLoopStrict(polygonCentroid(left.points), right)
    || pointInLoopStrict(polygonCentroid(right.points), left);
}

function panelAndUnrelatedStripOverlap(region: PanelMaterialRegion2D, strip: ClosedLoop2D) {
  const panelLoops = [region.outer, ...region.holes];
  if (panelLoops.some((loop) => loopsHaveBoundaryIntersection(loop, strip))) return true;
  if (strip.points.some((point) => pointInMaterialStrict(point, region))) return true;
  if (pointInMaterialStrict(polygonCentroid(strip.points), region)) return true;
  if (region.outer.points.some((point) => pointInLoopStrict(point, strip))) return true;
  return false;
}

function expectedTangentEdge(strip: BendStripRegion2D, panelId: string): [Vector2, Vector2] | null {
  if (panelId === strip.parentPanelId) return [strip.cornersMm[0], strip.cornersMm[1]];
  if (panelId === strip.childPanelId) return [strip.cornersMm[3], strip.cornersMm[2]];
  return null;
}

function adjacentPanelStripCheck(region: PanelMaterialRegion2D, strip: BendStripRegion2D) {
  const expected = expectedTangentEdge(strip, region.panelId);
  if (!expected) return { contactFound: false, overlap: panelAndUnrelatedStripOverlap(region, stripLoop(strip)) };

  const stripPolygon = stripLoop(strip);
  const allPanelSegments = [region.outer, ...region.holes].flatMap(loopSegments);
  const contactFound = allPanelSegments.some(([start, end]) =>
    segmentCollinearWithExpected(start, end, expected[0], expected[1])
    || segmentCollinearWithExpected(expected[0], expected[1], start, end));

  const stripSegments = loopSegments(stripPolygon);
  for (let stripIndex = 0; stripIndex < stripSegments.length; stripIndex += 1) {
    if ((region.panelId === strip.parentPanelId && stripIndex === 0)
      || (region.panelId === strip.childPanelId && stripIndex === 2)) continue;
    const [stripStart, stripEnd] = stripSegments[stripIndex];
    if (allPanelSegments.some(([panelStart, panelEnd]) => segmentsIntersect(stripStart, stripEnd, panelStart, panelEnd))) {
      return { contactFound, overlap: true };
    }
  }

  const centroid = polygonCentroid(stripPolygon.points);
  if (pointInMaterialStrict(centroid, region)) return { contactFound, overlap: true };
  const nonSharedCorners = region.panelId === strip.parentPanelId
    ? [strip.cornersMm[2], strip.cornersMm[3]]
    : [strip.cornersMm[0], strip.cornersMm[1]];
  if (nonSharedCorners.some((point) => pointInMaterialStrict(point, region))) return { contactFound, overlap: true };
  if (region.holes.some((hole) => hole.points.some((point) => pointInLoopStrict(point, stripPolygon)))) {
    return { contactFound, overlap: true };
  }
  return { contactFound, overlap: false };
}

function panelCollisionFindings(panelCheck: BendLayoutCollisionCheck): FlatPatternMaterialCollisionFinding[] {
  return panelCheck.collisions.map((collision) => ({
    entityA: { kind: "panel", id: collision.panelA },
    entityB: { kind: "panel", id: collision.panelB },
    reason: "panel-panel-collision" as const,
  }));
}

/**
 * Extends the sampled panel-only collision gate to the explicit approved bend
 * strips. Parent/child panels may touch their own strip only along the expected
 * tangency edge; any other sampled material overlap blocks flat-region assembly.
 * This remains conservative preview evidence, not an exact analytic BRep boolean.
 */
export function checkSampledFlatPatternMaterialCollisions(input: {
  boundary: SpacedBendBoundaryPreview2D;
  strips: BendStripRegionCandidate;
}): FlatPatternMaterialCollisionCheck {
  const { boundary, strips } = input;
  if (boundary.status !== "ready" || strips.status !== "ready") {
    return {
      source: "sampled-flat-pattern-material-collision-check",
      displayOnly: true,
      productionAuthoritative: false,
      status: "blocked",
      checkedPanelIds: [],
      checkedBendIds: [],
      collisions: [],
      errors: [...boundary.errors, ...strips.errors],
    };
  }

  const panelOnly = checkSampledBendLayoutCollisions(boundary);
  if (panelOnly.status === "blocked") {
    return {
      source: "sampled-flat-pattern-material-collision-check",
      displayOnly: true,
      productionAuthoritative: false,
      status: "blocked",
      checkedPanelIds: panelOnly.checkedPanelIds,
      checkedBendIds: [],
      collisions: [],
      errors: panelOnly.errors,
    };
  }

  const collisions = panelCollisionFindings(panelOnly);
  const errors: string[] = [];
  const regions: PanelMaterialRegion2D[] = [];
  for (const panel of boundary.panels) {
    const built = buildPanelRegion(panel.panelId, panel.wires);
    errors.push(...built.errors);
    if (built.region) regions.push(built.region);
  }
  if (errors.length || regions.length !== boundary.panels.length) {
    return {
      source: "sampled-flat-pattern-material-collision-check",
      displayOnly: true,
      productionAuthoritative: false,
      status: "blocked",
      checkedPanelIds: regions.map((region) => region.panelId),
      checkedBendIds: [],
      collisions: [],
      errors: errors.length ? errors : ["Not every panel can be reconstructed for sampled flat-pattern material collision checking."],
    };
  }

  for (const strip of strips.strips) {
    const loop = stripLoop(strip);
    for (const region of regions) {
      const adjacent = region.panelId === strip.parentPanelId || region.panelId === strip.childPanelId;
      if (adjacent) {
        const result = adjacentPanelStripCheck(region, strip);
        if (!result.contactFound) {
          collisions.push({
            entityA: { kind: "panel", id: region.panelId },
            entityB: { kind: "bend-strip", id: strip.bendId },
            reason: "missing-expected-tangency-contact",
          });
        } else if (result.overlap) {
          collisions.push({
            entityA: { kind: "panel", id: region.panelId },
            entityB: { kind: "bend-strip", id: strip.bendId },
            reason: "material-overlap",
          });
        }
      } else if (panelAndUnrelatedStripOverlap(region, loop)) {
        collisions.push({
          entityA: { kind: "panel", id: region.panelId },
          entityB: { kind: "bend-strip", id: strip.bendId },
          reason: "unexpected-boundary-intersection",
        });
      }
    }
  }

  for (let left = 0; left < strips.strips.length; left += 1) {
    for (let right = left + 1; right < strips.strips.length; right += 1) {
      const a = strips.strips[left];
      const b = strips.strips[right];
      if (polygonOverlap(stripLoop(a), stripLoop(b))) {
        collisions.push({
          entityA: { kind: "bend-strip", id: a.bendId },
          entityB: { kind: "bend-strip", id: b.bendId },
          reason: "strip-strip-collision",
        });
      }
    }
  }

  return {
    source: "sampled-flat-pattern-material-collision-check",
    displayOnly: true,
    productionAuthoritative: false,
    status: collisions.length ? "collision" : "clear",
    checkedPanelIds: regions.map((region) => region.panelId),
    checkedBendIds: strips.strips.map((strip) => strip.bendId),
    collisions,
    errors: [],
  };
}