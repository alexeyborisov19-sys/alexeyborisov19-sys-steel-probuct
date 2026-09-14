import assert from "node:assert/strict";
import test from "node:test";
import { dxfCadAdapter } from "../lib/instant-quote/dxf-adapter";
import { validateNormalizedCadModel } from "../lib/instant-quote/cad-model";

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
