import assert from "node:assert/strict";
import test from "node:test";
import sitemap from "@/app/sitemap";

const expectedFreshness = new Map([
  ["https://www.steelprodukt.ru/company", Date.parse("2026-08-25T15:10:21.000Z")],
  ["https://www.steelprodukt.ru/contacts", Date.parse("2026-08-25T17:32:36.000Z")],
  ["https://www.steelprodukt.ru/production", Date.parse("2026-08-25T21:24:08.000Z")],
  ["https://www.steelprodukt.ru/products", Date.parse("2026-08-25T15:45:53.000Z")],
]);

test("commercial hub lastmod values follow their latest approved revisions", () => {
  const entries = new Map(sitemap().map((entry) => [entry.url, entry]));

  for (const [url, approvedAt] of expectedFreshness) {
    const entry = entries.get(url);
    assert.ok(entry?.lastModified, `${url}: must have lastModified`);
    assert.ok(
      new Date(entry.lastModified).getTime() >= approvedAt,
      `${url}: sitemap lastmod must not predate the approved page revision`,
    );
  }
});
