import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { CALCULATION_DISCLAIMER, materialLabel, operationLabels } from "../lib/instant-quote/client-labels";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the printout is built only from the public client view", async () => {
  const printout = await source("components/instant-quote/ClientQuotePrintout.tsx");

  // It may read the client calculation view and nothing from the private side.
  assert.match(printout, /ClientProjectCalculationView/);
  for (const forbidden of [
    "cutLengthMm",
    "pierceCount",
    "blankAreaMm2",
    "rubPerTon",
    "markupPct",
    "metalMarketUpliftPct",
    "factual",
    "rateBook",
    "private-calculation-basis",
  ]) {
    assert.equal(printout.includes(forbidden), false, `printout leaked ${forbidden}`);
  }
});

test("the printout takes company details from the repository, not from invented text", async () => {
  const printout = await source("components/instant-quote/ClientQuotePrintout.tsx");

  assert.match(printout, /from "@\/lib\/legal"/);
  assert.match(printout, /legalOperator\.inn/);
  assert.match(printout, /legalOperator\.ogrn/);
  // The logo may only come through the shared site config path.
  assert.match(printout, /siteConfig\.logo/);
  assert.equal(printout.includes("6732110789"), false, "registration numbers must not be re-typed");
});

test("the print stylesheet keeps the rest of the page off the sheet", async () => {
  const css = await source("app/globals.css");

  assert.match(css, /@media print/);
  assert.match(css, /\.quote-print-root \{ display: none; \}/);
  assert.match(css, /body \* \{ visibility: hidden !important; \}/);
});

test("customer-facing labels are shared, so the quote cannot disagree with the configurator", () => {
  assert.equal(materialLabel("zinc"), "Оцинкованная сталь");
  assert.equal(materialLabel(null), "—");
  assert.equal(materialLabel("unknown"), "—");
  assert.deepEqual(operationLabels(["laser-cutting", "bending"]), ["Лазерная резка", "Гибка"]);
});

test("the machine calculation is disclaimed wherever a price is shown", async () => {
  const workspace = await source("components/ClientManufacturingWorkspace.tsx");
  const printout = await source("components/instant-quote/ClientQuotePrintout.tsx");

  // Screen and paper must quote the same wording, not two different promises.
  for (const surface of [workspace, printout]) {
    assert.match(surface, /CALCULATION_DISCLAIMER/);
  }
  // Beside the total, in the per-part status, and on the sticky mobile bar.
  assert.ok(
    (workspace.match(/CALCULATION_DISCLAIMER/g) ?? []).length >= 3,
    "the disclaimer must accompany every place the calculator shows a price",
  );
  assert.match(workspace, /href="\/legal\/terms"/);
});

test("the disclaimer says it is automatic, preliminary and not an offer", () => {
  assert.match(CALCULATION_DISCLAIMER, /автоматически/);
  assert.match(CALCULATION_DISCLAIMER, /предварительн/);
  assert.match(CALCULATION_DISCLAIMER, /не является публичной офертой/);
  assert.match(CALCULATION_DISCLAIMER, /инженер/);
});

test("the disclaimer repeats the site's own terms rather than inventing new ones", async () => {
  const terms = await source("app/(public)/legal/terms/page.tsx");
  assert.match(terms, /не является публичной офертой/);
});
