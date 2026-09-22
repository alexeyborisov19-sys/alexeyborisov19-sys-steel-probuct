import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { InstantQuoteProject } from "../lib/instant-quote/domain";
import { buildProductionOrderFromProject } from "../lib/production-order/build-production-order";
import { parseProductionOrder } from "../lib/production-order/parse-production-order";
import {
  createOrUpdateProductionOrderPackage,
  ProductionOrderPackageConflictError,
} from "../lib/server/production-order/package-service";

function project(id = "project-package"): InstantQuoteProject {
  return {
    id,
    title: "Корпуса",
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
      geometry: { widthMm: 200, heightMm: 100, depthMm: 50 },
      configuration: {
        materialId: "hot",
        thicknessMm: 2,
        quantity: 10,
        operations: ["laser-cutting", "bending"],
      },
      quote: { kind: "not-requested" },
    }],
  };
}

function order(projectId = "project-package") {
  return buildProductionOrderFromProject({
    project: project(projectId),
    quoteNumber: "26-1649",
    quoteTitle: "ООО Ромашка - Корпуса",
    customerName: "ООО Ромашка",
    responsible: "Алексей",
    artifacts: [{ id: "cad:part-1", kind: "cad", fileName: "Корпус.step", partId: "part-1" }],
    now: new Date("2026-09-22T12:00:00.000Z"),
  });
}

test("package creation is idempotent and updates the same order", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "steelprodukt-order-"));
  try {
    const initial = order();
    const first = await createOrUpdateProductionOrderPackage(initial, root);
    assert.equal(first.created, true);
    assert.equal(first.changed, true);

    const second = await createOrUpdateProductionOrderPackage(initial, root);
    assert.equal(second.created, false);
    assert.equal(second.changed, false);

    const updated = { ...initial, responsible: "Новый ответственный" };
    const third = await createOrUpdateProductionOrderPackage(updated, root);
    assert.equal(third.created, false);
    assert.equal(third.changed, true);

    const stored = parseProductionOrder(JSON.parse(await readFile(third.plan.manifestPath, "utf8")) as unknown);
    assert.equal(stored.responsible, "Новый ответственный");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("package creation rejects another order in the same folder", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "steelprodukt-order-conflict-"));
  try {
    await createOrUpdateProductionOrderPackage(order("project-one"), root);
    await assert.rejects(
      () => createOrUpdateProductionOrderPackage(order("project-two"), root),
      ProductionOrderPackageConflictError,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("production order parser rejects path traversal in artifact names", () => {
  const value = order();
  const unsafe = {
    ...value,
    artifacts: [{ ...value.artifacts[0], fileName: "../Корпус.step" }],
  };
  assert.throws(() => parseProductionOrder(unsafe), /Invalid artifacts\[0\]\.fileName/);
});
