import assert from "node:assert/strict";
import test from "node:test";
import { decodeDxfText, isServiceDxfLayer, parseAsciiDxf } from "../lib/instant-quote/dxf";

/**
 * Reference plate: 400x250 outline (one corner filleted R10), two d12 holes and
 * a 20x7 obround slot, plus a dimension line on layer DIM 20 mm below the part.
 */
const PLATE_DXF = `0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
0
10
0
20
0
11
390
21
0
0
ARC
8
0
10
390
20
10
40
10
50
270
51
360
0
LINE
8
0
10
400
20
10
11
400
21
250
0
LINE
8
0
10
400
20
250
11
0
21
250
0
LINE
8
0
10
0
20
250
11
0
21
0
0
CIRCLE
8
0
10
50
20
50
40
6
0
CIRCLE
8
0
10
350
20
50
40
6
0
LWPOLYLINE
8
CUT
90
4
70
1
10
190
20
120
42
0
10
210
20
120
42
1
10
210
20
127
42
0
10
190
20
127
42
1
0
LINE
8
DIM
10
0
20
-20
11
400
21
-20
0
ENDSEC
0
EOF
`;

test("annotation layers are recognised by name", () => {
  for (const layer of ["DIM", "Размеры", "AXIS", "осевые", "TITLE", "Рамка", "DEFPOINTS", "hatch"]) {
    assert.equal(isServiceDxfLayer(layer), true, `${layer} should be a service layer`);
  }
  for (const layer of ["0", "CUT", "Контур", "OUTER", "DETAIL", "PART"]) {
    assert.equal(isServiceDxfLayer(layer), false, `${layer} must stay in the priced geometry`);
  }
});

test("a dimension line never reaches the bounding box or the cut length", () => {
  const parsed = parseAsciiDxf(PLATE_DXF);

  // Without the filter the DIM line at y=-20 stretched the part to 270 mm and
  // added its own 400 mm to the priced cut.
  assert.equal(parsed.width, 400);
  assert.equal(parsed.height, 250);
  assert.equal(parsed.minY, 0);
  assert.ok(Math.abs(parsed.cutLength - 1433.1) < 1433.1 * 0.005, `cut length was ${parsed.cutLength}`);
  assert.deepEqual(parsed.skippedServiceLayers, ["DIM"]);
});

test("the reference plate is measured against its known geometry", () => {
  const parsed = parseAsciiDxf(PLATE_DXF);
  const within = (actual: number, expected: number) =>
    assert.ok(Math.abs(actual - expected) <= expected * 0.005, `${actual} != ${expected} ± 0.5 %`);

  // 400x250 rectangle less the R10 corner fillet, two d12 holes and a 20x7
  // obround slot. The outline arrives as separate LINE and ARC entities, so it
  // only becomes a contour once the loose primitives are stitched together.
  assert.equal(parsed.areaStatus, "exact");
  within(parsed.area ?? 0, 99_574);
  assert.equal(parsed.pierces, 4);
  assert.equal(parsed.holeCount, 3);
});

test("geometry on production layers survives the filter", () => {
  const parsed = parseAsciiDxf(PLATE_DXF);

  // 4 outline lines + fillet arc + 2 circles + the slot polyline on layer CUT.
  assert.equal(parsed.shapes.length, 8);
  assert.equal(parsed.shapes.filter((shape) => shape.kind === "circle").length, 2);
  assert.equal(parsed.shapes.filter((shape) => shape.kind === "polyline").length, 1);
});

/**
 * CP1251 is what «сохраните как DXF R12/R2000» produces from a Russian CAD, and
 * that export is exactly the one fabricators ask customers for. Its layer names
 * are one byte per character, so decoding them as UTF-8 turned РАЗМЕРЫ into
 * replacement characters and the dimension line below the part was priced as
 * part of the part.
 */
function encodeCp1251(text: string) {
  const out = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    // U+0410..U+044F (А..я) occupy 0xC0..0xFF in CP1251; the rest of this
    // drawing is ASCII, which the two encodings share.
    out[index] = code >= 0x0410 && code <= 0x044f ? code - 0x0410 + 0xc0 : code;
  }
  return out;
}

/** 200x100 part on КОНТУР, with a dimension line 40 mm below it on РАЗМЕРЫ. */
const CYRILLIC_DXF = [
  "0", "SECTION", "2", "HEADER",
  "9", "$INSUNITS", "70", "4",
  "0", "ENDSEC",
  "0", "SECTION", "2", "ENTITIES",
  "0", "LWPOLYLINE", "8", "КОНТУР", "90", "4", "70", "1",
  "10", "0", "20", "0",
  "10", "200", "20", "0",
  "10", "200", "20", "100",
  "10", "0", "20", "100",
  "0", "LINE", "8", "РАЗМЕРЫ",
  "10", "0", "20", "-40", "11", "200", "21", "-40",
  "0", "ENDSEC", "0", "EOF",
].join("\n") + "\n";

test("a CP1251 drawing keeps its Cyrillic layer names", () => {
  const parsed = parseAsciiDxf(decodeDxfText(encodeCp1251(CYRILLIC_DXF)));

  // Decoded as UTF-8 the layer name was seven replacement characters, the
  // dimension line counted as geometry, and the plate was priced as 200x140
  // with an 800 mm cut instead of 200x100 and 600 mm.
  assert.deepEqual(parsed.skippedServiceLayers, ["РАЗМЕРЫ"]);
  assert.equal(parsed.width, 200);
  assert.equal(parsed.height, 100);
  assert.equal(parsed.minY, 0);
  assert.ok(Math.abs(parsed.cutLength - 600) < 1, `cut length was ${parsed.cutLength}`);
});

test("a UTF-8 drawing is read exactly as before", () => {
  const utf8 = new TextEncoder().encode(CYRILLIC_DXF);
  assert.equal(decodeDxfText(utf8), CYRILLIC_DXF);

  // Including the byte-order mark a Windows save puts in front of it.
  const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]);
  assert.equal(decodeDxfText(withBom), CYRILLIC_DXF);

  const parsed = parseAsciiDxf(decodeDxfText(withBom));
  assert.deepEqual(parsed.skippedServiceLayers, ["РАЗМЕРЫ"]);
  assert.equal(parsed.height, 100);
});
