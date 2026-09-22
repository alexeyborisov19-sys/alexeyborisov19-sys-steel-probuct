import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { InstantQuoteProject } from "../lib/instant-quote/domain";
import { buildProductionOrderFromProject } from "../lib/production-order/build-production-order";
import { productionOrderArtifactsFromReport } from "../lib/server/production-order/calculation-adapter";
import { resolveProductionOrderArtifactSources } from "../lib/server/production-order/source-artifacts";
import type { InternalProductionReport } from "../lib/server/instant-quote/private-production-report";

function project(): InstantQuoteProject {
  return {
    id: "project-artifact",
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
        quantity: 1,
        operations: ["laser-cutting"],
      },
      quote: { kind: "not-requested" },
    }],
  };
}

test("recovers protected CAD references from calculation report notes", () => {
  const report = {
    internalNotes: [
      "CAD 1: quarantine request CALC-12345678-ABC, storage 12345678-1234-4123-8123-123456789abc.step, format step, antivirus clean.",
    ],
    calculationInputSnapshot: { project: project() },
  } as unknown as InternalProductionReport;

  assert.deepEqual(productionOrderArtifactsFromReport(report), [{
    id: "cad:part-1",
    kind: "cad",
    fileName: "Корпус.step",
    partId: "part-1",
    source: {
      kind: "quarantine",
      requestId: "CALC-12345678-ABC",
      storageId: "12345678-1234-4123-8123-123456789abc.step",
      extension: "step",
    },
  }]);
});

test("resolves only files inside the configured quarantine", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "steelprodukt-quarantine-"));
  const requestId = "CALC-12345678-ABC";
  const storageId = "12345678-1234-4123-8123-123456789abc.step";
  try {
    const requestDirectory = path.join(root, requestId);
    await mkdir(requestDirectory, { recursive: true });
    const sourcePath = path.join(requestDirectory, storageId);
    await writeFile(sourcePath, "ISO-10303-21;", "utf8");

    const order = buildProductionOrderFromProject({
      project: project(),
      quoteNumber: "26-1649",
      quoteTitle: "Корпус",
      customerName: "ООО Ромашка",
      artifacts: [{
        id: "cad:part-1",
        kind: "cad",
        fileName: "Корпус.step",
        partId: "part-1",
        source: { kind: "quarantine", requestId, storageId, extension: "step" },
      }],
    });

    const sources = await resolveProductionOrderArtifactSources(order, { UPLOAD_QUARANTINE_PATH: root });
    assert.deepEqual(sources, [{ artifactId: "cad:part-1", sourcePath }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
