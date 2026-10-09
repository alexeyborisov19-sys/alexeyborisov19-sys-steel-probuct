import assert from "node:assert/strict";
import test from "node:test";
import { buildCassetteElevation, createCassetteProject, normalizeCassetteProject, validateCassetteProject, type CassetteElevation } from "../lib/cassette-project/model";
import { createCassetteProjectCsv, createCassetteProjectBrief, parseCassetteProject, serializeCassetteProject } from "../lib/cassette-project/export";

function elevation(): CassetteElevation {
  return { id: "E1", name: "Фасад 1", widthMm: 2020, heightMm: 1020, panel: { faceWidthMm: 1000, faceHeightMm: 500, jointXMm: 20, jointYMm: 20, type: "open", thicknessMm: .7, finish: "RAL 7016" }, openings: [] };
}

test("face dimensions plus explicit joints produce actual rows, columns and full panels", () => {
  const result = buildCassetteElevation(elevation(), "project-1");
  assert.equal(result.rows, 2); assert.equal(result.columns, 2);
  assert.equal(result.summary.complete, 4); assert.equal(result.summary.edge, 0);
  assert.equal(result.summary.panelFaceAreaM2, 2);
  assert.equal(result.panels[3].id, "project-1/E1/r2c2");
  assert.deepEqual(result.panels[3].coordinationRect, { xMm: 1020, yMm: 520, widthMm: 1000, heightMm: 500 });
});

test("edge panels use the actual clipped face dimensions rather than proportional counts", () => {
  const e = elevation(); e.widthMm = 1500; e.heightMm = 700;
  const result = buildCassetteElevation(e, "project-1");
  assert.equal(result.summary.complete, 1); assert.equal(result.summary.edge, 3);
  assert.equal(result.panels[3].widthMm, 480); assert.equal(result.panels[3].heightMm, 180);
  assert.equal(result.summary.panelFaceAreaM2, 1.0064);
});

test("an opening exactly covering a panel removes that position, preserving its stable ID", () => {
  const e = elevation(); e.openings = [{ id: "O1", name: "Окно", xMm: 0, yMm: 0, widthMm: 1000, heightMm: 500 }];
  const result = buildCassetteElevation(e, "project-1");
  assert.equal(result.summary.removed, 1); assert.equal(result.summary.quantity, 3);
  assert.equal(result.panels[0].coordinationRect, null); assert.equal(result.panels[0].remainingAreaM2, 0);
  assert.equal(result.panels[0].id, "project-1/E1/r1c1");
});

test("an internal opening produces a review-needed nonrectangular position without fictional IFC rectangle", () => {
  const e = elevation(); e.openings = [{ id: "O1", name: "Окно", xMm: 100, yMm: 100, widthMm: 200, heightMm: 200 }];
  const result = buildCassetteElevation(e, "project-1");
  assert.equal(result.summary.affected, 1); assert.equal(result.summary.nonrectangular, 1);
  assert.equal(result.panels[0].status, "opening-affected"); assert.equal(result.panels[0].coordinationRect, null);
  assert.equal(result.panels[0].remainingAreaM2, .46); assert.equal(result.summary.panelFaceAreaM2, 1.96);
});

test("a full-height cut preserves only the remaining rectangular face, still requiring review", () => {
  const e = elevation(); e.openings = [{ id: "O1", name: "Дверь", xMm: 0, yMm: 0, widthMm: 200, heightMm: 500 }];
  const result = buildCassetteElevation(e, "project-1");
  assert.deepEqual(result.panels[0].coordinationRect, { xMm: 200, yMm: 0, widthMm: 800, heightMm: 500 });
  assert.equal(result.panels[0].status, "opening-affected"); assert.equal(result.summary.nonrectangular, 0);
});

test("openings inside joints do not falsely remove or affect panels", () => {
  const e = elevation(); e.openings = [{ id: "O1", name: "Шов", xMm: 1000, yMm: 0, widthMm: 20, heightMm: 500 }];
  const result = buildCassetteElevation(e, "project-1");
  assert.equal(result.summary.complete, 4); assert.equal(result.summary.affected, 0);
  assert.ok(Math.abs(result.summary.netElevationAreaM2 - result.summary.panelFaceAreaM2 - result.summary.jointAreaM2) < 1e-10);
});

test("touching openings are allowed and their combined removal remains exact", () => {
  const e = elevation(); e.openings = [
    { id: "O1", name: "Часть 1", xMm: 0, yMm: 0, widthMm: 500, heightMm: 500 },
    { id: "O2", name: "Часть 2", xMm: 500, yMm: 0, widthMm: 500, heightMm: 500 },
  ];
  const result = buildCassetteElevation(e, "project-1");
  assert.equal(result.summary.removed, 1); assert.equal(result.summary.openingsAreaM2, .5);
});

test("overlapping or outside openings are rejected instead of double-counted or silently clipped", () => {
  const p = createCassetteProject("project-1"); p.elevations = [elevation()];
  p.elevations[0].openings = [
    { id: "O1", name: "Окно 1", xMm: 0, yMm: 0, widthMm: 500, heightMm: 500 },
    { id: "O2", name: "Окно 2", xMm: 400, yMm: 0, widthMm: 500, heightMm: 500 },
  ];
  assert.ok(validateCassetteProject(p).some(message => message.includes("пересекаются")));
  assert.throws(() => buildCassetteElevation(p.elevations[0], p.id));
  p.elevations[0].openings = [{ id: "O1", name: "Окно", xMm: 1900, yMm: 0, widthMm: 500, heightMm: 500 }];
  assert.ok(validateCassetteProject(p).some(message => message.includes("границы")));
});

test("software capacity, non-finite numbers and impossible dimensions fail before generating panels", () => {
  const p = createCassetteProject("project-1"); p.elevations = [elevation()];
  for (const width of [0, -1, NaN, Infinity, 1e20]) {
    p.elevations[0].widthMm = width; assert.ok(validateCassetteProject(p).length > 0);
  }
  p.elevations[0].widthMm = 100000; p.elevations[0].heightMm = 100000;
  p.elevations[0].panel.faceWidthMm = 1; p.elevations[0].panel.faceHeightMm = 1;
  assert.ok(validateCassetteProject(p).some(message => message.includes("ячеек")));
});

test("project JSON round-trips identity and inputs and discards untrusted computed results", () => {
  const p = createCassetteProject("project-1"); p.elevations = [elevation()]; p.revision = 7;
  assert.deepEqual(parseCassetteProject(serializeCassetteProject(p)), p);
  assert.equal("price" in normalizeCassetteProject({ ...p, price: 1, approvedForManufacture: true }), false);
  assert.throws(() => parseCassetteProject(JSON.stringify({ ...p, schemaVersion: 999 })));
  assert.throws(() => parseCassetteProject(JSON.stringify({ ...p, elevations: [elevation(), elevation()] })));
  assert.throws(() => parseCassetteProject("x".repeat(1000001)));
});

test("panel identity survives colour changes, revision changes, added elevations and wider grids", () => {
  const p = createCassetteProject("project-1"); p.elevations = [elevation()];
  const before = buildCassetteElevation(p.elevations[0], p.id).panels.map(panel => panel.id);
  p.revision++; p.elevations[0].panel.finish = "RAL 9003"; p.elevations[0].widthMm = 3040;
  const after = buildCassetteElevation(p.elevations[0], p.id).panels;
  assert.ok(before.every(id => after.some(panel => panel.id === id)));
  assert.equal(new Set(after.map(panel => panel.id)).size, after.length);
});

test("CSV and brief retain panel IDs, status, scope and neutralize spreadsheet formulas", () => {
  const p = createCassetteProject("project-1"); p.elevations = [elevation()]; p.name = "=1+1"; p.elevations[0].panel.finish = "@SUM(A1:A2)";
  const csv = createCassetteProjectCsv(p);
  assert.ok(csv.includes("project-1/E1/r1c1")); assert.ok(csv.includes("'@SUM(A1:A2)"));
  assert.ok(csv.includes("не разрешение на изготовление"));
  const brief = createCassetteProjectBrief(p);
  assert.ok(brief.includes("project-1")); assert.ok(brief.includes("Подсистема")); assert.ok(brief.includes("Изготовление"));
});

test("a tiny opening in a large face is never hidden by a relative geometric tolerance", () => {
  const e = elevation(); e.widthMm = 1000000; e.heightMm = 1000000; e.panel.faceWidthMm = 1000000; e.panel.faceHeightMm = 1000000;
  e.openings = [{ id: "O1", name: "Малый проём", xMm: 100, yMm: 100, widthMm: .001, heightMm: .001 }];
  const result = buildCassetteElevation(e, "project-1");
  assert.equal(result.panels[0].coordinationRect, null); assert.equal(result.summary.nonrectangular, 1);
});

test("splitting a panel into disconnected rectangles keeps one review-needed layout position, never one false full panel", () => {
  const e = elevation(); e.openings = [{ id: "O1", name: "Разрыв", xMm: 400, yMm: 0, widthMm: 100, heightMm: 500 }];
  const panel = buildCassetteElevation(e, "project-1").panels[0];
  assert.equal(panel.remainingRects.length, 2); assert.equal(panel.coordinationRect, null); assert.equal(panel.status, "opening-affected");
  assert.equal(panel.remainingAreaM2, .45);
});

test("a facade ending within its trailing joint creates no zero or negative edge panel", () => {
  const e = elevation(); e.widthMm = 1010; e.heightMm = 510;
  const result = buildCassetteElevation(e, "project-1");
  assert.equal(result.panels.length, 1); assert.equal(result.summary.complete, 1);
  assert.ok(result.summary.jointAreaM2 > 0);
  assert.ok(result.panels.every(p => p.widthMm > 0 && p.heightMm > 0));
});

test("decimal precision and hostile project structure are rejected without throwing validation", () => {
  for (const value of [null, [], {}, { kind: "steelprodukt-cassette-project", schemaVersion: 1, elevations: [null] }]) assert.ok(validateCassetteProject(value).length);
  const p = createCassetteProject("project-1");
  p.elevations[0].panel.faceWidthMm = 10.0001;
  assert.ok(validateCassetteProject(p).length);
  p.elevations[0] = elevation(); p.elevations[0].openings = [{ id: "O1", name: "Окно", xMm: -1, yMm: 0, widthMm: 1, heightMm: 1 }];
  assert.ok(validateCassetteProject(p).length);
});

test("multiple openings are order-independent for dimensions, area and supported rectangular coverage", () => {
  const e = elevation(); e.openings = [
    { id: "O1", name: "Левый", xMm: 0, yMm: 0, widthMm: 100, heightMm: 500 },
    { id: "O2", name: "Правый", xMm: 900, yMm: 0, widthMm: 100, heightMm: 500 },
  ];
  const before = buildCassetteElevation(e, "project-1"); e.openings.reverse();
  const after = buildCassetteElevation(e, "project-1");
  assert.deepEqual(before.summary, after.summary);
  assert.deepEqual(before.panels[0].coordinationRect, after.panels[0].coordinationRect);
  assert.deepEqual(after.panels[0].coordinationRect, { xMm: 100, yMm: 0, widthMm: 800, heightMm: 500 });
});
