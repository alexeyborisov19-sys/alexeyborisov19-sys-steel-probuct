import assert from "node:assert/strict";
import test from "node:test";
import type { InstantQuoteProject } from "../lib/instant-quote/domain";
import { createPublicCalculationManifest } from "../lib/instant-quote/client-calculation-request";

const project: InstantQuoteProject = {
  id: "project-1",
  title: "Customer project",
  createdAt: "2099-01-01T00:00:00.000Z",
  updatedAt: "2099-01-01T00:00:00.000Z",
  activePartId: "part-1",
  parts: [{
    id: "part-1",
    fileName: "secret-geometry.dxf",
    format: "dxf",
    fileSizeBytes: 1234,
    createdAt: "2099-01-01T00:00:00.000Z",
    state: "configurable",
    geometry: {
      widthMm: 500,
      heightMm: 300,
      cutLengthMm: 9999,
      pierceCount: 42,
      areaMm2: 123456,
      blankAreaMm2: 150000,
      bendCount: 7,
    },
    configuration: {
      materialId: "hot",
      thicknessMm: 2,
      quantity: 10,
      operations: ["laser-cutting", "bending", "powder-coating", "threading", "countersink"],
    },
    quote: { kind: "not-requested" },
  }],
};

test("browser manifest contains customer operations needed for pricing and no CAD-derived production metrics", () => {
  const manifest = createPublicCalculationManifest(project, ["part-1"]);
  assert.deepEqual(manifest.parts[0].operations, ["laser-cutting", "bending", "powder-coating"]);
  const json = JSON.stringify(manifest).toLowerCase();
  for (const token of ["cutlength", "pierce", "area", "blank", "bendcount", "mass", "waste", "raterub", "directcost", "supplier"] ) {
    assert.equal(json.includes(token), false, `manifest leaked ${token}`);
  }
});

test("browser manifest preserves only file mapping and supported customer choices", () => {
  const manifest = createPublicCalculationManifest(project, ["part-1"]);
  assert.deepEqual(manifest.parts[0], {
    clientPartId: "part-1",
    fileIndex: 0,
    materialId: "hot",
    thicknessMm: 2,
    quantity: 10,
    operations: ["laser-cutting", "bending", "powder-coating"],
  });
});