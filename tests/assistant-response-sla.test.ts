import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const assistantPath = new URL("../components/EngineeringAssistant.tsx", import.meta.url);

test("assistant lead form does not promise an unverified response-time SLA", async () => {
  const source = await readFile(assistantPath, "utf8");

  assert.doesNotMatch(source, /в течение рабочего дня/i);
  assert.match(source, /Получение материалов и срок подготовки расчёта подтвердим после проверки документации\./);
});
