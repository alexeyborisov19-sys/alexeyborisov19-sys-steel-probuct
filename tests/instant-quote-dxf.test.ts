import assert from "node:assert/strict";
import test from "node:test";
import { bulgeArc, normalizeArc, parseAsciiDxf, polylinePreviewPoints } from "../lib/instant-quote/dxf";
import { dxfCadAdapter } from "../lib/instant-quote/dxf-adapter";
import { CadReadError } from "../lib/instant-quote/cad-model";

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

function dxfWithHeader(header: string[], entities: string[]) {
  return [
    "0", "SECTION", "2", "HEADER",
    ...header,
    "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    ...entities,
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");
}

const ONE_LINE = ["0", "LINE", "10", "0", "20", "0", "11", "100", "21", "50"];

test("a drawing that declares no $INSUNITS is read through $MEASUREMENT", () => {
  // Every R12 file omits $INSUNITS, and LibreCAD, Inkscape and several CAM
  // post-processors write it as 0 (unitless). $MEASUREMENT is the drawing's
  // other statement about its own system, so the file is still the source —
  // refusing it outright turned away a large share of real exports.
  const metric = parseAsciiDxf(dxfWithHeader(["9", "$MEASUREMENT", "70", "1"], ONE_LINE));
  assert.equal(metric.unitsCode, 4);
  assert.equal(metric.units, "мм");
  assert.equal(metric.unitsSource, "measurement");

  const imperial = parseAsciiDxf(dxfWithHeader(["9", "$MEASUREMENT", "70", "0"], ONE_LINE));
  assert.equal(imperial.unitsCode, 1);
  assert.equal(imperial.unitsSource, "measurement");
});

test("$INSUNITS 0 means unitless, so it falls through to $MEASUREMENT", () => {
  const parsed = parseAsciiDxf(dxfWithHeader(
    ["9", "$INSUNITS", "70", "0", "9", "$MEASUREMENT", "70", "1"],
    ONE_LINE,
  ));
  assert.equal(parsed.unitsCode, 4);
  assert.equal(parsed.unitsSource, "measurement");
});

test("a declared $INSUNITS outranks $MEASUREMENT", () => {
  const parsed = parseAsciiDxf(dxfWithHeader(
    ["9", "$INSUNITS", "70", "1", "9", "$MEASUREMENT", "70", "1"],
    ONE_LINE,
  ));
  assert.equal(parsed.unitsCode, 1);
  assert.equal(parsed.units, "дюймы");
  assert.equal(parsed.unitsSource, "insunits");
});

test("a drawing that declares nothing stays unknown rather than guessed", () => {
  const parsed = parseAsciiDxf(dxfWithHeader([], ONE_LINE));
  assert.equal(parsed.unitsCode, null);
  assert.equal(parsed.unitsSource, "unknown");
});

test("annotation inside ENTITIES counts as read, not as geometry left unread", () => {
  // None of these carries a cut path, a pierce or any material, so recording
  // one as unread geometry blocked the price on drawings that were fully
  // understood — a note and a leader do not change what the part costs.
  const parsed = parseAsciiDxf(dxf([
    ...ONE_LINE,
    "0", "LEADER", "8", "0",
    "0", "MLEADER", "8", "0",
    "0", "MULTILEADER", "8", "0",
    "0", "TOLERANCE", "8", "0",
    "0", "ATTDEF", "8", "0",
    "0", "ATTRIB", "8", "0",
    "0", "XLINE", "8", "0",
    "0", "RAY", "8", "0",
    "0", "VIEWPORT", "8", "0",
    "0", "IMAGE", "8", "0",
    "0", "WIPEOUT", "8", "0",
    "0", "OLE2FRAME", "8", "0",
    "0", "ACAD_TABLE", "8", "0",
  ]));

  assert.deepEqual(parsed.unsupportedEntities, []);
  assert.equal(parsed.shapes.length, 1);
});

test("geometry the parser did not open stays unread so no price is built on it", () => {
  // A block reference or a hatch boundary can be a real contour. Reading the
  // drawing without them would quote a part below what it costs to cut.
  const parsed = parseAsciiDxf(dxf([
    ...ONE_LINE,
    "0", "INSERT", "8", "0", "2", "HOLE",
    "0", "HATCH", "8", "0",
    "0", "SOLID", "8", "0",
    "0", "3DFACE", "8", "0",
  ]));

  assert.deepEqual(parsed.unsupportedEntities, ["3DFACE", "HATCH", "INSERT", "SOLID"]);
});

test("a drawing whose only content is a block reference says so instead of failing blankly", () => {
  assert.throws(
    () => parseAsciiDxf(dxf(["0", "INSERT", "8", "0", "2", "PART"])),
    (error: Error) => error.name === "CadReadError" && /INSERT/.test(error.message) && /EXPLODE/.test(error.message),
  );
});

test("an ENTITIES section left unclosed does not swallow the next section", () => {
  // Without ENDSEC the parser used to keep reading, and the records of the
  // following section came back as unread geometry that blocked the price.
  const parsed = parseAsciiDxf([
    "0", "SECTION", "2", "HEADER",
    "9", "$INSUNITS", "70", "4",
    "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    ...ONE_LINE,
    "0", "SECTION", "2", "OBJECTS",
    "0", "DICTIONARY", "3", "ACAD_GROUP",
    "0", "ENDSEC", "0", "EOF",
  ].join("\n"));

  assert.deepEqual(parsed.unsupportedEntities, []);
  assert.equal(parsed.shapes.length, 1);
});

test("a blank line ahead of the first group code does not empty the drawing", () => {
  // An empty line reads as the number 0, so the old fixed stride paired it with
  // "0" and then read every value line as a code: a complete drawing came back
  // with no geometry at all, and the customer was told their file had none.
  const parsed = parseAsciiDxf(`\n${dxf(ONE_LINE)}`);
  assert.equal(parsed.shapes.length, 1);
  assert.equal(parsed.width, 100);
  assert.equal(parsed.unitsCode, 4);
});

test("a byte-order mark ahead of the first group code is not read as part of it", () => {
  const parsed = parseAsciiDxf(`\uFEFF${dxf(ONE_LINE)}`);
  assert.equal(parsed.shapes.length, 1);
  assert.equal(parsed.unitsCode, 4);
});

test("an arc sweep is normalised in one step, whatever the angles say", () => {
  // The ordinary cases the parser relies on, unchanged.
  assert.equal(normalizeArc(0, 90), 90);
  assert.equal(normalizeArc(90, 0), 270);
  assert.equal(normalizeArc(0, 360), 0);
  assert.equal(normalizeArc(0, 720), 0);
  assert.equal(normalizeArc(360, 0), 0);
  assert.equal(normalizeArc(350, 10), 20);
  assert.equal(normalizeArc(-90, 90), 180);

  // And the ones that used to subtract 360 for ever, because at this magnitude
  // 360 is below the ulp and the subtraction returns the same number.
  for (const [start, end] of [[0, 1e308], [1e308, 0], [-1e308, 1e308], [0, 1e18], [0, Number.MAX_SAFE_INTEGER]]) {
    const sweep = normalizeArc(start, end);
    assert.ok(Number.isFinite(sweep) || Number.isNaN(sweep), `sweep was ${sweep}`);
    if (Number.isFinite(sweep)) assert.ok(sweep >= 0 && sweep < 360, `sweep ${sweep} outside [0, 360)`);
  }
});

test("a drawing with unmeasurable coordinates is refused, not chewed on", () => {
  // Before the loop was fixed this call never returned: the request that read
  // this two-hundred-byte file was pinned for good, on a public endpoint.
  const started = Date.now();
  assert.throws(
    () => parseAsciiDxf(dxf(["0", "ARC", "8", "CUT", "10", "1e308", "20", "0", "40", "1e308", "50", "0", "51", "1e308"])),
    CadReadError,
  );
  assert.ok(Date.now() - started < 1000, "parsing took longer than a second");
});

test("a drawing that overflows on the way to millimetres is refused", async () => {
  // Finite in the file's own units, infinite once converted from feet and
  // squared into a blank — and the blank is what the metal is billed by.
  const inFeet = [
    "0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "2", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    "0", "LINE", "8", "CUT", "10", "0", "20", "0", "11", "1e306", "21", "1e306",
    "0", "ENDSEC", "0", "EOF",
  ].join("\n") + "\n";

  await assert.rejects(
    () => dxfCadAdapter.analyze({ fileName: "huge.dxf", format: "dxf", bytes: new TextEncoder().encode(inFeet) }),
    CadReadError,
  );
});

test("an ordinary drawing still converts from feet without complaint", async () => {
  const inFeet = [
    "0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "2", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    "0", "LWPOLYLINE", "8", "CUT", "90", "4", "70", "1",
    "10", "0", "20", "0", "10", "1", "20", "0", "10", "1", "20", "1", "10", "0", "20", "1",
    "0", "ENDSEC", "0", "EOF",
  ].join("\n") + "\n";

  const model = await dxfCadAdapter.analyze({ fileName: "foot.dxf", format: "dxf", bytes: new TextEncoder().encode(inFeet) });
  // One foot square: 304.8 mm a side, and the blank is that squared.
  assert.ok(Math.abs((model.geometry.widthMm ?? 0) - 304.8) < 0.01);
  assert.ok(Math.abs((model.geometry.heightMm ?? 0) - 304.8) < 0.01);
  assert.ok(Math.abs((model.geometry.blankAreaMm2 ?? 0) - 304.8 * 304.8) < 1);
  assert.ok(Math.abs((model.geometry.cutLengthMm ?? 0) - 4 * 304.8) < 0.1);
});
