import assert from "node:assert/strict";
import test from "node:test";
import type { InstantQuoteProject } from "../lib/instant-quote/domain";
import { buildProductionOrderFromProject } from "../lib/production-order/build-production-order";
import {
  renderCommercialQuoteHtml,
  renderProductionOrderHtml,
} from "../lib/server/production-order/pdf-documents";

function project(): InstantQuoteProject {
  return {
    id: "project-pdf",
    title: "Корпус <серия>",
    createdAt: "2026-09-22T10:00:00.000Z",
    updatedAt: "2026-09-22T10:00:00.000Z",
    activePartId: "part-1",
    parts: [{
      id: "part-1",
      fileName: "Корпус.step",
      format: "step",
      fileSizeBytes: 100,
      createdAt: "2026-09-22T10:00:00.000Z",
      state: "configurable",
      geometry: { widthMm: 100, heightMm: 50, depthMm: 20 },
      configuration: {
        materialId: "hot",
        thicknessMm: 2,
        quantity: 3,
        operations: ["laser-cutting", "bending"],
      },
      quote: { kind: "not-requested" },
    }],
  };
}

function order() {
  return buildProductionOrderFromProject({
    project: project(),
    quoteNumber: "26-1649",
    quoteTitle: "Корпус <серия>",
    customerName: "ООО <Ромашка>",
    dueDate: "2026-09-30",
    commercialByPartId: {
      "part-1": { totalRub: 125000, status: "approved" },
    },
    artifacts: [{ id: "cad:part-1", kind: "cad", fileName: "Корпус.step", partId: "part-1" }],
    productionNote: "Не царапать лицевую поверхность.",
    now: new Date("2026-09-22T12:00:00.000Z"),
  });
}

test("commercial quote HTML contains price and escapes user text", () => {
  const result = renderCommercialQuoteHtml(order());
  assert.match(result, /КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № 26-1649/);
  assert.match(result, /125[\s ]?000 ₽/);
  assert.match(result, /ООО &lt;Ромашка&gt;/);
  assert.doesNotMatch(result, /ООО <Ромашка>/);
});

test("production order HTML contains workshop-only sections", () => {
  const result = renderProductionOrderHtml(order());
  assert.match(result, /ЗАЯВКА В ПРОИЗВОДСТВО № 26-1649/);
  assert.match(result, /Маршрут производства/);
  assert.match(result, /Не царапать лицевую поверхность/);
  assert.match(result, /Корпус\.step/);
});
