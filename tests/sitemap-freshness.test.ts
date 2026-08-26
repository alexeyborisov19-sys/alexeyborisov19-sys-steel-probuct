import assert from "node:assert/strict";
import test from "node:test";
import sitemap from "@/app/sitemap";

const productionApprovedAt = Date.parse("2026-08-25T21:24:08.000Z");

test("production hub lastmod follows the latest approved production-page revision", () => {
  const production = sitemap().find((entry) => entry.url === "https://www.steelprodukt.ru/production");

  assert.ok(production?.lastModified, "production hub must have lastModified");
  assert.ok(
    new Date(production.lastModified).getTime() >= productionApprovedAt,
    "production sitemap lastmod must not predate the approved production-page revision",
  );
});
