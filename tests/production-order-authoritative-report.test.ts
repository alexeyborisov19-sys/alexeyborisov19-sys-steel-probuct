import assert from "node:assert/strict";
import test from "node:test";
import type { InstantQuoteProject } from "../lib/instant-quote/domain";
import { buildProductionOrderFromProject } from "../lib/production-order/build-production-order";
import type { InternalProductionReport } from "../lib/server/instant-quote/private-production-report";
import { rebuildProductionOrderFromReport } from "../lib/server/production-order/order-from-report";

function project(): InstantQuoteProject {
  return {
    id: "project-authoritative",
    title: "Корпус",
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
        quantity: 2,
        operations: ["laser-cutting"],
      },
      quote: { kind: "not-requested" },
    }],
  };
}

function report(): InternalProductionReport {
  return {
    classification: "internal-production-confidential",
    schemaVersion: "1",
    reportId: "report-authoritative",
    projectId: "project-authoritative",
    generatedAt: "2026-09-22T12:00:00.000Z",
    basisVersion: "test",
    calculation: { totalParts: 1 } as InternalProductionReport["calculation"],
    productionParametersByPartId: {},
    internalNotes: [
      "CAD 1: quarantine request CALC-12345678-ABC, storage 12345678-1234-4123-8123-123456789abc.step, format step, antivirus clean.",
    ],
    calculationInputSnapshot: {
      project: project(),
      factualByPartId: {},
      powderSidesByPartId: {},
      unsupportedEntitiesByPartId: {},
    },
    quoteControl: {
      signals: [{ partId: "part-1", status: "ready", approvedSalePriceRub: 125000 }],
    },
  } as unknown as InternalProductionReport;
}

function requestedOrder() {
  return buildProductionOrderFromProject({
    project: project(),
    quoteNumber: "26-1649",
    quoteTitle: "Корпус",
    customerName: "ООО Ромашка",
    now: new Date("2026-09-22T12:30:00.000Z"),
  });
}

test("server restores manufacturing, price and file source from report", () => {
  const requested = requestedOrder();
  const tampered = {
    ...requested,
    parts: [{
      ...requested.parts[0],
      name: "Корпус лицевой",
      workshopNote: "Беречь поверхность",
      materialId: "titanium",
      materialLabel: "Титан",
      operations: [],
      commercial: { totalRub: 1, status: "approved" as const },
    }],
    artifacts: [],
    commercial: { totalRub: 1, currency: "RUB" as const, status: "approved" as const },
  };

  const rebuilt = rebuildProductionOrderFromReport(report(), tampered);
  assert.equal(rebuilt.parts[0]?.name, "Корпус лицевой");
  assert.equal(rebuilt.parts[0]?.workshopNote, "Беречь поверхность");
  assert.equal(rebuilt.parts[0]?.materialId, "hot");
  assert.equal(rebuilt.parts[0]?.materialLabel, "Сталь г/к");
  assert.deepEqual(rebuilt.parts[0]?.operations.map((operation) => operation.code), ["laser-cutting"]);
  assert.deepEqual(rebuilt.parts[0]?.commercial, { totalRub: 125000, status: "approved" });
  assert.equal(rebuilt.commercial.totalRub, 125000);
  assert.equal(rebuilt.artifacts[0]?.source?.requestId, "CALC-12345678-ABC");
});

test("quantity change invalidates the commercial price", () => {
  const requested = requestedOrder();
  const changed = {
    ...requested,
    parts: [{ ...requested.parts[0], quantity: 3 }],
  };
  const rebuilt = rebuildProductionOrderFromReport(report(), changed);
  assert.deepEqual(rebuilt.parts[0]?.commercial, { totalRub: null, status: "unavailable" });
  assert.equal(rebuilt.commercial.totalRub, null);
  assert.equal(rebuilt.commercial.status, "unavailable");
});
