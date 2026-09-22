import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { InstantQuoteProject } from "../lib/instant-quote/domain";
import { buildProductionOrderFromProject, groupProductionOrderRoutes, productionOrderVisibleSections } from "../lib/production-order/build-production-order";
import { buildOrderFolderName, loadOrderStorageRoot, planProductionOrderPackage, safeWindowsPathSegment } from "../lib/server/production-order/storage";
import {
  loadConfiguredOrderStorageRootSync,
  productionOrderSettingsFile,
  readProductionOrderStorageSettings,
  saveProductionOrderStorageSettings,
} from "../lib/server/production-order/storage-settings";
import { loadProductionOrderBitrixConfig, upsertProductionOrderDeal } from "../lib/server/production-order/bitrix-deal";

function project(parts = 1): InstantQuoteProject {
  return {
    id: "project-test",
    title: "Тестовый проект",
    createdAt: "2026-09-22T10:00:00.000Z",
    updatedAt: "2026-09-22T10:00:00.000Z",
    activePartId: "part-1",
    parts: Array.from({ length: parts }, (_, index) => ({
      id: `part-${index + 1}`,
      fileName: `Деталь-${index + 1}.step`,
      format: "step",
      fileSizeBytes: 100,
      createdAt: "2026-09-22T10:00:00.000Z",
      state: "configurable",
      geometry: { widthMm: 100, heightMm: 50, depthMm: 20, bendCount: 2, cutLengthMm: 900 },
      configuration: {
        materialId: "hot",
        thicknessMm: 2,
        quantity: 3,
        operations: ["laser-cutting", "bending"],
      },
      quote: { kind: "not-requested" },
    })),
  };
}

test("builds a deterministic production order and dynamic routes", () => {
  const order = buildProductionOrderFromProject({
    project: project(),
    quoteNumber: "26-1649",
    quoteTitle: "ООО Ромашка - Корпуса",
    customerName: "ООО Ромашка",
    dueDate: "2026-09-30",
    artifacts: [{ id: "cad-1", kind: "cad", fileName: "Деталь-1.step", partId: "part-1" }],
    now: new Date("2026-09-22T12:00:00.000Z"),
  });
  assert.equal(order.orderId, "SP-ORDER-project-test-26-1649");
  assert.equal(order.parts.length, 1);
  assert.equal(order.parts[0]?.materialLabel, "Сталь г/к");
  assert.deepEqual(groupProductionOrderRoutes(order).map((route) => route.label), ["Гибка", "Лазерная резка"]);
  assert.deepEqual(productionOrderVisibleSections(order), { routes: true, coating: false, delivery: false, files: true });
});

test("supports up to 50 parts and rejects the 51st", () => {
  assert.equal(buildProductionOrderFromProject({
    project: project(50),
    quoteNumber: "26-2000",
    quoteTitle: "50 деталей",
    customerName: "Заказчик",
  }).parts.length, 50);

  assert.throws(() => buildProductionOrderFromProject({
    project: project(51),
    quoteNumber: "26-2001",
    quoteTitle: "51 деталь",
    customerName: "Заказчик",
  }), /up to 50 parts/);
});

test("creates a Windows-safe order folder without changing Cyrillic", () => {
  assert.equal(buildOrderFolderName("26-1649", 'ООО "Ромашка" / Корпуса'), "26-1649 ООО Ромашка Корпуса");
  assert.equal(safeWindowsPathSegment("CON"), "_CON");
  const order = buildProductionOrderFromProject({
    project: project(),
    quoteNumber: "26-1649",
    quoteTitle: "ООО Ромашка - Корпуса",
    customerName: "ООО Ромашка",
  });
  const plan = planProductionOrderPackage(order, "/tmp/steelprodukt-orders");
  assert.ok(plan.orderDirectory.endsWith("26-1649 ООО Ромашка - Корпуса"));
  assert.ok(plan.quotePdfPath.endsWith("КП 26-1649.pdf"));
  assert.ok(plan.productionOrderPdfPath.endsWith("Заявка в производство 26-1649.pdf"));
});

test("saved order root survives reload and overrides environment fallback", async (t) => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "steelprodukt-order-settings-"));
  t.after(async () => { await rm(sandbox, { recursive: true, force: true }); });

  const settingsRoot = path.join(sandbox, "private-settings");
  const savedRoot = path.join(sandbox, "orders-saved");
  const environmentRoot = path.join(sandbox, "orders-environment");
  await Promise.all([
    mkdir(savedRoot, { recursive: true }),
    mkdir(environmentRoot, { recursive: true }),
  ]);

  const environment = {
    STEEL_PRODUCT_PRIVATE_SETTINGS_ROOT: settingsRoot,
    STEEL_PRODUCT_ORDER_ROOT: environmentRoot,
  };
  const now = new Date("2026-09-22T19:45:00.000Z");
  const saved = await saveProductionOrderStorageSettings({
    ordersRoot: savedRoot,
    actor: { userId: "user-1", displayName: "Алексей" },
    environment,
    now,
  });

  assert.equal(saved.ordersRoot, path.resolve(savedRoot));
  assert.equal(saved.source, "saved");
  assert.equal(saved.updatedAt, now.toISOString());

  const reloaded = await readProductionOrderStorageSettings(environment);
  assert.equal(reloaded.source, "saved");
  assert.equal(reloaded.ordersRoot, path.resolve(savedRoot));
  assert.equal(reloaded.updatedByDisplayName, "Алексей");
  assert.equal(loadConfiguredOrderStorageRootSync(environment), path.resolve(savedRoot));
  assert.equal(loadOrderStorageRoot(environment), path.resolve(savedRoot));

  const raw = JSON.parse(await readFile(productionOrderSettingsFile(environment), "utf8")) as { ordersRoot?: string };
  assert.equal(raw.ordersRoot, path.resolve(savedRoot));
});

test("Bitrix deal config requires explicit category and stage", () => {
  const config = loadProductionOrderBitrixConfig({
    BITRIX_ORDER_INTEGRATION_ENABLED: "true",
    BITRIX_WEBHOOK_URL: "https://b24-test.bitrix24.ru/rest/1/token",
    BITRIX_ORDER_CATEGORY_ID: "7",
    BITRIX_ORDER_STAGE_ID: "C7:NEW",
  });
  assert.ok(config);
  assert.equal(config?.categoryId, 7);
  assert.equal(config?.stageId, "C7:NEW");
});

test("Bitrix upsert creates once and then updates the same deal", async () => {
  const order = buildProductionOrderFromProject({
    project: project(),
    quoteNumber: "26-1649",
    quoteTitle: "ООО Ромашка - Корпуса",
    customerName: "ООО Ромашка",
    commercialTotalRub: 184500,
  });
  const config = {
    webhookUrl: "https://b24-test.bitrix24.ru/rest/1/token",
    categoryId: 7,
    stageId: "C7:NEW",
    sourceId: "WEB",
    customFieldMap: {},
  };
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  let exists = false;
  const caller = async (method: "crm.deal.list" | "crm.deal.add" | "crm.deal.update", params: Record<string, unknown>) => {
    calls.push({ method, params });
    if (method === "crm.deal.list") return exists ? [{ ID: 321 }] : [];
    if (method === "crm.deal.add") { exists = true; return 321; }
    return true;
  };

  const first = await upsertProductionOrderDeal(config, order, "\\\\SERVER\\Production\\26-1649", caller);
  const second = await upsertProductionOrderDeal(config, order, "\\\\SERVER\\Production\\26-1649", caller);
  assert.deepEqual(first, { dealId: 321, created: true });
  assert.deepEqual(second, { dealId: 321, created: false });
  assert.equal(calls.filter((call) => call.method === "crm.deal.add").length, 1);
  assert.equal(calls.filter((call) => call.method === "crm.deal.update").length, 1);
});
