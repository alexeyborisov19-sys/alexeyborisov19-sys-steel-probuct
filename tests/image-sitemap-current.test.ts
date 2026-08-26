import assert from "node:assert/strict";
import test from "node:test";
import { GET as getImageSitemap } from "@/app/sitemap-images.xml/route";

test("image sitemap uses the current Google image sitemap vocabulary", async () => {
  const response = getImageSitemap();
  assert.equal(response.status, 200);

  const xml = await response.text();
  assert.match(xml, /<image:image>/);
  assert.match(xml, /<image:loc>https:\/\/www\.steelprodukt\.ru\//);
  assert.doesNotMatch(xml, /<image:(?:caption|title|geo_location|license)>/);
});
