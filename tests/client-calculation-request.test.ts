import assert from "node:assert/strict";
import test from "node:test";
import type { ManufacturingOperation, InstantQuoteProject } from "../lib/instant-quote/domain";
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
      operations: ["laser-cutting", "bending", "powder-coating"],
    },
    quote: { kind: "not-requested" },
  }],
};

test("browser manifest contains only customer configuration and no CAD-derived production metrics", () => {
  const manifest = createPublicCalculationManifest(project, ["part-1"]);
  assert.deepEqual(manifest.parts[0].operations, ["bending", "powder-coating"]);
  const json = JSON.stringify(manifest).toLowerCase();
  for (const token of ["cutlength", "pierce", "area", "blank", "bendcount", "mass", "waste", "raterub", "directcost", "supplier"] ) {
    assert.equal(json.includes(token), false, `manifest leaked ${token}`);
  }
});

test("browser manifest preserves only file mapping and customer choices", () => {
  const manifest = createPublicCalculationManifest(project, ["part-1"]);
  assert.deepEqual(manifest.parts[0], {
    clientPartId: "part-1",
    fileIndex: 0,
    materialId: "hot",
    thicknessMm: 2,
    quantity: 10,
    operations: ["bending", "powder-coating"],
    // A project configured without explicit quantities declares none.
    operationInputs: {},
  });
});

test("declared operation quantities travel only for the selected operations", () => {
  const configured = {
    ...project,
    parts: [{
      ...project.parts[0],
      configuration: {
        ...project.parts[0].configuration,
        operations: ["bending", "powder-coating"] as ManufacturingOperation[],
        operationInputs: {
          bendCount: 4,
          powderSides: 2 as const,
          // Welding is not selected for this part, so its length must not travel.
          weldLengthM: 7,
        },
      },
    }],
  };

  const manifest = createPublicCalculationManifest(configured, ["part-1"]);
  assert.deepEqual(manifest.parts[0].operationInputs, { bendCount: 4, powderSides: 2 });
});
