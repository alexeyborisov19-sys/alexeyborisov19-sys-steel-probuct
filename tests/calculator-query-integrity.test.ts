import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const calculatorPath = new URL("../components/MetalCassetteCalculator.tsx", import.meta.url);
const quoteFormPath = new URL("../components/QuoteRequestForm.tsx", import.meta.url);

test("calculator handoff cannot reintroduce an unverified price through the URL", async () => {
  const [calculator, quoteForm] = await Promise.all([
    readFile(calculatorPath, "utf8"),
    readFile(quoteFormPath, "utf8"),
  ]);

  assert.match(calculator, /quantity: String\(result\.quantity\)/);
  assert.doesNotMatch(calculator, /estimate\s*:/);
  assert.doesNotMatch(quoteForm, /params\.get\("estimate"\)/);
  assert.doesNotMatch(quoteForm, /Ориентировочная стоимость по калькулятору/);
  assert.match(quoteForm, /Ориентировочное количество по калькулятору/);
});
