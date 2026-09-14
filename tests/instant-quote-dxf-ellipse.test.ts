import assert from "node:assert/strict";
import test from "node:test";
import { ellipsePreviewPoints, parseAsciiDxf } from "../lib/instant-quote/dxf";

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

function approx(actual: number, expected: number, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} ± ${tolerance}`);
}

function fullEllipse(centerX = 0, centerY = 0, majorX = 100, majorY = 0, ratio = 0.5) {
  return [
    "0", "ELLIPSE",
    "10", String(centerX), "20", String(centerY), "30", "0",
    "11", String(majorX), "21", String(majorY), "31", "0",
    "40", String(ratio), "41", "0", "42", String(Math.PI * 2),
  ];
}

test("parses a full axis-aligned DXF ellipse with analytic bounds, exact area and controlled arc length", () => {
  const parsed = parseAsciiDxf(dxf(fullEllipse()));

  approx(parsed.minX, -100);
  approx(parsed.maxX, 100);
  approx(parsed.minY, -50);
  approx(parsed.maxY, 50);
  approx(parsed.width, 200);
  approx(parsed.height, 100);
  approx(parsed.area ?? NaN, Math.PI * 100 * 50);
  approx(parsed.cutLength, 484.4224110273838, 1e-8);
  assert.equal(parsed.areaStatus, "exact");
  assert.equal(parsed.closedContours, 1);
  assert.equal(parsed.pierces, 1);
  assert.equal(parsed.holeCount, 0);
  assert.deepEqual(parsed.unsupportedEntities, []);
});

test("rotated full ellipse uses analytic coordinate extrema rather than preview sampling", () => {
  const parsed = parseAsciiDxf(dxf(fullEllipse(10, 20, 60, 80, 0.5)));
  const xAmplitude = Math.hypot(60, -40);
  const yAmplitude = Math.hypot(80, 30);

  approx(parsed.minX, 10 - xAmplitude);
  approx(parsed.maxX, 10 + xAmplitude);
  approx(parsed.minY, 20 - yAmplitude);
  approx(parsed.maxY, 20 + yAmplitude);
  approx(parsed.cutLength, 484.4224110273838, 1e-8);
  approx(parsed.area ?? NaN, Math.PI * 100 * 50);
});

test("partial circular ellipse uses DXF parameters in radians and remains open topology", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "ELLIPSE",
    "10", "0", "20", "0",
    "11", "100", "21", "0",
    "40", "1", "41", "0", "42", String(Math.PI / 2),
  ]));

  approx(parsed.minX, 0, 1e-9);
  approx(parsed.maxX, 100);
  approx(parsed.minY, 0);
  approx(parsed.maxY, 100);
  approx(parsed.cutLength, 100 * Math.PI / 2, 1e-9);
  assert.equal(parsed.areaStatus, "unavailable");
  assert.equal(parsed.area, null);
  assert.equal(parsed.closedContours, 0);
  assert.equal(parsed.pierces, null);
});

test("partial ellipse parameter range can wrap across 2pi without losing extrema", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "ELLIPSE",
    "10", "0", "20", "0",
    "11", "100", "21", "0",
    "40", "1", "41", String(3 * Math.PI / 2), "42", String(Math.PI / 2),
  ]));

  approx(parsed.minX, 0, 1e-9);
  approx(parsed.maxX, 100);
  approx(parsed.minY, -100);
  approx(parsed.maxY, 100);
  approx(parsed.cutLength, Math.PI * 100, 1e-9);
});

test("full ellipse participates in exact closed-contour hole topology", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "LWPOLYLINE", "70", "1",
    "10", "0", "20", "0",
    "10", "200", "20", "0",
    "10", "200", "20", "200",
    "10", "0", "20", "200",
    ...fullEllipse(100, 100, 30, 0, 0.5),
  ]));

  approx(parsed.area ?? NaN, 40000 - Math.PI * 30 * 15, 1e-8);
  assert.equal(parsed.areaStatus, "exact");
  assert.equal(parsed.closedContours, 2);
  assert.equal(parsed.pierces, 2);
  assert.equal(parsed.holeCount, 1);
});

test("ellipse preview samples the same parameterized curve but is not used for production bounds", () => {
  const parsed = parseAsciiDxf(dxf(fullEllipse()));
  const ellipse = parsed.shapes.find((shape) => shape.kind === "ellipse");
  assert.ok(ellipse && ellipse.kind === "ellipse");
  const points = ellipsePreviewPoints(ellipse);
  assert.ok(points.length > 60);
  approx(points[0].x, 100);
  approx(points[0].y, 0);
  approx(points.at(-1)!.x, 100);
  approx(points.at(-1)!.y, 0, 1e-9);
});

test("non-planar ellipse is fail-closed instead of being projected into XY production geometry", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "LINE", "10", "0", "20", "0", "11", "10", "21", "0",
    "0", "ELLIPSE",
    "10", "0", "20", "0", "30", "0",
    "11", "100", "21", "0", "31", "10",
    "40", "0.5", "41", "0", "42", String(Math.PI * 2),
  ]));

  assert.equal(parsed.shapes.length, 1);
  assert.equal(parsed.shapes[0].kind, "line");
  assert.ok(parsed.unsupportedEntities.includes("ELLIPSE_NONPLANAR"));
  assert.equal(parsed.areaStatus, "unavailable");
});

test("invalid ellipse ratio is fail-closed", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "LINE", "10", "0", "20", "0", "11", "10", "21", "0",
    "0", "ELLIPSE",
    "10", "0", "20", "0",
    "11", "100", "21", "0",
    "40", "1.2", "41", "0", "42", String(Math.PI * 2),
  ]));

  assert.ok(parsed.unsupportedEntities.includes("ELLIPSE_INVALID"));
  assert.equal(parsed.shapes.length, 1);
});
