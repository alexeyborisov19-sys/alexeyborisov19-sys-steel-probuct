import assert from "node:assert/strict";
import test from "node:test";
import { createClientCadPreview } from "@/lib/instant-quote/client-cad-preview";
import type { NormalizedCadModel } from "@/lib/instant-quote/cad-model";

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

  assert.deepEqual(preview.cad, { widthMm: 120, heightMm: 80, depthMm: 2 });
  assert.equal(preview.status, "needs-review");
  assert.equal(preview.meshes.length, 1);
  assert.equal(preview.root?.id, "root");

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

test("public CAD analyze route never returns the raw normalized model", async () => {
  const route = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../app/api/online-order/cad/analyze/route.ts", import.meta.url), "utf8"),
  );

  assert.match(route, /preview:\s*createClientCadPreview\(model\)/);
  assert.doesNotMatch(route, /\{\s*ok:\s*true,\s*model\s*\}/);
  assert.doesNotMatch(route, /details:\s*validation\.errors/);
});
