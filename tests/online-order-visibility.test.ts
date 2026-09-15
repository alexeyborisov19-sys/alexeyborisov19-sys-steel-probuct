import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the metal-products calculator is reachable from the site chrome", async () => {
  const megaMenu = await source("components/MegaMenu.tsx");
  const header = await source("components/Header.tsx");

  assert.match(megaMenu, /href:\s*"\/online-order"/);
  assert.match(header, /href="\/online-order"/);

  // The cassette calculator must keep its own entry point untouched.
  assert.match(megaMenu, /href:\s*"\/calculator-metallokassety"/);
});

test("the calculator page renders inside the site layout, so it is not a dead end", async () => {
  const page = await source("app/(public)/online-order/page.tsx");

  assert.match(page, /from\s+["']@\/components\/PageLayout["']/);
  assert.match(page, /<PageLayout/);
  assert.match(page, /<ClientManufacturingWorkspace\s*\/>/);
});

test("/online-order is published in the sitemap next to the other calculator", async () => {
  const sitemap = await source("app/sitemap.ts");

  assert.match(sitemap, /"\/online-order"/);
  assert.match(sitemap, /path === "\/online-order"/);
});

test("the calculator hands the order over to the consent-recording contacts form", async () => {
  const workspace = await source("components/ClientManufacturingWorkspace.tsx");
  const form = await source("components/QuoteRequestForm.tsx");

  // No private order endpoint of its own, and no fabricated submit target.
  assert.match(workspace, /pathname:\s*"\/contacts"/);
  assert.match(workspace, /source:\s*"online-order"/);
  assert.equal(workspace.includes("/api/cad-order"), false);

  // The contacts form understands the handoff.
  assert.match(form, /params\.get\("source"\) === "online-order"/);
});

test("the calculator never carries a client-side price basis", async () => {
  const workspace = await source("components/ClientManufacturingWorkspace.tsx");

  for (const forbidden of ["pricePerT", "markupPct", "metalCoef", "rubPerTon", "cutK", "pierceK"]) {
    assert.equal(workspace.includes(forbidden), false, `calculator leaked ${forbidden}`);
  }
});
