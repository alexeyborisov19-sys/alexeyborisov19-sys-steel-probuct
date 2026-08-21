import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const catalogPath = new URL("../public/documents/katalog-fasadnyh-resheniy-stal-produkt.pdf", import.meta.url);
const conversionActionsPath = new URL("../components/ConversionActions.tsx", import.meta.url);

test("the current full catalog is published through the primary download action", async () => {
  const [catalog, catalogStat, conversionActions] = await Promise.all([
    readFile(catalogPath),
    stat(catalogPath),
    readFile(conversionActionsPath, "utf8"),
  ]);

  assert.equal(catalog.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(catalog.length > 5_000_000, "the full catalog asset looks unexpectedly small");
  assert.equal(catalogStat.mode & 0o111, 0, "the public catalog must not be executable");
  assert.match(conversionActions, /актуальный каталог/);
  assert.match(conversionActions, /href: "\/documents\/katalog-fasadnyh-resheniy-stal-produkt\.pdf"/);
});
