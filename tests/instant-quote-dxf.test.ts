import assert from "node:assert/strict";
import test from "node:test";
import { bulgeArc, parseAsciiDxf, polylinePreviewPoints } from "../lib/instant-quote/dxf";

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

function approx(actual: number, expected: number, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} ± ${tolerance}`);
}

test("parses basic line geometry in millimetres", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "LINE", "10", "0", "20", "0", "11", "100", "21", "50",
  ]));

  assert.equal(parsed.units, "мм");
  assert.equal(parsed.width, 100);
  assert.equal(parsed.height, 50);
  assert.equal(parsed.contours, 1);
  assert.equal(parsed.areaStatus, "unavailable");
  assert.equal(parsed.area, null);
  assert.ok(parsed.cutLength > 111 && parsed.cutLength < 112);
});

test("uses actual arc extents instead of full-circle bounding box", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "ARC", "10", "0", "20", "0", "40", "100", "50", "0", "51", "90",
  ]));

  assert.ok(parsed.minX >= -0.0001);
  assert.ok(parsed.minY >= -0.0001);
  assert.ok(parsed.maxX <= 100.0001);
  assert.ok(parsed.maxY <= 100.0001);
});

test("calculates exact area and pierce count for a closed polyline", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "LWPOLYLINE", "70", "1",
    "10", "0", "20", "0",
    "10", "100", "20", "0",
    "10", "100", "20", "50",
    "10", "0", "20", "50",
  ]));

  assert.equal(parsed.areaStatus, "exact");
  assert.equal(parsed.area, 5000);
  assert.equal(parsed.closedContours, 1);
  assert.equal(parsed.pierces, 1);
  assert.equal(parsed.holeCount, 0);
});

test("subtracts an internal circle as a hole", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "LWPOLYLINE", "70", "1",
    "10", "0", "20", "0",
    "10", "100", "20", "0",
    "10", "100", "20", "100",
    "10", "0", "20", "100",
    "0", "CIRCLE", "10", "50", "20", "50", "40", "10",
  ]));

  assert.equal(parsed.areaStatus, "exact");
  assert.ok(Math.abs((parsed.area ?? 0) - (10000 - Math.PI * 100)) < 0.001);
  assert.equal(parsed.pierces, 2);
  assert.equal(parsed.holeCount, 1);
});

test("converts positive semicircle bulge into exact clockwise-facing lower geometry per DXF sweep", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "LWPOLYLINE", "70", "0",
    "10", "0", "20", "0", "42", "1",
    "10", "100", "20", "0",
  ]));

  assert.equal(parsed.unsupportedEntities.includes("LWPOLYLINE_BULGE"), false);
  approx(parsed.cutLength, Math.PI * 50);
  approx(parsed.minX, 0);
  approx(parsed.maxX, 100);
  approx(parsed.minY, -50);
  approx(parsed.maxY, 0);
  approx(parsed.height, 50);
  assert.equal(parsed.areaStatus, "unavailable");

  const polyline = parsed.shapes.find((shape) => shape.kind === "polyline");
  assert.ok(polyline && polyline.kind === "polyline");
  const preview = polylinePreviewPoints(polyline);
  assert.ok(preview.some((point) => point.y < -49));
});

test("negative semicircle bulge mirrors the arc above the chord", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "LWPOLYLINE", "70", "0",
    "10", "0", "20", "0", "42", "-1",
    "10", "100", "20", "0",
  ]));

  approx(parsed.cutLength, Math.PI * 50);
  approx(parsed.minY, 0);
  approx(parsed.maxY, 50);
  approx(parsed.height, 50);
});

test("bulge conversion preserves signed sweep and exact radius", () => {
  const quarterBulge = Math.tan(Math.PI / 8);
  const positive = bulgeArc({ x: 0, y: 0 }, { x: 100, y: 0 }, quarterBulge);
  const negative = bulgeArc({ x: 0, y: 0 }, { x: 100, y: 0 }, -quarterBulge);
  assert.ok(positive);
  assert.ok(negative);
  approx(positive.sweep, 90);
  approx(negative.sweep, -90);
  approx(positive.r, 100 / Math.sqrt(2));
  approx(negative.r, 100 / Math.sqrt(2));
});

test("uses bulge on the last vertex for the closing segment of a closed LWPOLYLINE", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "LWPOLYLINE", "70", "1",
    "10", "0", "20", "0",
    "10", "100", "20", "0",
    "10", "100", "20", "100", "42", "1",
  ]));

  const closingRadius = Math.hypot(100, 100) / 2;
  approx(parsed.cutLength, 200 + Math.PI * closingRadius);
  assert.equal(parsed.closedContours, 1);

  // The closing bulge is a half turn, so the area is the chord triangle plus
  // the exact circular segment standing on it.
  assert.equal(parsed.areaStatus, "exact");
  approx(parsed.area ?? 0, 5000 + Math.PI * closingRadius ** 2 / 2);
  assert.equal(parsed.pierces, 1);
  assert.equal(parsed.holeCount, 0);
});

test("zero bulge remains backward-compatible with exact straight closed topology", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "LWPOLYLINE", "70", "1",
    "10", "0", "20", "0", "42", "0",
    "10", "100", "20", "0", "42", "0",
    "10", "100", "20", "50", "42", "0",
    "10", "0", "20", "50", "42", "0",
  ]));

  assert.equal(parsed.areaStatus, "exact");
  assert.equal(parsed.area, 5000);
  approx(parsed.cutLength, 300);
});

test("curved closed polyline is measured exactly, arc segments included", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "LWPOLYLINE", "70", "1",
    "10", "0", "20", "0", "42", "0.5",
    "10", "100", "20", "0",
    "10", "100", "20", "100",
  ]));

  assert.equal(parsed.unsupportedEntities.includes("LWPOLYLINE_BULGE"), false);
  assert.equal(parsed.closedContours, 1);
  assert.equal(parsed.areaStatus, "exact");

  const sweep = 4 * Math.atan(0.5);
  const radius = 100 * (1 + 0.5 ** 2) / (4 * 0.5);
  approx(parsed.area ?? 0, 5000 + radius ** 2 / 2 * (sweep - Math.sin(sweep)));
  assert.equal(parsed.pierces, 1);
});

test("parses a simple legacy 2D POLYLINE VERTEX sequence without leaking nested entities as unsupported", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "POLYLINE", "70", "0",
    "0", "VERTEX", "10", "0", "20", "0", "70", "0",
    "0", "VERTEX", "10", "100", "20", "0", "70", "0",
    "0", "VERTEX", "10", "100", "20", "50", "70", "0",
    "0", "SEQEND",
  ]));

  assert.equal(parsed.contours, 1);
  approx(parsed.width, 100);
  approx(parsed.height, 50);
  approx(parsed.cutLength, 150);
  assert.equal(parsed.areaStatus, "unavailable");
  assert.equal(parsed.unsupportedEntities.includes("POLYLINE"), false);
  assert.equal(parsed.unsupportedEntities.includes("VERTEX"), false);
  assert.equal(parsed.unsupportedEntities.includes("SEQEND"), false);
});

test("calculates exact straight topology for a closed legacy 2D POLYLINE", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "POLYLINE", "70", "1",
    "0", "VERTEX", "10", "0", "20", "0",
    "0", "VERTEX", "10", "100", "20", "0",
    "0", "VERTEX", "10", "100", "20", "50",
    "0", "VERTEX", "10", "0", "20", "50",
    "0", "SEQEND",
  ]));

  approx(parsed.cutLength, 300);
  assert.equal(parsed.areaStatus, "exact");
  assert.equal(parsed.area, 5000);
  assert.equal(parsed.closedContours, 1);
  assert.equal(parsed.pierces, 1);
  assert.equal(parsed.holeCount, 0);
  assert.deepEqual(parsed.unsupportedEntities, []);
});

test("legacy VERTEX bulge uses the same exact arc bounds and length as LWPOLYLINE", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "POLYLINE", "70", "0",
    "0", "VERTEX", "10", "0", "20", "0", "42", "1",
    "0", "VERTEX", "10", "100", "20", "0",
    "0", "SEQEND",
  ]));

  approx(parsed.cutLength, Math.PI * 50);
  approx(parsed.minX, 0);
  approx(parsed.maxX, 100);
  approx(parsed.minY, -50);
  approx(parsed.maxY, 0);
  assert.equal(parsed.areaStatus, "unavailable");
  assert.deepEqual(parsed.unsupportedEntities, []);
});

test("legacy closing VERTEX bulge is applied to the last-to-first segment", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "POLYLINE", "70", "1",
    "0", "VERTEX", "10", "0", "20", "0",
    "0", "VERTEX", "10", "100", "20", "0",
    "0", "VERTEX", "10", "100", "20", "100", "42", "1",
    "0", "SEQEND",
  ]));

  const closingRadius = Math.hypot(100, 100) / 2;
  approx(parsed.cutLength, 200 + Math.PI * closingRadius);
  assert.equal(parsed.areaStatus, "exact");
  approx(parsed.area ?? 0, 5000 + Math.PI * closingRadius ** 2 / 2);
  assert.equal(parsed.pierces, 1);
  assert.deepEqual(parsed.unsupportedEntities, []);
});

test("legacy 3D or mesh POLYLINE is fail-closed instead of silently projected into 2D", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "LINE", "10", "0", "20", "0", "11", "10", "21", "0",
    "0", "POLYLINE", "70", "8",
    "0", "VERTEX", "10", "0", "20", "0", "30", "0", "70", "32",
    "0", "VERTEX", "10", "100", "20", "0", "30", "20", "70", "32",
    "0", "SEQEND",
  ]));

  assert.equal(parsed.shapes.length, 1);
  assert.equal(parsed.shapes[0].kind, "line");
  assert.ok(parsed.unsupportedEntities.includes("POLYLINE_COMPLEX"));
  assert.equal(parsed.unsupportedEntities.includes("VERTEX"), false);
  assert.equal(parsed.unsupportedEntities.includes("SEQEND"), false);
  assert.equal(parsed.areaStatus, "unavailable");
});
