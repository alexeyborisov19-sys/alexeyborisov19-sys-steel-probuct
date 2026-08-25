import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const productionPage = new URL("../app/(public)/production/page.tsx", import.meta.url);

test("production KPI strip keeps the approved client-facing proof points", async () => {
  const source = await readFile(productionPage, "utf8");

  assert.match(source, /lg:grid-cols-4/);
  assert.match(source, /\[laserCuttingCapabilities\.thicknessRange, "Лазерная резка чёрной стали"\]/);
  assert.match(source, /\[laserCuttingCapabilities\.tableWorkingArea, "Формат обрабатываемого листа"\]/);
  assert.match(source, /\["От 1 детали до серии", "Изготовление по КД и ТЗ заказчика"\]/);
  assert.match(source, /\["Полный производственный цикл", "От инженерной подготовки до готовой партии"\]/);
  assert.doesNotMatch(source, /\["Давальческое", "сырьё после входного контроля"\]/);
});
