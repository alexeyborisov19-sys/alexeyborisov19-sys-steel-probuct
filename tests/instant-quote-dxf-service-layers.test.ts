import assert from "node:assert/strict";
import test from "node:test";
import { isServiceDxfLayer, parseAsciiDxf } from "../lib/instant-quote/dxf";

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

test("geometry on production layers survives the filter", () => {
  const parsed = parseAsciiDxf(PLATE_DXF);

  // 4 outline lines + fillet arc + 2 circles + the slot polyline on layer CUT.
  assert.equal(parsed.shapes.length, 8);
  assert.equal(parsed.shapes.filter((shape) => shape.kind === "circle").length, 2);
  assert.equal(parsed.shapes.filter((shape) => shape.kind === "polyline").length, 1);
});
