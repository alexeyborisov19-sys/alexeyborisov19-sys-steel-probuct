import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("header exposes a keyboard skip action and uses centralized contact data", async () => {
  const source = await read("components/Header.tsx");
  assert.match(source, /Перейти к содержимому/);
  assert.match(source, /document\.querySelector\("main"\)/);
  assert.match(source, /siteConfig\.telephoneDisplay/);
  assert.match(source, /siteConfig\.telephone/);
  assert.doesNotMatch(source, /\+7 910 780 37 23/);
});

test("engineering assistant launcher stays compact on small screens", async () => {
  const source = await read("components/EngineeringAssistantLauncher.tsx");
  assert.match(source, /hidden min-w-\[142px\].*sm:block/);
  assert.match(source, /sm:gap-3/);
});

test("production service pages do not promise an unverified one-day response SLA", async () => {
  const source = await read("app/(public)/production/[slug]/page.tsx");
  assert.doesNotMatch(source, /Подтвердим получение материалов в течение рабочего дня/);
  assert.match(source, /Материалы передаются на инженерную проверку/);
  assert.match(source, /Срок подготовки расчёта/);
});
