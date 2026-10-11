import assert from "node:assert/strict";
import test from "node:test";
import { productSeoBySlug } from "../data/product-seo";
import { products } from "../data/products";
import { commercialProductLandings } from "../data/commercial-product-landings";
import { productionServices } from "../data/production-services";
import { solutionSeoBySlug } from "../data/solution-seo";
import { readFile } from "node:fs/promises";

type SearchCard = { path: string; title: string; description: string };
const cards: SearchCard[] = [
  ...products.map(p => ({
    path: `/products/${p.slug}`,
    title: productSeoBySlug[p.slug]?.seoTitle ?? p.title,
    description: productSeoBySlug[p.slug]?.metaDescription ?? p.lead,
  })),
  ...commercialProductLandings.map(p => ({
    path: `/products/${p.slug}`,
    title: p.seoTitle,
    description: p.metaDescription,
  })),
  ...productionServices.map(s => ({
    path: `/production/${s.slug}`,
    title: s.seoTitle ?? s.title,
    description: s.description,
  })),
  ...Object.entries(solutionSeoBySlug).map(([slug, data]) => ({
    path: `/solutions/${slug}`,
    title: data.seoTitle,
    description: data.metaDescription,
  })),
];

test("all old and newer commercial pages have unique, specific, nonempty searchable titles and summaries", () => {
  assert.equal(products.length, 9);
  assert.equal(commercialProductLandings.length, 4);
  assert.equal(productionServices.length, 6);
  assert.equal(Object.keys(productSeoBySlug).length, products.length);
  const paths = new Set<string>();
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const card of cards) {
    assert.ok(!paths.has(card.path), `duplicate commercial page: ${card.path}`);
    paths.add(card.path);
    assert.ok(card.title.length >= 20 && card.title.length <= 75, `unhelpful SEO title: ${card.path}`);
    assert.ok(card.description.length >= 80 && card.description.length <= 200, `weak or sprawling description: ${card.path} (${card.description.length} chars)`);
    assert.ok(!titles.has(card.title.toLowerCase()), `duplicate SEO title: ${card.path}`);
    assert.ok(!descriptions.has(card.description.toLowerCase()), `duplicate SEO description: ${card.path}`);
    assert.doesNotMatch(card.description, /гарантируем попадание в ТОП|лучшая цена|100% бесплатно|от 1 ₽|сертифицированная огнестойкость/i);
    titles.add(card.title.toLowerCase());
    descriptions.add(card.description.toLowerCase());
  }
});

test("fire-safety and engineering descriptions do not claim unsupported characteristics", () => {
  const cutoff = products.find(p => p.slug === "pozharnye-otsechki");
  assert.ok(cutoff);
  assert.match(cutoff.description, /утверждённая проектная документация/);
  assert.doesNotMatch(cutoff.description, /локализовать распространение пламени/);
  assert.match(productSeoBySlug["pozharnye-otsechki"].metaDescription, /утверждённым узлам/);
});

test("important commercial local services reflect their actual geo scope in visible and search content", () => {
  for (const slug of ["gibka-listovogo-metalla", "svarka-i-sborka-metalloizdeliy"]) {
    const service = productionServices.find(s => s.slug === slug);
    assert.ok(service);
    assert.equal(service.serviceCity, "Смоленск");
    assert.match(service.seoTitle ?? "", /Смоленск/);
    assert.match(service.description, /Смоленск/);
  }
});

test("commercial search preview intent is not split from on-page metadata and sitemap", async () => {
  const [productRoute, productionRoute, sitemap, calculator] = await Promise.all([
    readFile(new URL("../app/(public)/products/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(public)/production/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/(public)/calculator-metallokassety/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(productRoute, /seo\?\.metaDescription/);
  assert.match(productionRoute, /service\.description/);
  assert.match(sitemap, /\.\.\.commercialProductLandings\.map/);
  assert.match(sitemap, /\.\.\.productionServices\.map/);
  assert.match(calculator, /по площади, стене или числу изделий/);
  assert.match(calculator, /Оценка стоимости по количеству кассет/);
});
