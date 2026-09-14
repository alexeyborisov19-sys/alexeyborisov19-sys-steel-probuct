import assert from "node:assert/strict";
import test from "node:test";
import { parseAsciiDxf, polylinePreviewPoints } from "../lib/instant-quote/dxf";

function dxf(entities: string[]) {
  return [
    "0", "SECTION", "2", "HEADER",
    "9", "$INSUNITS", "70", "4",
    "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    ...entities,
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");
}

function approx(actual: number, expected: number, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} ± ${tolerance}`);
}

function controlPoint(x: number, y: number, z = 0) {
  return ["10", String(x), "20", String(y), "30", String(z)];
}

function linearSpline(options: {
  flags?: number;
  degree?: number;
  knots?: number[];
  declaredKnotCount?: number;
  points?: Array<[number, number, number?]>;
  declaredControlCount?: number;
  weights?: number[];
  normal?: [number, number, number];
} = {}) {
  const flags = options.flags ?? 24; // planar + linear
  const degree = options.degree ?? 1;
  const knots = options.knots ?? [0, 0, 1, 2, 2];
  const points = options.points ?? [[0, 0], [30, 40], [50, 20]];
  const declaredKnotCount = options.declaredKnotCount ?? knots.length;
  const declaredControlCount = options.declaredControlCount ?? points.length;
  const normal = options.normal ?? [0, 0, 1];

  return [
    "0", "SPLINE",
    "70", String(flags),
    "71", String(degree),
    "72", String(declaredKnotCount),
    "73", String(declaredControlCount),
    "74", "0",
    "210", String(normal[0]), "220", String(normal[1]), "230", String(normal[2]),
    ...knots.flatMap((value) => ["40", String(value)]),
    ...(options.weights ?? []).flatMap((value) => ["41", String(value)]),
    ...points.flatMap(([x, y, z = 0]) => controlPoint(x, y, z)),
  ];
}

function lineFixture() {
  return ["0", "LINE", "10", "0", "20", "0", "11", "10", "21", "0"];
}

test("normalizes a strict planar linear degree-1 spline into exact open line segments", () => {
  const parsed = parseAsciiDxf(dxf(linearSpline()));

  assert.equal(parsed.shapes.length, 1);
  const shape = parsed.shapes[0];
  assert.equal(shape.kind, "polyline");
  assert.ok(shape.kind === "polyline");
  assert.equal(shape.closed, false);
  assert.deepEqual(shape.points, [
    { x: 0, y: 0 },
    { x: 30, y: 40 },
    { x: 50, y: 20 },
  ]);
  assert.deepEqual(shape.bulges, [0, 0, 0]);

  approx(parsed.minX, 0);
  approx(parsed.maxX, 50);
  approx(parsed.minY, 0);
  approx(parsed.maxY, 40);
  approx(parsed.width, 50);
  approx(parsed.height, 40);
  approx(parsed.cutLength, 50 + Math.hypot(20, -20));
  assert.equal(parsed.areaStatus, "unavailable");
  assert.equal(parsed.area, null);
  assert.deepEqual(parsed.unsupportedEntities, []);

  assert.deepEqual(polylinePreviewPoints(shape), shape.points);
});

test("accepts explicit unit weights for the non-rational linear subset", () => {
  const parsed = parseAsciiDxf(dxf(linearSpline({ weights: [1, 1, 1] })));
  assert.equal(parsed.shapes.length, 1);
  assert.deepEqual(parsed.unsupportedEntities, []);
});

test("rejects declared knot-count mismatch without promoting the spline", () => {
  const parsed = parseAsciiDxf(dxf([
    ...lineFixture(),
    ...linearSpline({ declaredKnotCount: 6 }),
  ]));
  assert.equal(parsed.shapes.length, 1);
  assert.equal(parsed.shapes[0].kind, "line");
  assert.ok(parsed.unsupportedEntities.includes("SPLINE_KNOTS"));
});

test("rejects duplicate or non-increasing interior knots", () => {
  const parsed = parseAsciiDxf(dxf([
    ...lineFixture(),
    ...linearSpline({
      knots: [0, 0, 1, 1, 3, 3],
      points: [[0, 0], [20, 0], [30, 10], [50, 10]],
    }),
  ]));
  assert.equal(parsed.shapes.length, 1);
  assert.ok(parsed.unsupportedEntities.includes("SPLINE_KNOTS"));
});

test("rejects degree greater than one instead of sampling a nonlinear spline", () => {
  const parsed = parseAsciiDxf(dxf([
    ...lineFixture(),
    ...linearSpline({ degree: 2 }),
  ]));
  assert.equal(parsed.shapes.length, 1);
  assert.ok(parsed.unsupportedEntities.includes("SPLINE_UNSUPPORTED"));
});

test("rejects closed periodic and rational spline flags", () => {
  for (const flags of [25, 26, 28]) {
    const parsed = parseAsciiDxf(dxf([
      ...lineFixture(),
      ...linearSpline({ flags }),
    ]));
    assert.equal(parsed.shapes.length, 1, `flags ${flags}`);
    assert.ok(parsed.unsupportedEntities.includes("SPLINE_UNSUPPORTED"), `flags ${flags}`);
  }
});

test("rejects non-unit weights even when the rational flag is not set", () => {
  const parsed = parseAsciiDxf(dxf([
    ...lineFixture(),
    ...linearSpline({ weights: [1, 0.9, 1] }),
  ]));
  assert.equal(parsed.shapes.length, 1);
  assert.ok(parsed.unsupportedEntities.includes("SPLINE_UNSUPPORTED"));
});

test("rejects non-zero control-point Z instead of flattening it into XY", () => {
  const parsed = parseAsciiDxf(dxf([
    ...lineFixture(),
    ...linearSpline({ points: [[0, 0], [30, 40, 2], [50, 20]] }),
  ]));
  assert.equal(parsed.shapes.length, 1);
  assert.ok(parsed.unsupportedEntities.includes("SPLINE_NONPLANAR"));
});

test("rejects a spline whose normal is not default positive Z", () => {
  const parsed = parseAsciiDxf(dxf([
    ...lineFixture(),
    ...linearSpline({ normal: [1, 0, 0] }),
  ]));
  assert.equal(parsed.shapes.length, 1);
  assert.ok(parsed.unsupportedEntities.includes("SPLINE_NONPLANAR"));
});

test("rejects malformed control points and declared control-count mismatch", () => {
  const malformed = linearSpline();
  const yIndex = malformed.findIndex((value, index) => value === "20" && index > malformed.indexOf("10"));
  assert.ok(yIndex >= 0);
  malformed.splice(yIndex, 2);

  const parsedMalformed = parseAsciiDxf(dxf([
    ...lineFixture(),
    ...malformed,
  ]));
  assert.equal(parsedMalformed.shapes.length, 1);
  assert.ok(parsedMalformed.unsupportedEntities.includes("SPLINE_INVALID"));

  const parsedCount = parseAsciiDxf(dxf([
    ...lineFixture(),
    ...linearSpline({ declaredControlCount: 4 }),
  ]));
  assert.equal(parsedCount.shapes.length, 1);
  assert.ok(parsedCount.unsupportedEntities.includes("SPLINE_INVALID"));
});
