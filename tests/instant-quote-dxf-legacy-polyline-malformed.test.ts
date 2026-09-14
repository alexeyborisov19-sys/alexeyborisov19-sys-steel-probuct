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

function parseWithSafeReference(legacySequence: string[]) {
  return parseAsciiDxf(dxf([
    "0", "LINE", "10", "0", "20", "0", "11", "10", "21", "0",
    ...legacySequence,
  ]));
}

function assertMalformedLegacyPolyline(parsed: ReturnType<typeof parseAsciiDxf>, expectedIssue: string) {
  assert.equal(parsed.shapes.filter((shape) => shape.kind === "polyline").length, 0);
  assert.equal(parsed.shapes.filter((shape) => shape.kind === "line").length, 1);
  assert.ok(parsed.unsupportedEntities.includes(expectedIssue), `expected ${expectedIssue}: ${parsed.unsupportedEntities.join(", ")}`);
}

test("legacy POLYLINE without SEQEND fails closed and is not promoted to geometry", () => {
  const parsed = parseWithSafeReference([
    "0", "POLYLINE", "70", "0",
    "0", "VERTEX", "10", "0", "20", "0",
    "0", "VERTEX", "10", "100", "20", "0",
  ]);

  assertMalformedLegacyPolyline(parsed, "POLYLINE_SEQUENCE");
});

test("unexpected entity inside legacy POLYLINE sequence fails closed", () => {
  const parsed = parseWithSafeReference([
    "0", "POLYLINE", "70", "0",
    "0", "VERTEX", "10", "0", "20", "0",
    "0", "TEXT", "10", "50", "20", "0", "1", "unexpected",
    "0", "SEQEND",
  ]);

  assertMalformedLegacyPolyline(parsed, "POLYLINE_SEQUENCE");
});

test("legacy POLYLINE with missing X or Y vertex coordinates fails closed", () => {
  const missingX = parseWithSafeReference([
    "0", "POLYLINE", "70", "0",
    "0", "VERTEX", "20", "0",
    "0", "VERTEX", "10", "100", "20", "0",
    "0", "SEQEND",
  ]);
  assertMalformedLegacyPolyline(missingX, "POLYLINE_INVALID_VERTEX");

  const missingY = parseWithSafeReference([
    "0", "POLYLINE", "70", "0",
    "0", "VERTEX", "10", "0",
    "0", "VERTEX", "10", "100", "20", "0",
    "0", "SEQEND",
  ]);
  assertMalformedLegacyPolyline(missingY, "POLYLINE_INVALID_VERTEX");
});

test("legacy POLYLINE with fewer than two valid vertices fails closed", () => {
  const parsed = parseWithSafeReference([
    "0", "POLYLINE", "70", "0",
    "0", "VERTEX", "10", "25", "20", "40",
    "0", "SEQEND",
  ]);

  assertMalformedLegacyPolyline(parsed, "POLYLINE_TOO_FEW_VERTICES");
});