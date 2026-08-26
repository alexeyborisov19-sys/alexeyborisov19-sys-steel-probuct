import assert from "node:assert/strict";
import test from "node:test";
import sitemap from "@/app/sitemap";

const expectedFreshness = new Map([
  ["https://www.steelprodukt.ru/company", Date.parse("2026-08-25T15:10:21.000Z")],
  ["https://www.steelprodukt.ru/contacts", Date.parse("2026-08-25T17:32:36.000Z")],
  ["https://www.steelprodukt.ru/production", Date.parse("2026-08-25T21:24:08.000Z")],
  ["https://www.steelprodukt.ru/production/proektirovanie-metalloizdeliy", Date.parse("2026-08-25T20:45:11.000Z")],
  ["https://www.steelprodukt.ru/solutions/climate", Date.parse("2026-08-25T14:09:18.000Z")],
  ["https://www.steelprodukt.ru/industries", Date.parse("2026-08-20T14:44:10.000Z")],
  ["https://www.steelprodukt.ru/industries/zhilye-kompleksy", Date.parse("2026-08-25T15:10:21.000Z")],
  ["https://www.steelprodukt.ru/projects", Date.parse("2026-08-25T12:06:42.000Z")],
  ["https://www.steelprodukt.ru/products", Date.parse("2026-08-25T15:45:53.000Z")],
  ["https://www.steelprodukt.ru/products/metallokassety-standart", Date.parse("2026-08-25T15:03:23.000Z")],
  ["https://www.steelprodukt.ru/calculator-metallokassety", Date.parse("2026-08-25T13:18:54.000Z")],
  ["https://www.steelprodukt.ru/products/metallokassety", Date.parse("2026-08-25T15:03:23.000Z")],
  ["https://www.steelprodukt.ru/products/dobornye-elementy", Date.parse("2026-08-19T19:17:15.000Z")],
  ["https://www.steelprodukt.ru/legal/privacy", Date.parse("2026-08-13T00:00:00.000Z")],
  ["https://www.steelprodukt.ru/legal/personal-data-consent", Date.parse("2026-08-13T00:00:00.000Z")],
  ["https://www.steelprodukt.ru/legal/services", Date.parse("2026-08-13T00:00:00.000Z")],
]);

test("important sitemap lastmod values follow meaningful page revisions", () => {
  const entries = new Map(sitemap().map((entry) => [entry.url, entry]));

  for (const [url, approvedAt] of expectedFreshness) {
    const entry = entries.get(url);
    assert.ok(entry?.lastModified, `${url}: must have lastModified`);
    assert.ok(
      new Date(entry.lastModified).getTime() >= approvedAt,
      `${url}: sitemap lastmod must not predate the meaningful page revision`,
    );
  }
});
