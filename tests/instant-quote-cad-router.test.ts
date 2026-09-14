import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCad, cadFormatFromFileName, CadAdapterUnavailableError } from "../lib/instant-quote/cad-router";

function simpleDxf() {
  return [
    "0", "SECTION", "2", "HEADER",
    "9", "$INSUNITS", "70", "4",
    "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    "0", "LINE", "10", "0", "20", "0", "11", "100", "21", "50",
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");
}

test("detects supported CAD extensions case-insensitively", () => {
  assert.equal(cadFormatFromFileName("part.DXF"), "dxf");
  assert.equal(cadFormatFromFileName("body.STEP"), "step");
  assert.equal(cadFormatFromFileName("assembly.stp"), "stp");
  assert.equal(cadFormatFromFileName("drawing.pdf"), null);
});

test("routes DXF through the authoritative DXF adapter", async () => {
  const bytes = new TextEncoder().encode(simpleDxf());
  const model = await analyzeCad({ fileName: "part.dxf", format: "dxf", bytes });

  assert.equal(model.units, "mm");
  assert.equal(model.format, "dxf");
  assert.equal(model.geometry.widthMm, 100);
  assert.equal(model.geometry.heightMm, 50);
});

test("STEP stays explicitly unavailable until its real adapter is connected", async () => {
  await assert.rejects(
    () => analyzeCad({ fileName: "part.step", format: "step", bytes: new Uint8Array([1, 2, 3]) }),
    (error: unknown) => error instanceof CadAdapterUnavailableError && error.format === "step",
  );
});
