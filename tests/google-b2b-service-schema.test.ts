import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { products } from "../data/products";
import { commercialProductLandings } from "../data/commercial-product-landings";
import { serviceSchema } from "../lib/schema";
import { absoluteUrl, siteConfig } from "../lib/site";

const individualProducts = products.map((product) => ({
  slug: product.slug,
  name: product.title,
  description: product.lead,
}));
const commercialProducts = commercialProductLandings.map((landing) => ({
  slug: landing.slug,
  name: landing.title,
  description: landing.description,
}));
const madeToOrderPages = [...individualProducts, ...commercialProducts];

test("all thirteen made-to-order catalogue pages have truthful manufacturing Service metadata", () => {
  assert.equal(individualProducts.length, 9);
  assert.equal(commercialProducts.length, 4);
  assert.equal(madeToOrderPages.length, 13);
  assert.equal(new Set(madeToOrderPages.map((x) => x.slug)).size, 13);

  for (const page of madeToOrderPages) {
    const path = `/products/${page.slug}`;
    const service = serviceSchema({
      name: page.name,
      description: page.description,
      path,
      serviceType: "Изготовление металлоизделий по чертежам на заказ",
    });
    assert.equal(service["@type"], "Service", path);
    assert.equal(service.name, page.name, path);
    assert.equal(service.description, page.description, path);
    assert.equal(service.url, absoluteUrl(path), path);
    assert.equal(service["@id"], `${absoluteUrl(path)}#service`, path);
    assert.deepEqual(service.provider, { "@id": `${siteConfig.url}/#organization` }, path);
    assert.ok(service.areaServed, path);
    assert.ok(service.availableChannel, path);
    for (const unsupported of ["offers", "review", "aggregateRating", "price", "priceSpecification"]) {
      assert.equal(Object.hasOwn(service, unsupported), false, `${path}: ${unsupported} must not be invented`);
    }
  }
});

test("Google product snippet warning is not reintroduced by catalogue page renderers", () => {
  const standardProductPage = readFileSync("app/(public)/products/[slug]/page.tsx", "utf8");
  const newerLandingPage = readFileSync("components/CommercialProductLandingPage.tsx", "utf8");
  const seoAudit = readFileSync("scripts/audit-seo.mjs", "utf8");

  assert.match(standardProductPage, /serviceSchema\(\{/);
  assert.doesNotMatch(standardProductPage, /productSchema\(product\)/);
  assert.match(newerLandingPage, /serviceSchema\(\{/);
  assert.doesNotMatch(newerLandingPage, /"@type": "Product"/);
  assert.match(seoAudit, /expected\.push\("Service", "FAQPage"\)/);
  assert.match(seoAudit, /types\.has\("Product"\)/);
  assert.match(seoAudit, /eligibilityLimitations\.length\) process\.exitCode = 1/);
});
