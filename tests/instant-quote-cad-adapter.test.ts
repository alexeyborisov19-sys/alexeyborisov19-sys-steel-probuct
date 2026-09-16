import assert from "node:assert/strict";
import test from "node:test";
import { dxfCadAdapter } from "../lib/instant-quote/dxf-adapter";
import { validateNormalizedCadModel } from "../lib/instant-quote/cad-model";
import { inspectUploads } from "../lib/security/uploads";

function source(unitCode: number | null, x: number, y: number) {
  const header = unitCode == null
    ? ["0", "SECTION", "2", "HEADER", "0", "ENDSEC"]
    : ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", String(unitCode), "0", "ENDSEC"];
  return new TextEncoder().encode([
    ...header,
    "0", "SECTION", "2", "ENTITIES",
    "0", "LINE", "10", "0", "20", "0", "11", String(x), "21", String(y),
    "0", "ENDSEC", "0", "EOF",
  ].join("\n"));
}

test("DXF adapter keeps millimetres unchanged", async () => {
  const model = await dxfCadAdapter.analyze({ fileName: "mm.dxf", format: "dxf", bytes: source(4, 100, 50) });
  assert.equal(model.geometry.widthMm, 100);
  assert.equal(model.geometry.heightMm, 50);
  assert.equal(validateNormalizedCadModel(model).ok, true);
});

test("DXF adapter converts inches to millimetres", async () => {
  const model = await dxfCadAdapter.analyze({ fileName: "inch.dxf", format: "dxf", bytes: source(1, 10, 5) });
  assert.equal(model.geometry.widthMm, 254);
  assert.equal(model.geometry.heightMm, 127);
  assert.ok(model.warnings.some((warning) => warning.includes("нормализована")));
});

test("DXF adapter refuses authoritative calculation when units are absent", async () => {
  await assert.rejects(
    () => dxfCadAdapter.analyze({ fileName: "unknown.dxf", format: "dxf", bytes: source(null, 100, 50) }),
    /единицы/i,
  );
});

test("a drawing exported the way real CAD exports it goes all the way through", async () => {
  // Everything in this file is what a customer actually sends and what the
  // calculator used to turn away: a byte-order mark, a 999 comment line naming
  // the exporter, no $INSUNITS at all, dimensions and a note in the ENTITIES
  // section next to the part. Kept as one test because the failure it guards
  // against was the chain, not any single link.
  const drawing = [
    "999", "Exported by LibreCAD",
    "0", "SECTION", "2", "HEADER",
    "9", "$MEASUREMENT", "70", "1",
    "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    "0", "LWPOLYLINE", "8", "CONTOUR", "90", "4", "70", "1",
    "10", "0", "20", "0",
    "10", "200", "20", "0",
    "10", "200", "20", "100",
    "10", "0", "20", "100",
    "0", "MTEXT", "8", "NOTES", "1", "Сталь 3 мм",
    "0", "DIMENSION", "8", "NOTES",
    "0", "LEADER", "8", "NOTES",
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");
  const bytes = new TextEncoder().encode(`\uFEFF${drawing}`);

  const [inspection] = await inspectUploads(
    [new File([bytes], "korpus.dxf", { type: "application/octet-stream" })],
    1,
  );
  const model = await dxfCadAdapter.analyze({
    fileName: inspection.safeName,
    format: "dxf",
    bytes: new Uint8Array(inspection.buffer),
  });

  assert.equal(model.geometry.widthMm, 200);
  assert.equal(model.geometry.heightMm, 100);
  assert.equal(model.geometry.cutLengthMm, 600);
  assert.equal(validateNormalizedCadModel(model).ok, true);
  // Units the drawing declared only through $MEASUREMENT are disclosed, not
  // passed off as a measured fact.
  assert.ok(model.warnings.some((warning) => warning.includes("$MEASUREMENT")), model.warnings.join(" | "));
});
