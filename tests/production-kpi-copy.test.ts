import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const productionPage = new URL("../app/(public)/production/page.tsx", import.meta.url);

test("production KPI strip keeps only strong client-facing proof points", async () => {
  const source = await readFile(productionPage, "utf8");

  assert.match(source, /lg:grid-cols-4/);
  assert.match(source, /\["По КД \/ ТЗ", "от единичной детали до серии"\]/);
  assert.doesNotMatch(source, /\["Давальческое", "сырьё после входного контроля"\]/);
});
