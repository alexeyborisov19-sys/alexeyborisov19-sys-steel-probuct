import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicCalculatorAssistantDraft } from "../lib/assistant/calculator-draft";

test("assistant opens with a useful draft before any CAD upload", () => {
  const draft = buildPublicCalculatorAssistantDraft({ partCount: 0 });
  assert.match(draft, /не добавлены чертёж или размеры/i);
  assert.match(draft, /не придумывайте/i);
  assert.ok(draft.length <= 1400);
});

test("draft carries only selected public inputs and flags unconfirmed defaults", () => {
  const draft = buildPublicCalculatorAssistantDraft({
    partCount: 2,
    format: "step",
    materialId: "cold",
    materialConfirmed: false,
    thicknessMm: 1.2,
    quantity: 25,
    quantityValid: true,
    operations: ["laser-cutting", "bending", "bending", "powder-coating"],
  });
  assert.match(draft, /STEP/);
  assert.match(draft, /Сталь х\/к/);
  assert.match(draft, /требует подтверждения/i);
  assert.match(draft, /1,2 мм/);
  assert.match(draft, /25 шт/);
  assert.match(draft, /Лазерная резка, Гибка, Порошковая окраска/);
  assert.doesNotMatch(draft, /стоимость:.*₽/i);
});

test("invalid or missing quantity is not sent to the assistant as confirmed", () => {
  const draft = buildPublicCalculatorAssistantDraft({
    partCount: 1,
    materialId: "hot",
    thicknessMm: null,
    quantity: 800,
    quantityValid: false,
  });
  assert.match(draft, /Количество не подтверждено/);
  assert.doesNotMatch(draft, /800 шт/);
  assert.match(draft, /Толщина не указана/);
});

test("filenames, private identifiers and prices are never copied from extra objects", () => {
  const draft = buildPublicCalculatorAssistantDraft({
    partCount: 1,
    format: "dxf",
    materialId: "zinc",
    thicknessMm: 2,
    quantity: 1,
    quantityValid: true,
    fileName: "secret-contract-2026.dxf",
    projectId: "client-account-123",
    totalRub: 992000,
    contact: "private@example.ru",
  } as Parameters<typeof buildPublicCalculatorAssistantDraft>[0]);
  assert.doesNotMatch(draft, /secret-contract|client-account|992000|private@example/);
  assert.ok(draft.length <= 1400);
});
