export type Point2D = { x: number; y: number };

export type DxfShape =
  | { kind: "line"; a: Point2D; b: Point2D }
  | { kind: "polyline"; points: Point2D[]; bulges: number[]; closed: boolean }
  | { kind: "circle"; c: Point2D; r: number }
  | { kind: "arc"; c: Point2D; r: number; start: number; end: number };

export type ParsedDxf = {
  shapes: DxfShape[];
  width: number;
  height: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cutLength: number;
  contours: number;
  closedContours: number;
  pierces: number | null;
  holeCount: number | null;
  area: number | null;
  areaStatus: "exact" | "unavailable";
  units: string;
  unitsCode: number | null;
  unsupportedEntities: string[];
};

type Pair = [number, string];

type ClosedContour = {
  area: number;
  sample: Point2D;
  contains(point: Point2D): boolean;
};

type CircularArc = {
  c: Point2D;
  r: number;
  start: number;
  sweep: number;
};

const EPSILON = 1e-12;

function distance(a: Point2D, b: Point2D) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function normalizePositiveDegrees(value: number) {
  let normalized = value % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

export function normalizeArc(start: number, end: number) {
  let delta = end - start;
  while (delta < 0) delta += 360;
  while (delta >= 360) delta -= 360;
  return delta;
}

function parsePairs(text: string): Pair[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const pairs: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    if (Number.isFinite(code)) pairs.push([code, lines[i + 1].trim()]);
  }
  return pairs;
}

function detectUnits(pairs: Pair[]) {
  const labels: Record<number, string> = {
    1: "дюймы",
    2: "футы",
    4: "мм",
    5: "см",
    6: "м",
  };

  for (let i = 0; i < pairs.length - 2; i++) {
    if (pairs[i][0] !== 9 || pairs[i][1] !== "$INSUNITS") continue;
    for (let j = i + 1; j < Math.min(i + 6, pairs.length); j++) {
      if (pairs[j][0] !== 70) continue;
      const code = Number(pairs[j][1]);
      return { code, label: labels[code] ?? `код ${code}` };
    }
  }

  return { code: null, label: "не указаны" };
}

function collectEntityFields(pairs: Pair[], start: number) {
  const fields: Pair[] = [];
  let end = start + 1;
  while (end < pairs.length && pairs[end][0] !== 0) {
    fields.push(pairs[end]);
    end++;
  }
  return { fields, end };
}

function numberField(fields: Pair[], code: number) {
  const raw = fields.find(([fieldCode]) => fieldCode === code)?.[1];
  if (raw == null) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function angleWithinSweep(angle: number, start: number, sweep: number) {
  if (sweep >= 0) {
    return normalizePositiveDegrees(angle - start) <= sweep + 1e-9;
  }
  return normalizePositiveDegrees(start - angle) <= -sweep + 1e-9;
}

function circularArcBounds(arc: CircularArc) {
  const candidates = [arc.start, arc.start + arc.sweep];
  for (const cardinal of [0, 90, 180, 270]) {
    if (angleWithinSweep(cardinal, arc.start, arc.sweep)) candidates.push(cardinal);
  }
  return candidates.map((deg) => {
    const rad = deg * Math.PI / 180;
    return { x: arc.c.x + Math.cos(rad) * arc.r, y: arc.c.y + Math.sin(rad) * arc.r };
  });
}

function exactArcBounds(shape: Extract<DxfShape, { kind: "arc" }>) {
  return circularArcBounds({
    c: shape.c,
    r: shape.r,
    start: shape.start,
    sweep: normalizeArc(shape.start, shape.end),
  });
}

/**
 * Converts the DXF LWPOLYLINE bulge attached to vertex `a` into its exact
 * signed circular arc from `a` to `b`.
 *
 * DXF bulge = tan(includedAngle / 4). Positive values are counter-clockwise,
 * negative values clockwise. Production bounds/length use this analytic arc;
 * preview sampling is kept separate.
 */
export function bulgeArc(a: Point2D, b: Point2D, bulge: number): CircularArc | null {
  if (!Number.isFinite(bulge) || Math.abs(bulge) <= EPSILON) return null;
  const chord = distance(a, b);
  if (!(chord > EPSILON)) return null;

  const sweepRad = 4 * Math.atan(bulge);
  const radius = chord * (1 + bulge * bulge) / (4 * Math.abs(bulge));
  if (!(radius > 0) || !Number.isFinite(radius)) return null;

  const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const leftNormal = { x: -dy / chord, y: dx / chord };
  const centerOffset = chord * (1 - bulge * bulge) / (4 * bulge);
  const c = {
    x: midpoint.x + leftNormal.x * centerOffset,
    y: midpoint.y + leftNormal.y * centerOffset,
  };
  const start = Math.atan2(a.y - c.y, a.x - c.x) * 180 / Math.PI;

  return {
    c,
    r: radius,
    start,
    sweep: sweepRad * 180 / Math.PI,
  };
}

function polygonArea(points: Point2D[]) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function pointInPolygon(point: Point2D, polygon: Point2D[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function hasCurvedPolylineSegment(shape: Extract<DxfShape, { kind: "polyline" }>) {
  const segmentCount = shape.closed ? shape.points.length : Math.max(0, shape.points.length - 1);
  for (let index = 0; index < segmentCount; index++) {
    if (Math.abs(shape.bulges[index] ?? 0) > EPSILON) return true;
  }
  return false;
}

function closedContourMetrics(shapes: DxfShape[], unsupported: Set<string>) {
  const closed: ClosedContour[] = [];
  let closedContourCount = 0;
  let exact = unsupported.size === 0;

  for (const shape of shapes) {
    if (shape.kind === "circle") {
      closedContourCount++;
      closed.push({
        area: Math.PI * shape.r * shape.r,
        sample: { x: shape.c.x + shape.r * 0.999, y: shape.c.y },
        contains: (point) => distance(shape.c, point) < shape.r - 1e-8,
      });
      continue;
    }

    if (shape.kind === "polyline" && shape.closed && shape.points.length >= 3) {
      closedContourCount++;
      // Bounds and path length for bulged segments are exact, but exact net-area
      // topology requires arc-aware area + containment. Until that is proven by
      // regression fixtures, fail closed instead of treating chord area as fact.
      if (hasCurvedPolylineSegment(shape)) {
        exact = false;
        continue;
      }
      const area = polygonArea(shape.points);
      if (!(area > 0)) {
        exact = false;
        continue;
      }
      closed.push({
        area,
        sample: shape.points[0],
        contains: (point) => pointInPolygon(point, shape.points),
      });
      continue;
    }

    // Open lines/arcs or open polylines mean the parser cannot prove a complete
    // laser contour topology, so area/pierce metrics must not be presented as exact.
    exact = false;
  }

  if (!exact || !closed.length || closed.length !== closedContourCount) {
    return { area: null, pierces: null, holes: null, closedContours: closedContourCount, status: "unavailable" as const };
  }

  let netArea = 0;
  let holes = 0;
  closed.forEach((contour, index) => {
    const depth = closed.reduce((count, other, otherIndex) => {
      if (index === otherIndex) return count;
      return count + (other.contains(contour.sample) ? 1 : 0);
    }, 0);
    if (depth % 2 === 0) netArea += contour.area;
    else {
      netArea -= contour.area;
      holes++;
    }
  });

  return {
    area: Math.max(0, netArea),
    pierces: closed.length,
    holes,
    closedContours: closedContourCount,
    status: "exact" as const,
  };
}

function parseLwPolyline(fields: Pair[]) {
  const points: Point2D[] = [];
  const bulges: number[] = [];
  let currentX: number | undefined;
  let currentY: number | undefined;
  let currentBulge = 0;

  const flush = () => {
    if (currentX == null || currentY == null || !Number.isFinite(currentX) || !Number.isFinite(currentY)) return;
    points.push({ x: currentX, y: currentY });
    bulges.push(Number.isFinite(currentBulge) ? currentBulge : 0);
  };

  for (const [fieldCode, fieldValue] of fields) {
    if (fieldCode === 10) {
      flush();
      const x = Number(fieldValue);
      currentX = Number.isFinite(x) ? x : undefined;
      currentY = undefined;
      currentBulge = 0;
      continue;
    }
    if (fieldCode === 20) {
      const y = Number(fieldValue);
      currentY = Number.isFinite(y) ? y : undefined;
      continue;
    }
    if (fieldCode === 42) {
      const bulge = Number(fieldValue);
      currentBulge = Number.isFinite(bulge) ? bulge : 0;
    }
  }
  flush();

  while (bulges.length < points.length) bulges.push(0);
  return { points, bulges };
}

export function parseAsciiDxf(text: string): ParsedDxf {
  const pairs = parsePairs(text);
  const units = detectUnits(pairs);
  const shapes: DxfShape[] = [];
  const unsupported = new Set<string>();
  let inEntities = false;

  for (let i = 0; i < pairs.length; i++) {
    const [code, value] = pairs[i];
    if (code === 0 && value === "SECTION") {
      const next = pairs[i + 1];
      if (next?.[0] === 2 && next[1] === "ENTITIES") inEntities = true;
      continue;
    }
    if (inEntities && code === 0 && value === "ENDSEC") {
      inEntities = false;
      continue;
    }
    if (!inEntities || code !== 0) continue;

    const { fields, end } = collectEntityFields(pairs, i);
    i = end - 1;
    const first = (fieldCode: number) => fields.find(([field]) => field === fieldCode)?.[1];

    if (value === "LINE") {
      const x1 = numberField(fields, 10);
      const y1 = numberField(fields, 20);
      const x2 = numberField(fields, 11);
      const y2 = numberField(fields, 21);
      if ([x1, y1, x2, y2].every((n) => typeof n === "number")) {
        shapes.push({ kind: "line", a: { x: x1!, y: y1! }, b: { x: x2!, y: y2! } });
      }
      continue;
    }

    if (value === "CIRCLE") {
      const x = numberField(fields, 10);
      const y = numberField(fields, 20);
      const r = numberField(fields, 40);
      if ([x, y, r].every((n) => typeof n === "number") && r! > 0) {
        shapes.push({ kind: "circle", c: { x: x!, y: y! }, r: r! });
      }
      continue;
    }

    if (value === "ARC") {
      const x = numberField(fields, 10);
      const y = numberField(fields, 20);
      const r = numberField(fields, 40);
      const start = numberField(fields, 50);
      const finish = numberField(fields, 51);
      if ([x, y, r, start, finish].every((n) => typeof n === "number") && r! > 0) {
        shapes.push({ kind: "arc", c: { x: x!, y: y! }, r: r!, start: start!, end: finish! });
      }
      continue;
    }

    if (value === "LWPOLYLINE") {
      const { points, bulges } = parseLwPolyline(fields);
      const flags = Number(first(70) ?? "0");
      if (points.length >= 2) shapes.push({ kind: "polyline", points, bulges, closed: (flags & 1) === 1 });
      continue;
    }

    if (!["TEXT", "MTEXT", "DIMENSION", "POINT"].includes(value)) unsupported.add(value);
  }

  if (!shapes.length) {
    throw new Error("В DXF не найдены поддерживаемые 2D-объекты LINE, LWPOLYLINE, CIRCLE или ARC.");
  }

  const pointsForBounds: Point2D[] = [];
  let cutLength = 0;
  for (const shape of shapes) {
    if (shape.kind === "line") {
      pointsForBounds.push(shape.a, shape.b);
      cutLength += distance(shape.a, shape.b);
    } else if (shape.kind === "polyline") {
      const segmentCount = shape.closed ? shape.points.length : shape.points.length - 1;
      for (let p = 0; p < segmentCount; p++) {
        const a = shape.points[p];
        const b = shape.points[(p + 1) % shape.points.length];
        const curved = bulgeArc(a, b, shape.bulges[p] ?? 0);
        if (curved) {
          pointsForBounds.push(...circularArcBounds(curved));
          cutLength += curved.r * Math.abs(curved.sweep) * Math.PI / 180;
        } else {
          pointsForBounds.push(a, b);
          cutLength += distance(a, b);
        }
      }
    } else if (shape.kind === "circle") {
      pointsForBounds.push(
        { x: shape.c.x - shape.r, y: shape.c.y - shape.r },
        { x: shape.c.x + shape.r, y: shape.c.y + shape.r },
      );
      cutLength += Math.PI * shape.r * 2;
    } else {
      pointsForBounds.push(...exactArcBounds(shape));
      cutLength += 2 * Math.PI * shape.r * (normalizeArc(shape.start, shape.end) / 360);
    }
  }

  const xs = pointsForBounds.map((point) => point.x);
  const ys = pointsForBounds.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const topology = closedContourMetrics(shapes, unsupported);

  return {
    shapes,
    width: maxX - minX,
    height: maxY - minY,
    minX,
    minY,
    maxX,
    maxY,
    cutLength,
    contours: shapes.length,
    closedContours: topology.closedContours,
    pierces: topology.pierces,
    holeCount: topology.holes,
    area: topology.area,
    areaStatus: topology.status,
    units: units.label,
    unitsCode: units.code,
    unsupportedEntities: [...unsupported].sort(),
  };
}

function sampleCircularArc(arc: CircularArc, maxStepDegrees = 8) {
  const steps = Math.max(1, Math.ceil(Math.abs(arc.sweep) / maxStepDegrees));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (arc.start + (arc.sweep * index) / steps) * Math.PI / 180;
    return {
      x: arc.c.x + Math.cos(angle) * arc.r,
      y: arc.c.y + Math.sin(angle) * arc.r,
    };
  });
}

export function polylinePreviewPoints(shape: Extract<DxfShape, { kind: "polyline" }>) {
  if (!shape.points.length) return [];
  const result: Point2D[] = [shape.points[0]];
  const segmentCount = shape.closed ? shape.points.length : shape.points.length - 1;
  for (let index = 0; index < segmentCount; index++) {
    const a = shape.points[index];
    const b = shape.points[(index + 1) % shape.points.length];
    const curved = bulgeArc(a, b, shape.bulges[index] ?? 0);
    if (!curved) {
      result.push(b);
      continue;
    }
    result.push(...sampleCircularArc(curved).slice(1));
  }
  return result;
}

export function arcPoints(shape: Extract<DxfShape, { kind: "arc" }>) {
  return sampleCircularArc({
    c: shape.c,
    r: shape.r,
    start: shape.start,
    sweep: normalizeArc(shape.start, shape.end),
  });
}