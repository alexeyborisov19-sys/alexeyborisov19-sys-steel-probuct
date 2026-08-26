import assert from "node:assert/strict";
import test from "node:test";
import sitemap from "@/app/sitemap";
import { GET as getImageSitemap } from "@/app/sitemap-images.xml/route";

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

test("image sitemap uses the current Google image sitemap vocabulary", async () => {
  const response = getImageSitemap();
  assert.equal(response.status, 200);

  const xml = await response.text();
  assert.match(xml, /<image:image>/);
  assert.match(xml, /<image:loc>https:\/\/www\.steelprodukt\.ru\//);
  assert.doesNotMatch(xml, /<image:(?:caption|title|geo_location|license)>/);
});

test("image sitemap only references unique canonical pages from the main sitemap", async () => {
  const xml = await getImageSitemap().text();
  const pageUrls = [...xml.matchAll(/<url>\s*<loc>(.*?)<\/loc>/gs)].map((match) => decodeXml(match[1].trim()));
  const imageUrls = [...xml.matchAll(/<image:loc>(.*?)<\/image:loc>/g)].map((match) => decodeXml(match[1].trim()));
  const mainUrls = new Set(sitemap().map((entry) => String(entry.url)));

  assert.ok(pageUrls.length > 0, "image sitemap must contain page URLs");
  assert.equal(new Set(pageUrls).size, pageUrls.length, "image sitemap page URLs must be unique");

  for (const pageUrl of pageUrls) {
    assert.match(pageUrl, /^https:\/\/www\.steelprodukt\.ru\//);
    assert.ok(mainUrls.has(pageUrl), `image sitemap page is absent from main sitemap: ${pageUrl}`);
  }

  for (const imageUrl of imageUrls) {
    assert.match(imageUrl, /^https:\/\/www\.steelprodukt\.ru\//);
  }
});
