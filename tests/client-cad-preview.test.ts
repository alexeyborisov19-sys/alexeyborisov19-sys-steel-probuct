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
    unitsSource: "insunits",
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
  const workspace = await readFile(new URL("../components/ClientManufacturingWorkspace.tsx", import.meta.url), "utf8") + await readFile(new URL("../components/cad/shared/useCadProject.ts", import.meta.url), "utf8");
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

function dxfWithPolylines(pointCounts: number[]): ParsedDxf {
  const shapes = pointCounts.map((count) => ({
    kind: "polyline" as const,
    points: Array.from({ length: count }, (_, index) => ({ x: index, y: index % 7 })),
    bulges: Array.from({ length: count }, () => 0),
    closed: false,
  }));
  return {
    shapes,
    width: 100, height: 50, minX: 0, minY: 0, maxX: 100, maxY: 50,
    cutLength: 0, contours: shapes.length, closedContours: 0,
    pierces: null, holeCount: null, area: null, areaStatus: "unavailable",
    units: "мм", unitsCode: 4, unitsSource: "insunits",
    unsupportedEntities: [], skippedServiceLayers: [],
  } as ParsedDxf;
}

const geometryOnly = {
  format: "dxf",
  units: "mm",
  geometry: { widthMm: 100, heightMm: 50 },
  meshes: [],
  root: null,
  features: [],
  metadata: { sourceFileName: "part.dxf", sourceBytes: 1, parser: "p", analyzedAt: "2026-09-16T00:00:00.000Z" },
  warnings: [],
} as unknown as NormalizedCadModel;

test("a drawing too large for the preview budget loses whole contours, never half of one", () => {
  // A polyline cut off at the budget draws a contour that stops in mid-air,
  // and the customer reads that as a gap in their part rather than as a
  // preview that ran out of room.
  const preview = createClientCadPreview(geometryOnly, dxfWithPolylines([49_998, 5, 3]));
  const polylines = preview.drawing?.polylines ?? [];

  assert.equal(polylines.length, 1);
  assert.equal(polylines[0].points.length, 49_998);
});

test("the preview draws in screen-width strokes and never as a dash pattern", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../components/ClientCad2DPreview.tsx", import.meta.url), "utf8");

  // vector-effect keeps the line weight off the viewBox transform, so the
  // stroke width is screen pixels. Deriving it from the bounding box drew a
  // 340 mm part at half a pixel — a hairline the display smeared into a
  // broken dotted line.
  assert.equal(/strokeWidth:\s*Math\.max/.test(source), false, "stroke width is back on the bounding box");
  assert.match(source, /strokeWidth:\s*\d/);

  // Framer draws a pathLength animation with stroke-dasharray, and a dash
  // pattern under non-scaling-stroke is measured on the untransformed path and
  // painted on the transformed one: every straight run came out as dots.
  // The property, not the word: the comment above it explains why it is gone.
  assert.equal(/pathLength\s*:/.test(source), false, "the draw-on animation is back on pathLength");

  // Round joins close the pinholes where two segments meet, so a contour built
  // from many separate lines reads as one.
  assert.match(source, /strokeLinejoin:\s*"round"/);
});

test("layers the parser left out are named back to the customer", async () => {
  // A contour drawn on a layer whose name reads as annotation is excluded on
  // purpose. Nothing said so, and the drawing simply came up short — which is
  // indistinguishable from a parser that failed to read it.
  const parsed = dxfWithPolylines([3]);
  const withLayers = { ...parsed, skippedServiceLayers: ["РАМКА", "DIM"] } as ParsedDxf;

  const preview = createClientCadPreview(geometryOnly, withLayers);
  assert.deepEqual(preview.drawing?.excludedLayers, ["РАМКА", "DIM"]);

  const { readFile } = await import("node:fs/promises");
  const component = await readFile(new URL("../components/ClientCad2DPreview.tsx", import.meta.url), "utf8");
  assert.match(component, /Не показаны слои оформления/);
});

test("a drawing with nothing excluded says nothing", () => {
  const preview = createClientCadPreview(geometryOnly, dxfWithPolylines([3]));
  assert.deepEqual(preview.drawing?.excludedLayers, []);
});

test("the displayed mesh keeps its shape but not the single-precision tail", () => {
  // What the kernel hands over: Float32 values widened to JavaScript numbers,
  // where 12.3 arrives as 12.300000190734863.
  const positions = Array.from(new Float32Array([12.3, 0.1, 200.75, -45.125, 1000.4, 0.2]));
  const normals = Array.from(new Float32Array([0, 0, 1, 0.7071, -0.7071, 0]));
  const model = {
    format: "step",
    units: "mm",
    geometry: { widthMm: 120, heightMm: 80, depthMm: 2 },
    meshes: [{ id: "mesh-1", name: "STEP model", positions, normals, indices: [0, 1, 2] }],
    root: null,
    features: [],
    metadata: { sourceFileName: "part.step", sourceBytes: 1, parser: "p", analyzedAt: "2026-09-14T00:00:00.000Z" },
    warnings: [],
  } as unknown as NormalizedCadModel;

  const [mesh] = createClientCadPreview(model).meshes;

  // Every vertex still there, in order, and no further than a micron from where
  // the kernel put it — three orders finer than a preview of a 100-3000 mm part
  // can show.
  assert.equal(mesh.positions.length, positions.length);
  assert.deepEqual(mesh.indices, [0, 1, 2]);
  assert.equal(mesh.id, "mesh-1");
  positions.forEach((value, index) => {
    assert.ok(Math.abs(mesh.positions[index] - value) <= 0.0005, `vertex ${index}: ${mesh.positions[index]} vs ${value}`);
  });
  assert.equal(mesh.normals?.length, normals.length);
  normals.forEach((value, index) => {
    assert.ok(Math.abs((mesh.normals ?? [])[index] - value) <= 0.00005, `normal ${index}`);
  });

  // And the tail is what paid for it: the same geometry, less than half the wire.
  assert.ok(
    JSON.stringify(mesh.positions).length * 2 < JSON.stringify(positions).length,
    `rounded ${JSON.stringify(mesh.positions).length} bytes vs raw ${JSON.stringify(positions).length}`,
  );
});
