import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProject } from "../lib/instant-quote/domain";
import {
  addPartToProject,
  removePartFromProject,
  setPartQuantity,
  togglePartOperation,
  updatePartGeometry,
} from "../lib/instant-quote/project";

const t0 = new Date("2026-09-14T00:00:00.000Z");

test("adds multiple CAD parts and activates the latest one", () => {
  let project = createEmptyProject(t0);
  project = addPartToProject(project, { fileName: "panel.dxf", fileSizeBytes: 100 }, new Date("2026-09-14T00:00:01.000Z"));
  project = addPartToProject(project, { fileName: "bracket.step", fileSizeBytes: 200 }, new Date("2026-09-14T00:00:02.000Z"));

  assert.equal(project.parts.length, 2);
  assert.equal(project.parts[0].format, "dxf");
  assert.equal(project.parts[1].format, "step");
  assert.equal(project.parts[0].configuration.materialId, "cold");
  assert.equal(project.parts[1].configuration.materialId, "cold");
  assert.equal(project.activePartId, project.parts[1].id);
});

test("geometry update advances a part to DFM review", () => {
  let project = createEmptyProject(t0);
  project = addPartToProject(project, { fileName: "panel.dxf", fileSizeBytes: 100 }, t0);
  const id = project.parts[0].id;
  project = updatePartGeometry(project, id, { widthMm: 500, heightMm: 300, cutLengthMm: 1750 }, t0);

  assert.equal(project.parts[0].state, "dfm-review");
  assert.equal(project.parts[0].geometry?.widthMm, 500);
});

test("quantity and operations invalidate an existing quote state", () => {
  let project = createEmptyProject(t0);
  project = addPartToProject(project, { fileName: "panel.dxf", fileSizeBytes: 100 }, t0);
  const id = project.parts[0].id;

  project.parts[0].quote = { kind: "calculated", totalRub: 1000, unitRub: 1000, calculatedAt: t0.toISOString() };
  project = setPartQuantity(project, id, 25, t0);
  project = togglePartOperation(project, id, "bending", true, t0);

  assert.equal(project.parts[0].configuration.quantity, 25);
  assert.ok(project.parts[0].configuration.operations.includes("bending"));
  assert.equal(project.parts[0].quote.kind, "not-requested");
});

test("removing active part selects the next available part", () => {
  let project = createEmptyProject(t0);
  project = addPartToProject(project, { fileName: "a.dxf", fileSizeBytes: 100 }, new Date("2026-09-14T00:00:01.000Z"));
  project = addPartToProject(project, { fileName: "b.dxf", fileSizeBytes: 100 }, new Date("2026-09-14T00:00:02.000Z"));
  const active = project.activePartId!;
  project = removePartFromProject(project, active, t0);

  assert.equal(project.parts.length, 1);
  assert.equal(project.activePartId, project.parts[0].id);
});

test("rejects unsupported CAD file extensions", () => {
  const project = createEmptyProject(t0);
  assert.throws(() => addPartToProject(project, { fileName: "drawing.pdf", fileSizeBytes: 100 }, t0));
});
