import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  loadConfiguredOrderStorageRootSync,
  readProductionOrderStorageSettings,
  saveProductionOrderStorageSettings,
  verifyProductionOrderRootWritable,
} from "../lib/server/production-order/storage-settings";
import { loadOrderStorageRoot } from "../lib/server/production-order/storage";
import { nativeFolderPickerSupported } from "../lib/server/production-order/native-folder-picker";

test("saves the selected order root and restores it after restart", async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "steelprodukt-storage-settings-"));
  try {
    const settingsRoot = path.join(sandbox, "settings");
    const ordersRoot = path.join(sandbox, "orders");
    await mkdir(ordersRoot, { recursive: true });
    const environment = { STEEL_PRODUCT_PRIVATE_SETTINGS_ROOT: settingsRoot };

    const initial = await readProductionOrderStorageSettings(environment);
    assert.equal(initial.source, "unset");
    assert.equal(initial.ordersRoot, null);

    const saved = await saveProductionOrderStorageSettings({
      ordersRoot,
      actor: { userId: "user-1", displayName: "Алексей" },
      environment,
      now: new Date("2026-09-22T20:00:00.000Z"),
    });
    assert.equal(saved.source, "saved");
    assert.equal(saved.ordersRoot, path.resolve(ordersRoot));

    const restored = await readProductionOrderStorageSettings(environment);
    assert.equal(restored.source, "saved");
    assert.equal(restored.ordersRoot, path.resolve(ordersRoot));
    assert.equal(restored.updatedByDisplayName, "Алексей");
    assert.equal(loadConfiguredOrderStorageRootSync(environment), path.resolve(ordersRoot));
    assert.equal(loadOrderStorageRoot(environment), path.resolve(ordersRoot));
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("saved path wins over the environment fallback", async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "steelprodukt-storage-precedence-"));
  try {
    const savedRoot = path.join(sandbox, "saved-orders");
    const environmentRoot = path.join(sandbox, "environment-orders");
    await Promise.all([mkdir(savedRoot), mkdir(environmentRoot)]);
    const environment = {
      STEEL_PRODUCT_PRIVATE_SETTINGS_ROOT: path.join(sandbox, "settings"),
      STEEL_PRODUCT_ORDER_ROOT: environmentRoot,
    };
    await saveProductionOrderStorageSettings({
      ordersRoot: savedRoot,
      actor: { userId: "user-1", displayName: "Алексей" },
      environment,
    });
    assert.equal(loadConfiguredOrderStorageRootSync(environment), path.resolve(savedRoot));
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("rejects files and missing directories as order roots", async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "steelprodukt-storage-validation-"));
  try {
    const filePath = path.join(sandbox, "not-a-directory.txt");
    await writeFile(filePath, "x");
    await assert.rejects(() => verifyProductionOrderRootWritable(filePath), /не является папкой/);
    await assert.rejects(() => verifyProductionOrderRootWritable(path.join(sandbox, "missing")), /не найдена/);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("native folder picker reports supported desktop platforms", () => {
  assert.equal(nativeFolderPickerSupported("darwin"), true);
  assert.equal(nativeFolderPickerSupported("win32"), true);
  assert.equal(nativeFolderPickerSupported("linux"), true);
  assert.equal(nativeFolderPickerSupported("aix"), false);
});
