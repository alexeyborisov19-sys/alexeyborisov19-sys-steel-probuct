import assert from "node:assert/strict";
import test from "node:test";
import { createClientCadPreview } from "@/lib/instant-quote/client-cad-preview";
import type { NormalizedCadModel } from "@/lib/instant-quote/cad-model";
import type { ParsedDxf } from "@/lib/instant-quote/dxf";

test("client CAD preview strips production geometry and evidence", () => {
  const model = {
    format: "step",
    units: "mm",
    geometry: {
      widthMm: 120,
      heightMm: 80,
      depthMm: 2,
      areaMm2: 9_600,
      blankAreaMm2: 10_000,
      cutLengthMm: 450,
      contourCount: 3,
      pierceCount: 3,
      massKg: 1.5,
    },
    meshes: [{ id: "mesh-1", positions: [0, 0, 0], indices: [0] }],
    root: { id: "root", name: "Part", meshIds: ["mesh-1"], children: [] },
    features: [{ id: "bend-1", kind: "bend", radiusMm: 2, angleDeg: 90 }],
    sheetMetal: {
      source: "brep",
      status: "candidate",
      planarFaceCount: 2,
      cylindricalFaceCount: 1,
      otherFaceCount: 0,
      bendCandidates: [],
      warnings: ["private sheet-metal evidence"],
    },
    unfoldGeometry: { source: "brep", thicknessMm: 2, panels: [], bends: [], issues: ["private unfold evidence"] },
    metadata: {
      sourceFileName: "secret.step",
      sourceBytes: 1234,
      parser: "private-parser",
      analyzedAt: "2026-09-14T00:00:00.000Z",
    },
    warnings: ["detailed internal DFM reason"],
  } as unknown as NormalizedCadModel;

  const preview = createClientCadPreview(model);
  const serialized = JSON.stringify(preview);

  // Bounding box plus what was read off the customer's own model; nothing
  // about pricing. This model carries no thickness candidate, so none is shown.
  assert.deepEqual(preview.cad, {
    widthMm: 120,
    heightMm: 80,
    depthMm: 2,
    bendCountFromModel: null,
    thicknessFromModelMm: null,
  });
  assert.equal(preview.status, "needs-review");
  assert.equal(preview.meshes.length, 1);
  assert.equal(preview.root?.id, "root");
  assert.equal(preview.drawing, null);

  for (const forbidden of [
    "cutLengthMm",
    "contourCount",
    "pierceCount",
    "massKg",
    "blankAreaMm2",
    "sheetMetal",
    "unfoldGeometry",
    "features",
    "sourceFileName",
    "sourceBytes",
    "private-parser",
    "detailed internal DFM reason",
    "private sheet-metal evidence",
    "private unfold evidence",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `client CAD preview leaked ${forbidden}`);
  }
});

test("a verified STEP bend count reaches the customer, priced metrics do not", () => {
  const model = {
    format: "step",
    units: "mm",
    geometry: { widthMm: 250, heightMm: 157.3, depthMm: 1.5, bendCount: 2, cutLengthMm: 814.6, pierceCount: 1 },
    meshes: [],
    root: null,
    features: [],
    metadata: { sourceFileName: "angle.step", sourceBytes: 10, parser: "p", analyzedAt: "2026-09-15T00:00:00.000Z" },
    warnings: [],
  } as unknown as NormalizedCadModel;

  const preview = createClientCadPreview(model);
  assert.equal(preview.cad.bendCountFromModel, 2);

  const serialized = JSON.stringify(preview);
  for (const forbidden of ["cutLengthMm", "pierceCount", "814.6"]) {
    assert.equal(serialized.includes(forbidden), false, `preview leaked ${forbidden}`);
  }
});

test("DXF client drawing contains display points only", () => {
  const model = {
    format: "dxf",
    units: "mm",
    geometry: {
      widthMm: 100,
      heightMm: 50,
      areaMm2: 5_000,
      blankAreaMm2: 5_000,
      cutLengthMm: 300,
      contourCount: 1,
      pierceCount: 1,
    },
    meshes: [],
    root: null,
    features: [],
    metadata: {
      sourceFileName: "part.dxf",
      sourceBytes: 100,
      parser: "private-dxf-parser",
      analyzedAt: "2026-09-14T00:00:00.000Z",
    },
    warnings: [],
  } as unknown as NormalizedCadModel;
  const parsed = {
    shapes: [{ kind: "line", a: { x: 0, y: 0 }, b: { x: 100, y: 50 } }],
    width: 100,
    height: 50,
    minX: 0,
    minY: 0,
    maxX: 100,
    maxY: 50,
    cutLength: 111.8,
    contours: 1,
    closedContours: 0,
    pierces: null,
    holeCount: null,
    area: null,
    areaStatus: "unavailable",
    units: "мм",
    unitsCode: 4,
    unsupportedEntities: ["PRIVATE_DETAIL"],
  } as ParsedDxf;

  const preview = createClientCadPreview(model, parsed);
  assert.deepEqual(preview.drawing?.polylines, [{ points: [[0, 0], [100, 50]], closed: false }]);
  const serialized = JSON.stringify(preview);
  for (const forbidden of ["cutLength", "contours", "pierces", "holeCount", "areaStatus", "PRIVATE_DETAIL", "private-dxf-parser"]) {
    assert.equal(serialized.includes(forbidden), false, `DXF preview leaked ${forbidden}`);
  }
});

test("public CAD analyze route never returns the raw normalized model", async () => {
  const route = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../app/api/online-order/cad/analyze/route.ts", import.meta.url), "utf8"),
  );

  assert.match(route, /preview:\s*createClientCadPreview\(model,\s*parsedDxf\)/);
  assert.doesNotMatch(route, /\{\s*ok:\s*true,\s*model\s*\}/);
  assert.doesNotMatch(route, /details:\s*validation\.errors/);
});

test("public workspace never imports production CAD analyzers", async () => {
  const { readFile } = await import("node:fs/promises");
  const workspace = await readFile(new URL("../components/ClientManufacturingWorkspace.tsx", import.meta.url), "utf8");
  const previewRenderer = await readFile(new URL("../components/ClientCad2DPreview.tsx", import.meta.url), "utf8");

  for (const forbidden of [
    "cad-dispatcher",
    "NormalizedCadModel",
    "parseAsciiDxf",
    "ParsedDxf",
    "occt-step-kernel",
    "dxf-adapter",
  ]) {
    assert.equal(workspace.includes(forbidden), false, `client workspace imported ${forbidden}`);
    assert.equal(previewRenderer.includes(forbidden), false, `client preview renderer imported ${forbidden}`);
  }

  assert.match(workspace, /fetch\("\/api\/online-order\/cad\/analyze"/);
  assert.match(workspace, /import type \{ ClientCadPreview \}/);
});
