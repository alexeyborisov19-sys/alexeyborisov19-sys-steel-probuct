import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manufacturingFactsPath = new URL("../data/manufacturing-facts.ts", import.meta.url);
const productionPagePath = new URL("../app/(public)/production/page.tsx", import.meta.url);
const assistantKnowledgePath = new URL("../data/assistant-knowledge.ts", import.meta.url);

test("shot blasting and laser cleaning remain separate confirmed production capabilities", async () => {
  const [facts, productionPage, assistant] = await Promise.all([
    readFile(manufacturingFactsPath, "utf8"),
    readFile(productionPagePath, "utf8"),
    readFile(assistantKnowledgePath, "utf8"),
  ]);

  assert.match(facts, /shotBlastingChambers:\s*1/);
  assert.match(facts, /laserCleaningSystems:\s*1/);

  assert.match(productionPage, /Дробеструйная очистка/);
  assert.match(productionPage, /Лазерная очистка/);

  assert.match(assistant, /Дробеструйная очистка поверхности/);
  assert.match(assistant, /Лазерная очистка поверхности/);
});

test("assistant routes surface-preparation requests before generic laser cutting", async () => {
  const assistant = await readFile(assistantKnowledgePath, "utf8");
  const surfaceBranch = assistant.indexOf(
    'if (includesAny(text, ["лазерная чист", "лазерная очист", "дробест", "очистк поверхности", "подготовк поверхности"]))',
  );
  const laserCuttingBranch = assistant.indexOf(
    'if (includesAny(text, ["лазер", "раскрой", "резк"]))',
  );

  assert.notEqual(surfaceBranch, -1, "surface-preparation routing branch must exist");
  assert.notEqual(laserCuttingBranch, -1, "generic laser-cutting branch must exist");
  assert.ok(surfaceBranch < laserCuttingBranch, "surface-preparation routing must run before generic laser cutting");
});
