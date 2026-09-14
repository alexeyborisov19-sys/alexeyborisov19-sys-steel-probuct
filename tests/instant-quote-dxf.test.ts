import assert from "node:assert/strict";
import test from "node:test";
import { parseAsciiDxf } from "../lib/instant-quote/dxf";

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

test("parses basic line geometry in millimetres", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "LINE", "10", "0", "20", "0", "11", "100", "21", "50",
  ]));

  assert.equal(parsed.units, "мм");
  assert.equal(parsed.width, 100);
  assert.equal(parsed.height, 50);
  assert.equal(parsed.contours, 1);
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

test("flags LWPOLYLINE bulges for manual review instead of silently trusting them", () => {
  const parsed = parseAsciiDxf(dxf([
    "0", "LWPOLYLINE", "70", "1",
    "10", "0", "20", "0", "42", "0.5",
    "10", "100", "20", "0",
    "10", "100", "20", "100",
  ]));

  assert.ok(parsed.unsupportedEntities.includes("LWPOLYLINE_BULGE"));
});
