import { CadReadError } from "@/lib/instant-quote/cad-model";

export type Point2D = { x: number; y: number };

export type DxfShape =
  | { kind: "line"; a: Point2D; b: Point2D }
  | { kind: "polyline"; points: Point2D[]; bulges: number[]; closed: boolean }
  | { kind: "circle"; c: Point2D; r: number }
  | { kind: "arc"; c: Point2D; r: number; start: number; end: number }
  | { kind: "ellipse"; c: Point2D; major: Point2D; ratio: number; start: number; end: number };

export type DxfUnitsSource = "insunits" | "measurement" | "unknown";

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
  /** Which header variable the units came from, or that none declared them. */
  unitsSource: DxfUnitsSource;
  unsupportedEntities: string[];
  /** Annotation layers whose geometry was excluded from every metric. */
  skippedServiceLayers: string[];
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
const TWO_PI = Math.PI * 2;
const LEGACY_POLYLINE_COMPLEX_FLAGS = 2 | 4 | 8 | 16 | 32 | 64;
const LEGACY_VERTEX_COMPLEX_FLAGS = 1 | 2 | 8 | 16 | 32 | 64 | 128;

function distance(a: Point2D, b: Point2D) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function normalizePositiveDegrees(value: number) {
  let normalized = value % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

function normalizePositiveRadians(value: number) {
  let normalized = value % TWO_PI;
  if (normalized < 0) normalized += TWO_PI;
  return normalized;
}

/**
 * Arc sweep in [0, 360).
 *
 * This subtracted 360 in a loop, which never ends once the difference is large
 * enough that 360 falls below its ulp: at 1e308 the subtraction returns the
 * same number for ever. A DXF whose ARC carries a group code 50 of 1e300 is a
 * finite number the field parser accepts, so a two-hundred-byte file pinned the
 * request that read it — on a public endpoint. The remainder does the same job
 * for every input, in one step.
 */
export function normalizeArc(start: number, end: number) {
  const delta = (end - start) % 360;
  if (delta < 0) return delta + 360;
  // An exact negative multiple of 360 leaves -0 behind; hand back a plain zero.
  return delta === 0 ? 0 : delta;
}

function parsePairs(text: string): Pair[] {
  const lines = text.replace(/\r/g, "").split("\n");
  // A DXF is read two lines at a time: an integer group code, then its value.
  // The stride only holds if it starts on a code. Exporters do leave a blank
  // line ahead of the first one, and an empty line reads as the number 0, so
  // pairing from index zero would take every value line for a code and hand
  // back an empty drawing instead of the part. Find the first real code and
  // pair from there; a value may legitimately be blank, so only the run before
  // the first code is skipped.
  let start = 0;
  while (start + 1 < lines.length && !/^-?\d+$/.test(lines[start].trim())) start += 1;

  const pairs: Pair[] = [];
  for (let i = start; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    if (Number.isFinite(code)) pairs.push([code, lines[i + 1].trim()]);
  }
  return pairs;
}

function headerFlag(pairs: Pair[], variable: string) {
  for (let i = 0; i < pairs.length - 1; i++) {
    if (pairs[i][0] !== 9 || pairs[i][1] !== variable) continue;
    for (let j = i + 1; j < Math.min(i + 6, pairs.length); j++) {
      if (pairs[j][0] !== 70) continue;
      const code = Number(pairs[j][1]);
      return Number.isFinite(code) ? code : null;
    }
  }
  return null;
}

function detectUnits(pairs: Pair[]): { code: number | null; label: string; source: DxfUnitsSource } {
  const labels: Record<number, string> = {
    1: "дюймы",
    2: "футы",
    4: "мм",
    5: "см",
    6: "м",
  };

  const insunits = headerFlag(pairs, "$INSUNITS");
  if (insunits != null && insunits !== 0) {
    return { code: insunits, label: labels[insunits] ?? `код ${insunits}`, source: "insunits" };
  }

  // $INSUNITS 0 means "unitless", and plenty of exporters omit the variable
  // altogether — every R12 file does, and LibreCAD, Inkscape and several CAM
  // post-processors do too. $MEASUREMENT is the drawing's other statement about
  // its own system: 1 metric, 0 imperial. A mechanical drawing in either system
  // is drawn in millimetres or in inches respectively, so this is still the file
  // speaking rather than an assumption — but it is one step weaker than
  // $INSUNITS, so the source travels with the result and the caller says so.
  const measurement = headerFlag(pairs, "$MEASUREMENT");
  if (measurement === 1) return { code: 4, label: "мм", source: "measurement" };
  if (measurement === 0) return { code: 1, label: "дюймы", source: "measurement" };

  return { code: null, label: "не указаны", source: "unknown" };
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

/**
 * Annotation layers that describe a drawing rather than the part to be cut:
 * dimensions, centre lines, borders, title blocks, text and hatching. Their
 * geometry must not reach the bounding box, the cut length or the blank area,
 * otherwise a dimension line below the part inflates both the priced blank and
 * the priced cut.
 */
const SERVICE_LAYER_PATTERN =
  /(^|[^a-z])(dim|размер|ось|оси|axis|center|centre|осев|рамк|frame|border|штамп|title|text|текст|hatch|штрих|defpoints|annot|note|mark)/i;

export function isServiceDxfLayer(layer: string) {
  return SERVICE_LAYER_PATTERN.test(layer.trim());
}

function layerField(fields: Pair[]) {
  return fields.find(([fieldCode]) => fieldCode === 8)?.[1]?.trim() ?? "";
}

function numberField(fields: Pair[], code: number) {
  const raw = fields.find(([fieldCode]) => fieldCode === code)?.[1];
  if (raw == null) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function angleWithinSweep(angle: number, start: number, sweep: number) {
  if (sweep >= 0) return normalizePositiveDegrees(angle - start) <= sweep + 1e-9;
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
  return circularArcBounds({ c: shape.c, r: shape.r, start: shape.start, sweep: normalizeArc(shape.start, shape.end) });
}

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
  const c = { x: midpoint.x + leftNormal.x * centerOffset, y: midpoint.y + leftNormal.y * centerOffset };
  const start = Math.atan2(a.y - c.y, a.x - c.x) * 180 / Math.PI;
  return { c, r: radius, start, sweep: sweepRad * 180 / Math.PI };
}

function ellipseAxes(shape: Extract<DxfShape, { kind: "ellipse" }>) {
  return {
    major: shape.major,
    minor: { x: -shape.major.y * shape.ratio, y: shape.major.x * shape.ratio },
  };
}

function ellipseIsFull(shape: Extract<DxfShape, { kind: "ellipse" }>) {
  return Math.abs(shape.start) <= 1e-10 && Math.abs(shape.end - TWO_PI) <= 1e-10;
}

function ellipseSweep(shape: Extract<DxfShape, { kind: "ellipse" }>) {
  if (ellipseIsFull(shape)) return TWO_PI;
  let sweep = shape.end - shape.start;
  if (sweep <= 0) sweep += TWO_PI;
  return sweep;
}

export function ellipsePoint(shape: Extract<DxfShape, { kind: "ellipse" }>, parameter: number): Point2D {
  const axes = ellipseAxes(shape);
  return {
    x: shape.c.x + axes.major.x * Math.cos(parameter) + axes.minor.x * Math.sin(parameter),
    y: shape.c.y + axes.major.y * Math.cos(parameter) + axes.minor.y * Math.sin(parameter),
  };
}

function ellipseParameterWithinSweep(parameter: number, start: number, sweep: number) {
  return normalizePositiveRadians(parameter - start) <= sweep + 1e-10;
}

function exactEllipseBounds(shape: Extract<DxfShape, { kind: "ellipse" }>) {
  const axes = ellipseAxes(shape);
  const sweep = ellipseSweep(shape);
  const candidates = [shape.start, shape.start + sweep];
  const xExtremum = Math.atan2(axes.minor.x, axes.major.x);
  const yExtremum = Math.atan2(axes.minor.y, axes.major.y);
  for (const parameter of [xExtremum, xExtremum + Math.PI, yExtremum, yExtremum + Math.PI]) {
    if (ellipseParameterWithinSweep(parameter, shape.start, sweep)) candidates.push(parameter);
  }
  return candidates.map((parameter) => ellipsePoint(shape, parameter));
}

function ellipseSpeed(shape: Extract<DxfShape, { kind: "ellipse" }>, parameter: number) {
  const axes = ellipseAxes(shape);
  const dx = -axes.major.x * Math.sin(parameter) + axes.minor.x * Math.cos(parameter);
  const dy = -axes.major.y * Math.sin(parameter) + axes.minor.y * Math.cos(parameter);
  return Math.hypot(dx, dy);
}

function simpson(fa: number, fm: number, fb: number, width: number) {
  return width * (fa + 4 * fm + fb) / 6;
}

function adaptiveSimpson(
  fn: (value: number) => number,
  a: number,
  b: number,
  tolerance: number,
  whole: number,
  fa: number,
  fm: number,
  fb: number,
  depth: number,
): number | null {
  const midpoint = (a + b) / 2;
  const leftMidpoint = (a + midpoint) / 2;
  const rightMidpoint = (midpoint + b) / 2;
  const flm = fn(leftMidpoint);
  const frm = fn(rightMidpoint);
  if (![fa, fm, fb, flm, frm, whole].every(Number.isFinite)) return null;

  const left = simpson(fa, flm, fm, midpoint - a);
  const right = simpson(fm, frm, fb, b - midpoint);
  const delta = left + right - whole;
  if (![left, right, delta].every(Number.isFinite)) return null;

  if (Math.abs(delta) <= 15 * tolerance) {
    const corrected = left + right + delta / 15;
    return Number.isFinite(corrected) ? corrected : null;
  }
  if (depth <= 0) return null;

  const leftValue = adaptiveSimpson(fn, a, midpoint, tolerance / 2, left, fa, flm, fm, depth - 1);
  if (leftValue == null) return null;
  const rightValue = adaptiveSimpson(fn, midpoint, b, tolerance / 2, right, fm, frm, fb, depth - 1);
  if (rightValue == null) return null;
  const total = leftValue + rightValue;
  return Number.isFinite(total) ? total : null;
}

export function ellipseArcLength(shape: Extract<DxfShape, { kind: "ellipse" }>) {
  const sweep = ellipseSweep(shape);
  if (!(sweep > EPSILON) || sweep > TWO_PI + 1e-10) return null;

  const a = shape.start;
  const b = shape.start + sweep;
  const midpoint = (a + b) / 2;
  const fn = (parameter: number) => ellipseSpeed(shape, parameter);
  const fa = fn(a);
  const fm = fn(midpoint);
  const fb = fn(b);
  if (![fa, fm, fb].every(Number.isFinite)) return null;

  const whole = simpson(fa, fm, fb, b - a);
  const majorRadius = Math.hypot(shape.major.x, shape.major.y);
  if (!Number.isFinite(whole) || !Number.isFinite(majorRadius) || !(majorRadius > EPSILON)) return null;
  const tolerance = Math.max(1e-10, majorRadius * 1e-10);
  return adaptiveSimpson(fn, a, b, tolerance, whole, fa, fm, fb, 22);
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

/**
 * A contour is assembled from straight and circular pieces. Keeping the arcs
 * analytic (rather than sampling them into a polyline) means the enclosed area
 * stays exact: the chord shoelace is corrected by the true circular-segment
 * area of every arc.
 */
type ContourSegment =
  | { kind: "line"; a: Point2D; b: Point2D }
  | { kind: "arc"; a: Point2D; b: Point2D; arc: CircularArc };

/** Endpoints closer than this are treated as the same node when stitching. */
const CONTOUR_STITCH_TOLERANCE = 0.05;

function reverseSegment(segment: ContourSegment): ContourSegment {
  if (segment.kind === "line") return { kind: "line", a: segment.b, b: segment.a };
  return {
    kind: "arc",
    a: segment.b,
    b: segment.a,
    arc: {
      c: segment.arc.c,
      r: segment.arc.r,
      start: segment.arc.start + segment.arc.sweep,
      sweep: -segment.arc.sweep,
    },
  };
}

function arcEndpoint(arc: CircularArc, angleDegrees: number): Point2D {
  const radians = angleDegrees * Math.PI / 180;
  return { x: arc.c.x + Math.cos(radians) * arc.r, y: arc.c.y + Math.sin(radians) * arc.r };
}

function segmentsOfShape(shape: DxfShape): { segments: ContourSegment[]; closed: boolean } | null {
  if (shape.kind === "line") {
    if (distance(shape.a, shape.b) <= EPSILON) return null;
    return { segments: [{ kind: "line", a: shape.a, b: shape.b }], closed: false };
  }

  if (shape.kind === "arc") {
    const arc: CircularArc = { c: shape.c, r: shape.r, start: shape.start, sweep: normalizeArc(shape.start, shape.end) };
    return {
      segments: [{ kind: "arc", a: arcEndpoint(arc, arc.start), b: arcEndpoint(arc, arc.start + arc.sweep), arc }],
      closed: false,
    };
  }

  if (shape.kind === "circle") {
    // Two half turns give the loop real endpoints while keeping it exact:
    // the chord shoelace vanishes and the two corrections add up to pi*r^2.
    const first: CircularArc = { c: shape.c, r: shape.r, start: 0, sweep: 180 };
    const second: CircularArc = { c: shape.c, r: shape.r, start: 180, sweep: 180 };
    return {
      segments: [
        { kind: "arc", a: arcEndpoint(first, 0), b: arcEndpoint(first, 180), arc: first },
        { kind: "arc", a: arcEndpoint(second, 180), b: arcEndpoint(second, 360), arc: second },
      ],
      closed: true,
    };
  }

  if (shape.kind === "polyline") {
    const segments: ContourSegment[] = [];
    const segmentCount = shape.closed ? shape.points.length : shape.points.length - 1;
    for (let index = 0; index < segmentCount; index++) {
      const a = shape.points[index];
      const b = shape.points[(index + 1) % shape.points.length];
      const curved = bulgeArc(a, b, shape.bulges[index] ?? 0);
      if (curved) segments.push({ kind: "arc", a, b, arc: curved });
      else if (distance(a, b) > EPSILON) segments.push({ kind: "line", a, b });
    }
    if (!segments.length) return null;
    return { segments, closed: shape.closed };
  }

  // A partial ellipse has no exact circular decomposition here.
  return null;
}

/** Chord shoelace plus the exact circular-segment area contributed by each arc. */
function signedContourArea(segments: ContourSegment[]) {
  let shoelace = 0;
  for (const segment of segments) {
    shoelace += segment.a.x * segment.b.y - segment.b.x * segment.a.y;
  }

  let area = shoelace / 2;
  for (const segment of segments) {
    if (segment.kind !== "arc") continue;
    const theta = Math.abs(segment.arc.sweep) * Math.PI / 180;
    const circularSegment = segment.arc.r * segment.arc.r / 2 * (theta - Math.sin(theta));
    area += Math.sign(segment.arc.sweep) * circularSegment;
  }
  return area;
}

function sampleContour(segments: ContourSegment[]) {
  const points: Point2D[] = [];
  for (const segment of segments) {
    if (segment.kind === "line") {
      points.push(segment.a);
      continue;
    }
    const sampled = sampleCircularArc(segment.arc, 6);
    for (let index = 0; index < sampled.length - 1; index++) points.push(sampled[index]);
  }
  return points;
}

function contourFromSegments(segments: ContourSegment[]): ClosedContour | null {
  const area = Math.abs(signedContourArea(segments));
  if (!(area > 0) || !Number.isFinite(area)) return null;
  const polygon = sampleContour(segments);
  if (polygon.length < 3) return null;
  return {
    area,
    sample: polygon[0],
    contains: (point) => pointInPolygon(point, polygon),
  };
}

/**
 * Joins loose primitives into contours. Real drawings rarely hand over one
 * closed polyline: an outline is usually a run of separate LINE and ARC
 * entities that only meet at their endpoints.
 */
function stitchOpenChains(chains: ContourSegment[][]) {
  const used = new Array(chains.length).fill(false);
  const loops: ContourSegment[][] = [];
  let openChains = 0;

  const endsOf = (chain: ContourSegment[]) => ({ start: chain[0].a, end: chain[chain.length - 1].b });
  const meets = (left: Point2D, right: Point2D) => distance(left, right) <= CONTOUR_STITCH_TOLERANCE;

  for (let index = 0; index < chains.length; index++) {
    if (used[index]) continue;
    used[index] = true;
    let chain = [...chains[index]];

    for (let grew = true; grew;) {
      grew = false;
      for (let other = 0; other < chains.length; other++) {
        if (used[other]) continue;
        const { start: chainStart, end: chainEnd } = endsOf(chain);
        const candidate = chains[other];
        const { start: candidateStart, end: candidateEnd } = endsOf(candidate);

        if (meets(chainEnd, candidateStart)) chain = [...chain, ...candidate];
        else if (meets(chainEnd, candidateEnd)) chain = [...chain, ...[...candidate].reverse().map(reverseSegment)];
        else if (meets(chainStart, candidateEnd)) chain = [...candidate, ...chain];
        else if (meets(chainStart, candidateStart)) chain = [...[...candidate].reverse().map(reverseSegment), ...chain];
        else continue;

        used[other] = true;
        grew = true;
        break;
      }
    }

    const { start, end } = endsOf(chain);
    if (meets(start, end)) loops.push(chain);
    else openChains++;
  }

  return { loops, openChains };
}

function ellipseContour(shape: Extract<DxfShape, { kind: "ellipse" }>): ClosedContour {
  const majorRadius = Math.hypot(shape.major.x, shape.major.y);
  const minorRadius = majorRadius * shape.ratio;
  const unitMajor = { x: shape.major.x / majorRadius, y: shape.major.y / majorRadius };
  const unitMinor = { x: -unitMajor.y, y: unitMajor.x };
  return {
    area: Math.PI * majorRadius * minorRadius,
    sample: { x: shape.c.x + shape.major.x * 0.999, y: shape.c.y + shape.major.y * 0.999 },
    contains: (point) => {
      const dx = point.x - shape.c.x;
      const dy = point.y - shape.c.y;
      const alongMajor = dx * unitMajor.x + dy * unitMajor.y;
      const alongMinor = dx * unitMinor.x + dy * unitMinor.y;
      return (alongMajor / majorRadius) ** 2 + (alongMinor / minorRadius) ** 2 < 1 - 1e-10;
    },
  };
}

function closedContourMetrics(shapes: DxfShape[], unsupported: Set<string>) {
  const closed: ClosedContour[] = [];
  const openChains: ContourSegment[][] = [];
  let exact = unsupported.size === 0;

  for (const shape of shapes) {
    if (shape.kind === "ellipse") {
      if (!ellipseIsFull(shape)) {
        exact = false;
        continue;
      }
      closed.push(ellipseContour(shape));
      continue;
    }

    const built = segmentsOfShape(shape);
    if (!built) {
      exact = false;
      continue;
    }

    if (!built.closed) {
      openChains.push(built.segments);
      continue;
    }

    const contour = contourFromSegments(built.segments);
    if (!contour) {
      exact = false;
      continue;
    }
    closed.push(contour);
  }

  const stitched = stitchOpenChains(openChains);
  for (const loop of stitched.loops) {
    const contour = contourFromSegments(loop);
    if (!contour) {
      exact = false;
      continue;
    }
    closed.push(contour);
  }
  // A contour left open is a real drawing problem, not a rounding issue: the
  // enclosed area is undefined, so no area is reported for the whole file.
  if (stitched.openChains > 0) exact = false;

  if (!exact || !closed.length) {
    return { area: null, pierces: null, holes: null, closedContours: closed.length, status: "unavailable" as const };
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

  return { area: Math.max(0, netArea), pierces: closed.length, holes, closedContours: closed.length, status: "exact" as const };
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

function parseLegacyPolylineSequence(pairs: Pair[], start: number, headerFields: Pair[]) {
  const headerFlags = numberField(headerFields, 70) ?? 0;
  const closed = (headerFlags & 1) === 1;
  const issues = new Set<string>();
  const points: Point2D[] = [];
  const bulges: number[] = [];

  if ((headerFlags & LEGACY_POLYLINE_COMPLEX_FLAGS) !== 0) issues.add("POLYLINE_COMPLEX");

  let cursor = start;
  let foundSeqend = false;
  while (cursor < pairs.length) {
    if (pairs[cursor][0] !== 0) {
      cursor++;
      continue;
    }

    const entity = pairs[cursor][1];
    if (entity === "SEQEND") {
      cursor = collectEntityFields(pairs, cursor).end;
      foundSeqend = true;
      break;
    }
    if (entity !== "VERTEX") {
      issues.add("POLYLINE_SEQUENCE");
      break;
    }

    const { fields, end } = collectEntityFields(pairs, cursor);
    const vertexFlags = numberField(fields, 70) ?? 0;
    const x = numberField(fields, 10);
    const y = numberField(fields, 20);
    const z = numberField(fields, 30) ?? 0;
    const bulge = numberField(fields, 42) ?? 0;

    if ((vertexFlags & LEGACY_VERTEX_COMPLEX_FLAGS) !== 0 || Math.abs(z) > EPSILON) issues.add("POLYLINE_COMPLEX");
    if (x == null || y == null) issues.add("POLYLINE_INVALID_VERTEX");
    else {
      points.push({ x, y });
      bulges.push(Number.isFinite(bulge) ? bulge : 0);
    }
    cursor = end;
  }

  if (!foundSeqend) issues.add("POLYLINE_SEQUENCE");
  if (points.length < 2) issues.add("POLYLINE_TOO_FEW_VERTICES");

  return {
    shape: issues.size === 0 ? { kind: "polyline" as const, points, bulges, closed } : null,
    issues: [...issues],
    end: cursor,
  };
}

function parseEllipse(fields: Pair[]) {
  const cx = numberField(fields, 10);
  const cy = numberField(fields, 20);
  const majorX = numberField(fields, 11);
  const majorY = numberField(fields, 21);
  const majorZ = numberField(fields, 31) ?? 0;
  const ratio = numberField(fields, 40);
  const rawStart = numberField(fields, 41) ?? 0;
  const rawEnd = numberField(fields, 42) ?? TWO_PI;
  const extrusionX = numberField(fields, 210) ?? 0;
  const extrusionY = numberField(fields, 220) ?? 0;
  const extrusionZ = numberField(fields, 230) ?? 1;

  if ([cx, cy, majorX, majorY, ratio].some((value) => value == null)) return { shape: null, issue: "ELLIPSE_INVALID" };
  if (Math.abs(majorZ) > EPSILON || Math.abs(extrusionX) > EPSILON || Math.abs(extrusionY) > EPSILON || Math.abs(extrusionZ - 1) > EPSILON) {
    return { shape: null, issue: "ELLIPSE_NONPLANAR" };
  }
  const majorRadius = Math.hypot(majorX!, majorY!);
  if (!(majorRadius > EPSILON) || !(ratio! > 0) || ratio! > 1 + 1e-10) return { shape: null, issue: "ELLIPSE_INVALID" };
  if (rawStart < -1e-10 || rawStart > TWO_PI + 1e-10 || rawEnd < -1e-10 || rawEnd > TWO_PI + 1e-10) return { shape: null, issue: "ELLIPSE_PARAMETERS" };

  const start = Math.min(TWO_PI, Math.max(0, rawStart));
  const end = Math.min(TWO_PI, Math.max(0, rawEnd));
  const full = Math.abs(start) <= 1e-10 && Math.abs(end - TWO_PI) <= 1e-10;
  if (!full && Math.abs(end - start) <= 1e-12) return { shape: null, issue: "ELLIPSE_PARAMETERS" };

  const shape = {
    kind: "ellipse" as const,
    c: { x: cx!, y: cy! },
    major: { x: majorX!, y: majorY! },
    ratio: Math.min(1, ratio!),
    start,
    end,
  };
  const sweep = ellipseSweep(shape);
  if (!(sweep > EPSILON) || sweep > TWO_PI + 1e-10) return { shape: null, issue: "ELLIPSE_PARAMETERS" };
  const length = ellipseArcLength(shape);
  if (length == null || !Number.isFinite(length) || !(length > 0)) return { shape: null, issue: "ELLIPSE_LENGTH_UNAVAILABLE" };
  return { shape, issue: null };
}

function parseSplineControlPoints(fields: Pair[]) {
  const points: Point2D[] = [];
  let invalid = false;
  let nonPlanar = false;
  let currentX: number | undefined;
  let currentY: number | undefined;
  let currentZ = 0;

  const flush = () => {
    if (currentX == null) return;
    if (currentY == null || !Number.isFinite(currentX) || !Number.isFinite(currentY) || !Number.isFinite(currentZ)) invalid = true;
    else {
      points.push({ x: currentX, y: currentY });
      if (Math.abs(currentZ) > EPSILON) nonPlanar = true;
    }
  };

  for (const [code, raw] of fields) {
    if (code === 10) {
      flush();
      const value = Number(raw);
      currentX = Number.isFinite(value) ? value : undefined;
      currentY = undefined;
      currentZ = 0;
      if (!Number.isFinite(value)) invalid = true;
    } else if (code === 20 && currentX != null) {
      const value = Number(raw);
      currentY = Number.isFinite(value) ? value : undefined;
      if (!Number.isFinite(value)) invalid = true;
    } else if (code === 30 && currentX != null) {
      const value = Number(raw);
      if (Number.isFinite(value)) currentZ = value;
      else invalid = true;
    }
  }
  flush();
  return { points, invalid, nonPlanar };
}

function parseLinearPlanarSpline(fields: Pair[]) {
  const flags = numberField(fields, 70) ?? 0;
  const degree = numberField(fields, 71);
  const declaredKnotCount = numberField(fields, 72);
  const declaredControlCount = numberField(fields, 73);
  const normalX = numberField(fields, 210) ?? 0;
  const normalY = numberField(fields, 220) ?? 0;
  const normalZ = numberField(fields, 230) ?? 1;
  const closed = (flags & 1) !== 0;
  const periodic = (flags & 2) !== 0;
  const rational = (flags & 4) !== 0;
  const planar = (flags & 8) !== 0;
  const linear = (flags & 16) !== 0;

  if (!planar || !linear || closed || periodic || rational || degree !== 1) {
    return { shape: null, issue: "SPLINE_UNSUPPORTED" };
  }
  if (Math.abs(normalX) > EPSILON || Math.abs(normalY) > EPSILON || Math.abs(normalZ - 1) > EPSILON) {
    return { shape: null, issue: "SPLINE_NONPLANAR" };
  }
  if (!Number.isInteger(declaredKnotCount) || !Number.isInteger(declaredControlCount) || (declaredControlCount ?? 0) < 2) {
    return { shape: null, issue: "SPLINE_INVALID" };
  }

  const rawKnots = fields.filter(([code]) => code === 40).map(([, raw]) => Number(raw));
  if (rawKnots.some((value) => !Number.isFinite(value)) || rawKnots.length !== declaredKnotCount) {
    return { shape: null, issue: "SPLINE_KNOTS" };
  }
  const { points, invalid, nonPlanar } = parseSplineControlPoints(fields);
  if (invalid || points.length !== declaredControlCount) return { shape: null, issue: "SPLINE_INVALID" };
  if (nonPlanar) return { shape: null, issue: "SPLINE_NONPLANAR" };
  if (rawKnots.length !== points.length + 2) return { shape: null, issue: "SPLINE_KNOTS" };

  const scale = Math.max(1, ...rawKnots.map((value) => Math.abs(value)));
  const tolerance = scale * 1e-12;
  if (Math.abs(rawKnots[0] - rawKnots[1]) > tolerance || Math.abs(rawKnots.at(-1)! - rawKnots.at(-2)!) > tolerance) {
    return { shape: null, issue: "SPLINE_KNOTS" };
  }
  for (let index = 1; index < rawKnots.length - 2; index++) {
    if (!(rawKnots[index + 1] - rawKnots[index] > tolerance)) return { shape: null, issue: "SPLINE_KNOTS" };
  }
  if (!(rawKnots.at(-2)! - rawKnots[1] > tolerance)) return { shape: null, issue: "SPLINE_KNOTS" };

  const rawWeights = fields.filter(([code]) => code === 41).map(([, raw]) => Number(raw));
  if (rawWeights.some((value) => !Number.isFinite(value))) return { shape: null, issue: "SPLINE_INVALID" };
  if (rawWeights.length > 0) {
    if (rawWeights.length !== points.length || rawWeights.some((value) => Math.abs(value - 1) > 1e-12)) {
      return { shape: null, issue: "SPLINE_UNSUPPORTED" };
    }
  }

  return {
    shape: { kind: "polyline" as const, points, bulges: points.map(() => 0), closed: false },
    issue: null,
  };
}

/**
 * Entities that live in the ENTITIES section but describe the drawing rather
 * than the part: notes, dimensions and their leaders, block attributes,
 * construction lines of infinite length, raster underlays, embedded objects and
 * layout viewport frames. None of them carries a cut path, a pierce or any
 * material, so skipping one cannot make a part cheaper than it can be made —
 * they are recorded as read. Everything else stays unread on purpose, INSERT
 * and HATCH included: a block reference or a hatch boundary can be real
 * geometry this parser did not open, and an under-read contour would be quoted
 * below its cost.
 */
const NON_MANUFACTURING_ENTITIES = new Set([
  "TEXT", "MTEXT", "POINT",
  "DIMENSION", "TOLERANCE",
  "LEADER", "MLEADER", "MULTILEADER",
  "ATTDEF", "ATTRIB",
  "XLINE", "RAY",
  "VIEWPORT",
  "IMAGE", "WIPEOUT",
  "OLEFRAME", "OLE2FRAME",
  "ACAD_TABLE", "TABLE",
]);

/**
 * AutoCAD Binary DXF sentinel. Such a file is a valid DXF, but this parser
 * reads the ASCII grouped-code form only, so decoding one as text yields
 * silence rather than geometry. Detecting it lets the caller say so instead of
 * analysing an empty drawing.
 */
const BINARY_DXF_SENTINEL = "AutoCAD Binary DXF";

export function isBinaryDxf(bytes: Uint8Array) {
  if (bytes.byteLength < BINARY_DXF_SENTINEL.length) return false;
  for (let index = 0; index < BINARY_DXF_SENTINEL.length; index += 1) {
    if (bytes[index] !== BINARY_DXF_SENTINEL.charCodeAt(index)) return false;
  }
  return true;
}

/**
 * A DXF carries no encoding declaration this parser can rely on, and the export
 * fabricators ask for — "сохраните как DXF R12/R2000" — is written by a Russian
 * AutoCAD or Компас in CP1251, one byte per character.
 *
 * Decoded as UTF-8 those bytes become replacement characters, so a layer named
 * РАЗМЕРЫ stops being recognised as annotation and its dimension lines are
 * counted as part of the part: a 200×100 plate was read as 200×140 with an
 * 800 mm cut instead of 600. Strict UTF-8 first keeps every valid UTF-8 file
 * byte-for-byte as it was; only a file that is not UTF-8 at all takes the
 * CP1251 path, and such a file is unreadable today anyway.
 */
export function decodeDxfText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1251").decode(bytes);
  }
}

export function parseAsciiDxf(text: string): ParsedDxf {
  const pairs = parsePairs(text);
  const units = detectUnits(pairs);
  const shapes: DxfShape[] = [];
  const unsupported = new Set<string>();
  const skippedServiceLayers = new Set<string>();
  let inEntities = false;

  for (let i = 0; i < pairs.length; i++) {
    const [code, value] = pairs[i];
    if (code === 0 && value === "SECTION") {
      // Assign rather than only set: a drawing whose ENTITIES section is never
      // closed with ENDSEC would otherwise keep reading the next section's
      // records as entities.
      const next = pairs[i + 1];
      inEntities = next?.[0] === 2 && next[1] === "ENTITIES";
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
    const layer = layerField(fields);
    const skipLayer = isServiceDxfLayer(layer);

    if (skipLayer) {
      skippedServiceLayers.add(layer);
      // A legacy POLYLINE owns a trailing VERTEX/SEQEND block. It still has to
      // be consumed, or its vertices would be read back as unknown entities.
      if (value === "POLYLINE") {
        const legacy = parseLegacyPolylineSequence(pairs, end, fields);
        i = Math.max(i, legacy.end - 1);
      }
      continue;
    }

    if (value === "LINE") {
      const x1 = numberField(fields, 10);
      const y1 = numberField(fields, 20);
      const x2 = numberField(fields, 11);
      const y2 = numberField(fields, 21);
      if ([x1, y1, x2, y2].every((n) => typeof n === "number")) shapes.push({ kind: "line", a: { x: x1!, y: y1! }, b: { x: x2!, y: y2! } });
      continue;
    }

    if (value === "CIRCLE") {
      const x = numberField(fields, 10);
      const y = numberField(fields, 20);
      const r = numberField(fields, 40);
      if ([x, y, r].every((n) => typeof n === "number") && r! > 0) shapes.push({ kind: "circle", c: { x: x!, y: y! }, r: r! });
      continue;
    }

    if (value === "ARC") {
      const x = numberField(fields, 10);
      const y = numberField(fields, 20);
      const r = numberField(fields, 40);
      const start = numberField(fields, 50);
      const finish = numberField(fields, 51);
      if ([x, y, r, start, finish].every((n) => typeof n === "number") && r! > 0) shapes.push({ kind: "arc", c: { x: x!, y: y! }, r: r!, start: start!, end: finish! });
      continue;
    }

    if (value === "ELLIPSE") {
      const ellipse = parseEllipse(fields);
      if (ellipse.shape) shapes.push(ellipse.shape);
      else if (ellipse.issue) unsupported.add(ellipse.issue);
      continue;
    }

    if (value === "SPLINE") {
      const spline = parseLinearPlanarSpline(fields);
      if (spline.shape) shapes.push(spline.shape);
      else if (spline.issue) unsupported.add(spline.issue);
      continue;
    }

    if (value === "LWPOLYLINE") {
      const { points, bulges } = parseLwPolyline(fields);
      const flags = Number(first(70) ?? "0");
      if (points.length >= 2) shapes.push({ kind: "polyline", points, bulges, closed: (flags & 1) === 1 });
      continue;
    }

    if (value === "POLYLINE") {
      const legacy = parseLegacyPolylineSequence(pairs, end, fields);
      for (const issue of legacy.issues) unsupported.add(issue);
      if (legacy.shape) shapes.push(legacy.shape);
      i = Math.max(i, legacy.end - 1);
      continue;
    }

    if (!NON_MANUFACTURING_ENTITIES.has(value)) unsupported.add(value);
  }

  if (!shapes.length) {
    throw new CadReadError(
      unsupported.size
        ? `В DXF не найдено ни одного контура, который можно раскроить: вся геометрия чертежа — ${[...unsupported].sort().join(", ")}. Расчлените блоки (команда РАСЧЛЕНИТЬ / EXPLODE) и сохраните контур линиями, полилиниями, дугами или окружностями.`
        : "В DXF не найдены поддерживаемые 2D-объекты LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, ELLIPSE или безопасный линейный SPLINE.",
    );
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
      pointsForBounds.push({ x: shape.c.x - shape.r, y: shape.c.y - shape.r }, { x: shape.c.x + shape.r, y: shape.c.y + shape.r });
      cutLength += Math.PI * shape.r * 2;
    } else if (shape.kind === "ellipse") {
      pointsForBounds.push(...exactEllipseBounds(shape));
      const ellipseLength = ellipseArcLength(shape);
      if (ellipseLength == null) throw new Error("Не удалось подтвердить длину DXF ELLIPSE с заданной точностью.");
      cutLength += ellipseLength;
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

  // Coordinates near the top of the double range are finite one at a time and
  // overflow the moment they are added up: an ARC at 1e308 gives an infinite
  // cut length. Nothing downstream can do anything sensible with that, and the
  // pricing path reads this result without the preview's validation, so the
  // file is refused here rather than turned into a number.
  if (![maxX - minX, maxY - minY, minX, minY, maxX, maxY, cutLength].every(Number.isFinite)) {
    throw new CadReadError(
      "Координаты в чертеже выходят за пределы, в которых деталь можно измерить: габариты и длина реза не вычисляются. Проверьте масштаб и положение геометрии относительно начала координат, затем сохраните файл заново.",
    );
  }

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
    unitsSource: units.source,
    unsupportedEntities: [...unsupported].sort(),
    skippedServiceLayers: [...skippedServiceLayers].sort(),
  };
}

function sampleCircularArc(arc: CircularArc, maxStepDegrees = 8) {
  const steps = Math.max(1, Math.ceil(Math.abs(arc.sweep) / maxStepDegrees));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (arc.start + (arc.sweep * index) / steps) * Math.PI / 180;
    return { x: arc.c.x + Math.cos(angle) * arc.r, y: arc.c.y + Math.sin(angle) * arc.r };
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
    if (!curved) result.push(b);
    else result.push(...sampleCircularArc(curved).slice(1));
  }
  return result;
}

export function ellipsePreviewPoints(shape: Extract<DxfShape, { kind: "ellipse" }>, maxStepRadians = Math.PI / 36) {
  const sweep = ellipseSweep(shape);
  const steps = Math.max(1, Math.ceil(sweep / maxStepRadians));
  return Array.from({ length: steps + 1 }, (_, index) => ellipsePoint(shape, shape.start + sweep * index / steps));
}

export function arcPoints(shape: Extract<DxfShape, { kind: "arc" }>) {
  return sampleCircularArc({ c: shape.c, r: shape.r, start: shape.start, sweep: normalizeArc(shape.start, shape.end) });
}