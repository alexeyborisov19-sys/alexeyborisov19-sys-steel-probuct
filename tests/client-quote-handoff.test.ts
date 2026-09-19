import assert from "node:assert/strict";
import test from "node:test";
import type { InstantQuoteProject } from "../lib/instant-quote/domain";
import {
  clearCalculatorHandoff,
  readCalculatorHandoff,
  saveCalculatorHandoff,
} from "../lib/instant-quote/client-quote-handoff";

function project(id: string): InstantQuoteProject {
  return {
    id,
    title: "Do not copy project metadata",
    createdAt: "2026-09-17T00:00:00Z",
    updatedAt: "2026-09-17T00:00:00Z",
    activePartId: "one",
    parts: [{
      id: "one",
      fileName: "plate.dxf",
      format: "dxf",
      fileSizeBytes: 1,
      createdAt: "2026-09-17T00:00:00Z",
      state: "configurable",
      geometry: { areaMm2: 123456, cutLengthMm: 98765, bendCount: 54321 },
      quote: { kind: "calculated", totalRub: 999999, unitRub: 999999, calculatedAt: "2026-09-17" },
      configuration: {
        materialId: "hot",
        thicknessMm: 2,
        quantity: 10,
        operations: ["laser-cutting", "bending", "powder-coating"],
        operationInputs: { bendCount: 3, powderSides: 2, weldLengthM: 76543 },
      },
    }],
  };
}

test("handoff preserves the customer's selected settings without geometry or pricing", () => {
  const input = project("safe-summary");
  const file = new File(["CAD"], "plate.dxf");
  saveCalculatorHandoff(input, { one: file });

  const result = readCalculatorHandoff(input.id);
  assert.ok(result);
  assert.deepEqual(Object.keys(result).sort(), ["files", "summary"]);
  assert.equal(result.summary, [
    "1. Файл: plate.dxf",
    "Материал: Сталь г/к; толщина: 2 мм; количество: 10 шт.",
    "Операции: Лазерная резка, Гибка, Порошковая окраска.",
    "Параметры операций: гибов — 3; сторон окраски — 2.",
  ].join("\n"));
  assert.equal(result.files[0], file);
  clearCalculatorHandoff(input.id);
});

test("handoff uses position order and keeps different files with identical names and metadata", () => {
  const input = project("duplicate-filenames");
  input.parts.push({ ...input.parts[0], id: "two" });
  const first = new File(["A"], "plate.dxf", { lastModified: 1 });
  const second = new File(["B"], "plate.dxf", { lastModified: 1 });
  saveCalculatorHandoff(input, { two: second, unrelated: new File(["C"], "ignored.dxf"), one: first });

  const result = readCalculatorHandoff(input.id);
  assert.ok(result);
  assert.equal(result.files.length, 2);
  assert.equal(result.files[0], first);
  assert.equal(result.files[1], second);
  assert.ok(result.summary.includes("2. Файл: plate.dxf"));
  clearCalculatorHandoff(input.id);
});

test("handoff stores a snapshot and callers cannot mutate later reads", () => {
  const input = project("snapshot");
  const file = new File(["CAD"], "plate.dxf");
  const filesByPartId = { one: file };
  saveCalculatorHandoff(input, filesByPartId);
  const first = readCalculatorHandoff(input.id)!;
  first.files.length = 0;
  first.summary = "changed";
  input.parts[0].configuration.quantity = 999;
  filesByPartId.one = new File(["replacement"], "changed.dxf");

  const second = readCalculatorHandoff(input.id)!;
  assert.deepEqual(second.files, [file]);
  assert.ok(second.summary.includes("количество: 10 шт."));
  clearCalculatorHandoff(input.id);
});

test("handoffs are isolated by project and clearing one leaves the other intact", () => {
  const first = project("project-one");
  const second = project("project-two");
  saveCalculatorHandoff(first, {});
  saveCalculatorHandoff(second, {});
  assert.equal(readCalculatorHandoff("new-tab-or-unknown-project"), null);
  clearCalculatorHandoff(first.id);
  assert.equal(readCalculatorHandoff(first.id), null);
  assert.ok(readCalculatorHandoff(second.id));
  clearCalculatorHandoff(second.id);
});

test("handoff expires after 30 minutes and reading does not extend it", (context) => {
  let now = 1000;
  context.mock.method(Date, "now", () => now);
  const input = project("expiry");
  saveCalculatorHandoff(input, { one: new File(["CAD"], "plate.dxf") });
  now += 30 * 60 * 1000 - 1;
  assert.ok(readCalculatorHandoff(input.id));
  now += 1;
  assert.equal(readCalculatorHandoff(input.id), null);
});

test("saving again replaces old settings and refreshes the expiry", (context) => {
  let now = 1000;
  context.mock.method(Date, "now", () => now);
  const input = project("resave");
  saveCalculatorHandoff(input, {});
  now += 20 * 60 * 1000;
  input.parts[0].configuration.quantity = 20;
  saveCalculatorHandoff(input, {});
  now += 20 * 60 * 1000;
  assert.ok(readCalculatorHandoff(input.id)?.summary.includes("количество: 20 шт."));
  clearCalculatorHandoff(input.id);
});

test("missing attachments are explicit and filename line breaks cannot add summary fields", () => {
  const input = project("missing");
  input.parts[0].fileName = "plate\nfile.dxf";
  saveCalculatorHandoff(input, {});
  const result = readCalculatorHandoff(input.id)!;
  assert.deepEqual(result.files, []);
  assert.ok(result.summary.startsWith("1. Файл: plate file.dxf\n"));
  assert.ok(result.summary.includes("CAD-файл необходимо приложить повторно."));
  clearCalculatorHandoff(input.id);
});

test("only inputs for selected operations are copied, with all customer input kinds supported", () => {
  const input = project("operation-inputs");
  input.parts[0].configuration.operations = ["welding", "assembly", "surface-preparation"];
  input.parts[0].configuration.operationInputs = {
    bendCount: 999,
    powderSides: 2,
    weldLengthM: 1.5,
    assemblyMinutes: 12,
    surfacePreparationSides: 1,
  };
  saveCalculatorHandoff(input, {});
  const result = readCalculatorHandoff(input.id)!;
  assert.ok(result.summary.includes("Параметры операций: длина сварки — 1,5 м; сборка — 12 мин; сторон подготовки поверхности — 1."));
  assert.equal(result.summary.includes("гибов"), false);
  assert.equal(result.summary.includes("сторон окраски"), false);
  clearCalculatorHandoff(input.id);
});
