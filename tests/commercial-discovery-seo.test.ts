import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sitemap from "@/app/sitemap";
import { GET as getImageSitemap } from "@/app/sitemap-images.xml/route";
import { commercialProductLandings } from "@/data/commercial-product-landings";
import { absoluteUrl } from "@/lib/site";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("products hub includes every commercial landing in its structured catalog and visible navigation", async () => {
  const source = await read("app/(public)/products/page.tsx");

  assert.match(source, /commercialProductLandings/);
  assert.match(source, /catalogStructuredItems/);
  assert.match(source, /\.\.\.commercialProductLandings\.map/);
  assert.match(source, /items: catalogStructuredItems/);

  // The visible list is built from the registry, so every landing is linked by
  // construction. This used to look for each slug as a literal in the source,
  // which passed only while the hub repeated the registry by hand — the exact
  // arrangement that would let a fifth landing be indexed and structured while
  // staying invisible on the hub meant to lead to it.
  assert.match(source, /const commercialDirections = commercialProductLandings\.map/);
  assert.match(source, /href: `\/products\/\$\{landing\.slug\}`/);
  assert.ok(commercialProductLandings.length > 0, "the registry must not be empty");

  // A hand-written link list must not creep back in beside the derived one.
  const hardCoded = source.match(/href: "\/products\/[a-z-]+"/g) ?? [];
  assert.deepEqual(hardCoded, [], `hub must not hard-code landing links: ${hardCoded.join(", ")}`);
});

test("main sitemap derives every commercial product landing from the canonical registry", () => {
  const urls = sitemap().map((entry) => entry.url);

  for (const landing of commercialProductLandings) {
    const url = absoluteUrl(`/products/${landing.slug}`);
    assert.equal(
      urls.filter((candidate) => candidate === url).length,
      1,
      `${landing.slug}: expected exactly one entry in sitemap.xml`,
    );
  }
});

test("image sitemap publishes every commercial product landing exactly once", async () => {
  const response = getImageSitemap();
  assert.equal(response.status, 200);
  const xml = await response.text();

  for (const landing of commercialProductLandings) {
    const pagePath = `/products/${landing.slug}`;
    assert.equal(
      xml.split(pagePath).length - 1,
      1,
      `${landing.slug}: expected exactly one page entry in image sitemap`,
    );
    assert.ok(xml.includes(landing.image), `${landing.slug}: image path missing from image sitemap`);
  }
});
