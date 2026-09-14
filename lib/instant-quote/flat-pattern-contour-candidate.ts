import type { FlatBoundaryWire2D } from "@/lib/instant-quote/bend-boundary-preview";
import type { BendStripRegionCandidate, BendStripRegion2D } from "@/lib/instant-quote/bend-strip-region";
import type { SpacedBendBoundaryPreview2D, Vector2 } from "@/lib/instant-quote/bend-spacing-preview";
import type { FlatPatternMaterialCollisionCheck } from "@/lib/instant-quote/flat-pattern-material-collision";
import type { FlatPatternRegionCandidate, FlatPatternSampledBounds } from "@/lib/instant-quote/flat-pattern-region";

export type SampledFlatContour = {
  id: string;
  pointsMm: Vector2[];
  sampledAreaMm2: number;
  sampledLengthMm: number;
};

export type SampledFlatPatternContourCandidate = {
  source: "sampled-flat-pattern-contour-candidate";
  displayOnly: true;
  productionAuthoritative: false;
  status: "ready" | "blocked";
  rootPanelId?: string;
  outer?: SampledFlatContour;
  holes: SampledFlatContour[];
  contourCount?: number;
  sampledCutLengthMm?: number;
  sampledMaterialAreaMm2?: number;
  areaReconciliationErrorMm2?: number;
  sampledBoundsMm?: FlatPatternSampledBounds;
  cancelledTangencyCount: number;
  errors: string[];
};

type PrimitiveSegment = {
  id: string;
  ownerKind: "panel" | "bend-strip";
  ownerId: string;
  wireId?: string;
  start: Vector2;
  end: Vector2;
  cancelled: boolean;
};

type SampledLoop = {
  id: string;
  points: Vector2[];
  signedAreaMm2: number;
};

const POINT_TOLERANCE_MM = 0.01;
const AREA_EPSILON_MM2 = 1e-6;
const LENGTH_EPSILON_MM = 1e-9;

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
  return distance(a, b) <= POINT_TOLERANCE_MM;
}

function exactSegmentMatch(a0: Vector2, a1: Vector2, b0: Vector2, b1: Vector2) {
  return (close(a0, b0) && close(a1, b1)) || (close(a0, b1) && close(a1, b0));
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

function loopLength(points: Vector2[]) {
  return points.reduce((sum, point, index) => sum + distance(point, points[(index + 1) % points.length]), 0);
}

function pointOnSegment(point: Vector2, start: Vector2, end: Vector2) {
  const segment = subtract(end, start);
  const relative = subtract(point, start);
  const segmentLength = Math.hypot(segment[0], segment[1]);
  if (!(segmentLength > LENGTH_EPSILON_MM)) return close(point, start);
  if (Math.abs(cross(segment, relative)) / segmentLength > POINT_TOLERANCE_MM) return false;
  const minX = Math.min(start[0], end[0]) - POINT_TOLERANCE_MM;
  const maxX = Math.max(start[0], end[0]) + POINT_TOLERANCE_MM;
  const minY = Math.min(start[1], end[1]) - POINT_TOLERANCE_MM;
  const maxY = Math.max(start[1], end[1]) + POINT_TOLERANCE_MM;
  return point[0] >= minX && point[0] <= maxX && point[1] >= minY && point[1] <= maxY;
}

function segmentsIntersect(a0: Vector2, a1: Vector2, b0: Vector2, b1: Vector2) {
  const a = subtract(a1, a0);
  const b = subtract(b1, b0);
  const c1 = cross(a, subtract(b0, a0));
  const c2 = cross(a, subtract(b1, a0));
  const c3 = cross(b, subtract(a0, b0));
  const c4 = cross(b, subtract(a1, b0));
  const oppositeA = (c1 > LENGTH_EPSILON_MM && c2 < -LENGTH_EPSILON_MM)
    || (c1 < -LENGTH_EPSILON_MM && c2 > LENGTH_EPSILON_MM);
  const oppositeB = (c3 > LENGTH_EPSILON_MM && c4 < -LENGTH_EPSILON_MM)
    || (c3 < -LENGTH_EPSILON_MM && c4 > LENGTH_EPSILON_MM);
  if (oppositeA && oppositeB) return true;
  if (Math.abs(c1) <= LENGTH_EPSILON_MM && pointOnSegment(b0, a0, a1)) return true;
  if (Math.abs(c2) <= LENGTH_EPSILON_MM && pointOnSegment(b1, a0, a1)) return true;
  if (Math.abs(c3) <= LENGTH_EPSILON_MM && pointOnSegment(a0, b0, b1)) return true;
  if (Math.abs(c4) <= LENGTH_EPSILON_MM && pointOnSegment(a1, b0, b1)) return true;
  return false;
}

function pointInLoopStrict(point: Vector2, loop: SampledLoop) {
  for (let index = 0; index < loop.points.length; index += 1) {
    if (pointOnSegment(point, loop.points[index], loop.points[(index + 1) % loop.points.length])) return false;
  }
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

function loopSelfIntersects(loop: SampledLoop) {
  const count = loop.points.length;
  for (let left = 0; left < count; left += 1) {
    const a0 = loop.points[left];
    const a1 = loop.points[(left + 1) % count];
    for (let right = left + 1; right < count; right += 1) {
      if (right === left + 1 || (left === 0 && right === count - 1)) continue;
      const b0 = loop.points[right];
      const b1 = loop.points[(right + 1) % count];
      if (segmentsIntersect(a0, a1, b0, b1)) return true;
    }
  }
  return false;
}

function loopsIntersect(left: SampledLoop, right: SampledLoop) {
  return left.points.some((a0, index) => {
    const a1 = left.points[(index + 1) % left.points.length];
    return right.points.some((b0, rightIndex) => segmentsIntersect(a0, a1, b0, right.points[(rightIndex + 1) % right.points.length]));
  });
}

function wireLoopArea(wire: FlatBoundaryWire2D) {
  const segments = primitiveSegmentsForWire("area", "panel", wire);
  const stitched = stitchSegments(segments);
  if (stitched.errors.length || stitched.loops.length !== 1) return null;
  return Math.abs(stitched.loops[0].signedAreaMm2);
}

function outerWireId(wires: FlatBoundaryWire2D[]) {
  const candidates = wires.map((wire) => ({ id: wire.id, area: wireLoopArea(wire) })).filter((item): item is { id: string; area: number } => item.area != null);
  candidates.sort((a, b) => b.area - a.area);
  return candidates[0]?.id;
}

function primitiveSegmentsForWire(ownerId: string, ownerKind: PrimitiveSegment["ownerKind"], wire: FlatBoundaryWire2D): PrimitiveSegment[] {
  const output: PrimitiveSegment[] = [];
  for (let edgeIndex = 0; edgeIndex < wire.edges.length; edgeIndex += 1) {
    const edge = wire.edges[edgeIndex];
    for (let pointIndex = 0; pointIndex + 1 < edge.pointsMm.length; pointIndex += 1) {
      const start = edge.pointsMm[pointIndex];
      const end = edge.pointsMm[pointIndex + 1];
      if (distance(start, end) <= LENGTH_EPSILON_MM) continue;
      output.push({
        id: `${ownerKind}:${ownerId}:${wire.id}:${edge.id}:${pointIndex}`,
        ownerKind,
        ownerId,
        wireId: wire.id,
        start: [start[0], start[1]],
        end: [end[0], end[1]],
        cancelled: false,
      });
    }
  }
  return output;
}

function stripSegments(strip: BendStripRegion2D): PrimitiveSegment[] {
  return strip.cornersMm.map((start, index) => ({
    id: `bend-strip:${strip.bendId}:${index}`,
    ownerKind: "bend-strip" as const,
    ownerId: strip.bendId,
    start: [start[0], start[1]] as Vector2,
    end: [strip.cornersMm[(index + 1) % strip.cornersMm.length][0], strip.cornersMm[(index + 1) % strip.cornersMm.length][1]] as Vector2,
    cancelled: false,
  }));
}

function stitchSegments(source: PrimitiveSegment[]) {
  const remaining = source.filter((segment) => !segment.cancelled).map((segment) => ({ ...segment }));
  const loops: SampledLoop[] = [];
  const errors: string[] = [];
  let loopIndex = 0;

  while (remaining.length) {
    const first = remaining.shift()!;
    const points: Vector2[] = [first.start, first.end];
    let guard = 0;
    while (!close(points[points.length - 1], points[0])) {
      guard += 1;
      if (guard > source.length + 2) {
        errors.push("Sampled contour stitching exceeded its deterministic traversal bound.");
        break;
      }
      const end = points[points.length - 1];
      const matches = remaining
        .map((segment, index) => ({ segment, index }))
        .filter(({ segment }) => close(segment.start, end) || close(segment.end, end));
      if (matches.length !== 1) {
        errors.push(matches.length
          ? `Sampled contour has an ambiguous branch with ${matches.length} candidate segments.`
          : "Sampled contour is open after internal tangency cancellation.");
        break;
      }
      const [{ segment, index }] = matches;
      remaining.splice(index, 1);
      points.push(close(segment.start, end) ? segment.end : segment.start);
    }
    if (errors.length) break;

    if (points.length > 1 && close(points[0], points[points.length - 1])) points.pop();
    const deduped: Vector2[] = [];
    for (const point of points) if (!deduped.length || !close(deduped[deduped.length - 1], point)) deduped.push(point);
    if (deduped.length < 3) {
      errors.push("Sampled contour loop has fewer than three unique points.");
      break;
    }
    const area = signedArea(deduped);
    if (!Number.isFinite(area) || Math.abs(area) <= AREA_EPSILON_MM2) {
      errors.push("Sampled contour loop has zero or non-finite area.");
      break;
    }
    loops.push({ id: `sampled-loop-${loopIndex}`, points: deduped, signedAreaMm2: area });
    loopIndex += 1;
  }

  return { loops, errors };
}

function sampledBounds(loops: SampledLoop[]): FlatPatternSampledBounds | undefined {
  const points = loops.flatMap((loop) => loop.points);
  if (!points.length) return undefined;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const widthMm = maxX - minX;
  const heightMm = maxY - minY;
  return widthMm > 0 && heightMm > 0 ? { minX, minY, maxX, maxY, widthMm, heightMm } : undefined;
}

function asContour(loop: SampledLoop): SampledFlatContour {
  return {
    id: loop.id,
    pointsMm: loop.points,
    sampledAreaMm2: Math.abs(loop.signedAreaMm2),
    sampledLengthMm: loopLength(loop.points),
  };
}

/**
 * Reconstructs a sampled whole-part contour by cancelling only fully matching
 * panel↔bend-strip tangency segments. Partial collinear overlap, branches or
 * ambiguous stitching are deliberately rejected. Even a ready result remains
 * display-only because curved BRep edges have already been discretised.
 */
export function buildSampledFlatPatternContourCandidate(input: {
  boundary: SpacedBendBoundaryPreview2D;
  strips: BendStripRegionCandidate;
  collisions: FlatPatternMaterialCollisionCheck;
  region: FlatPatternRegionCandidate;
}): SampledFlatPatternContourCandidate {
  const { boundary, strips, collisions, region } = input;
  const rootPanelId = region.rootPanelId ?? boundary.rootPanelId ?? strips.rootPanelId;
  const blocked = (errors: string[], cancelledTangencyCount = 0): SampledFlatPatternContourCandidate => ({
    source: "sampled-flat-pattern-contour-candidate",
    displayOnly: true,
    productionAuthoritative: false,
    status: "blocked",
    rootPanelId,
    holes: [],
    cancelledTangencyCount,
    errors,
  });

  if (boundary.status !== "ready" || strips.status !== "ready" || collisions.status !== "clear" || region.status !== "ready") {
    return blocked([
      ...boundary.errors,
      ...strips.errors,
      ...collisions.errors,
      ...region.errors,
      ...(collisions.status === "collision" ? ["Sampled contour reconstruction is blocked by material collisions."] : []),
    ].filter(Boolean));
  }

  const outerWireByPanel = new Map<string, string>();
  const segments: PrimitiveSegment[] = [];
  const errors: string[] = [];
  for (const panel of boundary.panels) {
    const outerId = outerWireId(panel.wires);
    if (!outerId) errors.push(`Panel ${panel.panelId} has no uniquely reconstructable sampled outer wire.`);
    else outerWireByPanel.set(panel.panelId, outerId);
    for (const wire of panel.wires) segments.push(...primitiveSegmentsForWire(panel.panelId, "panel", wire));
  }
  for (const strip of strips.strips) segments.push(...stripSegments(strip));
  if (errors.length) return blocked(errors);

  let cancelledTangencyCount = 0;
  const cancelTangency = (strip: BendStripRegion2D, panelId: string, stripSideIndex: number) => {
    const panelOuterWireId = outerWireByPanel.get(panelId);
    const stripSide = segments.find((segment) => segment.ownerKind === "bend-strip" && segment.ownerId === strip.bendId && segment.id.endsWith(`:${stripSideIndex}`));
    if (!panelOuterWireId || !stripSide) {
      errors.push(`Bend ${strip.bendId} is missing sampled tangency geometry for panel ${panelId}.`);
      return;
    }
    const matches = segments.filter((segment) =>
      !segment.cancelled
      && segment.ownerKind === "panel"
      && segment.ownerId === panelId
      && segment.wireId === panelOuterWireId
      && exactSegmentMatch(segment.start, segment.end, stripSide.start, stripSide.end));
    if (matches.length !== 1) {
      errors.push(`Bend ${strip.bendId} tangency with panel ${panelId} requires exactly one full endpoint-matched outer-boundary segment; found ${matches.length}.`);
      return;
    }
    matches[0].cancelled = true;
    stripSide.cancelled = true;
    cancelledTangencyCount += 1;
  };

  for (const strip of strips.strips) {
    cancelTangency(strip, strip.parentPanelId, 0);
    cancelTangency(strip, strip.childPanelId, 2);
  }
  if (errors.length) return blocked(errors, cancelledTangencyCount);

  const stitched = stitchSegments(segments);
  if (stitched.errors.length) return blocked(stitched.errors, cancelledTangencyCount);
  if (!stitched.loops.length) return blocked(["No closed sampled contour remains after tangency cancellation."], cancelledTangencyCount);
  for (const loop of stitched.loops) {
    if (loopSelfIntersects(loop)) return blocked([`Sampled contour ${loop.id} self-intersects.`], cancelledTangencyCount);
  }

  const ordered = [...stitched.loops].sort((a, b) => Math.abs(b.signedAreaMm2) - Math.abs(a.signedAreaMm2));
  const outer = ordered[0];
  const holes = ordered.slice(1);
  for (const hole of holes) {
    if (!pointInLoopStrict(hole.points[0], outer) || loopsIntersect(hole, outer)) {
      return blocked([`Sampled inner contour ${hole.id} is not strictly contained by the outer contour.`], cancelledTangencyCount);
    }
  }
  for (let left = 0; left < holes.length; left += 1) {
    for (let right = left + 1; right < holes.length; right += 1) {
      if (loopsIntersect(holes[left], holes[right])
        || pointInLoopStrict(holes[left].points[0], holes[right])
        || pointInLoopStrict(holes[right].points[0], holes[left])) {
        return blocked(["Sampled flat-pattern holes overlap or nest each other."], cancelledTangencyCount);
      }
    }
  }

  const outerArea = Math.abs(outer.signedAreaMm2);
  const holeArea = holes.reduce((sum, hole) => sum + Math.abs(hole.signedAreaMm2), 0);
  const sampledMaterialAreaMm2 = outerArea - holeArea;
  if (!(sampledMaterialAreaMm2 > AREA_EPSILON_MM2)) return blocked(["Sampled flat-pattern material area is zero or negative."], cancelledTangencyCount);

  const expectedArea = region.sampledMaterialAreaMm2;
  if (expectedArea == null || !Number.isFinite(expectedArea) || expectedArea <= 0) return blocked(["Flat-pattern region candidate has no valid sampled material area for reconciliation."], cancelledTangencyCount);
  const areaReconciliationErrorMm2 = Math.abs(sampledMaterialAreaMm2 - expectedArea);
  const areaToleranceMm2 = Math.max(0.1, expectedArea * 1e-5);
  if (areaReconciliationErrorMm2 > areaToleranceMm2) {
    return blocked([`Sampled contour area differs from region material area by ${areaReconciliationErrorMm2.toFixed(4)} mm².`], cancelledTangencyCount);
  }

  const bounds = sampledBounds(ordered);
  if (!bounds) return blocked(["Sampled flat-pattern contour has degenerate bounds."], cancelledTangencyCount);
  const outerContour = asContour(outer);
  const holeContours = holes.map(asContour);
  const sampledCutLengthMm = outerContour.sampledLengthMm + holeContours.reduce((sum, hole) => sum + hole.sampledLengthMm, 0);

  return {
    source: "sampled-flat-pattern-contour-candidate",
    displayOnly: true,
    productionAuthoritative: false,
    status: "ready",
    rootPanelId,
    outer: outerContour,
    holes: holeContours,
    contourCount: 1 + holeContours.length,
    sampledCutLengthMm,
    sampledMaterialAreaMm2,
    areaReconciliationErrorMm2,
    sampledBoundsMm: bounds,
    cancelledTangencyCount,
    errors: [],
  };
}
