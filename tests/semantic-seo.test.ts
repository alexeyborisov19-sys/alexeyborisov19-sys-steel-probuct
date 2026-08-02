import assert from "node:assert/strict";
import test from "node:test";
import { getArticleCommercialLinks } from "@/components/ArticleCommercialLinks";
import { buildKnowledgeFallback } from "@/data/assistant-knowledge";
import { articles } from "@/data/articles";
import { industrySeoBySlug } from "@/data/industry-seo";
import { productionServices } from "@/data/production-services";
import { productSeoBySlug } from "@/data/product-seo";
import { solutionDetails } from "@/data/solution-details";
import { solutionSeoBySlug } from "@/data/solution-seo";

function assertUnique(values: string[], label: string) {
  assert.equal(new Set(values).size, values.length, `${label}: обнаружены дубли`);
}

test("production pages have distinct intent metadata and useful FAQ", () => {
  assertUnique(productionServices.map((service) => service.seoTitle ?? service.title), "production titles");
  assertUnique(productionServices.map((service) => service.description), "production descriptions");

  for (const service of productionServices) {
    assert.ok(service.keywords.length >= 5, `${service.slug}: мало семантических фраз`);
    assert.ok(service.faq.length >= 4, `${service.slug}: FAQ должен отвечать минимум на четыре вопроса`);
    assert.ok(service.related.length >= 3, `${service.slug}: недостаточная внутренняя перелинковка`);
  }
});

test("laser cutting page publishes the confirmed 40 mm capability without an unconditional promise", () => {
  const laserCutting = productionServices.find((service) => service.slug === "lazernaya-rezka-metalla");

  assert.ok(laserCutting);
  assert.match(`${laserCutting.description} ${laserCutting.lead}`, /до 40 мм/);
  assert.match(laserCutting.lead, /чёрной стали/);
  assert.ok(laserCutting.faq.some((item) => /максимальная толщина/i.test(item.question) && /чёрной стали.*до 40 мм/.test(item.answer)));
  assert.match(buildKnowledgeFallback("Какая максимальная толщина лазерной резки?"), /чёрной стали.*до 40 мм/);
});

test("every solution has its own commercial intent, FAQ and related links", () => {
  const entries = solutionDetails.map((solution) => solutionSeoBySlug[solution.slug]);

  assert.ok(entries.every(Boolean), "не для всех решений задан SEO-контент");
  assertUnique(entries.map((entry) => entry.seoTitle), "solution titles");
  assertUnique(entries.map((entry) => entry.metaDescription), "solution descriptions");

  for (const entry of entries) {
    assert.ok(entry.keywords.length >= 6);
    assert.ok(entry.faq.length >= 4);
    assert.ok(entry.related.length >= 3);
  }
});

test("product and industry landing pages keep unique intent metadata", () => {
  const products = Object.values(productSeoBySlug);
  const industries = Object.values(industrySeoBySlug);

  assertUnique(products.map((entry) => entry.seoTitle), "product titles");
  assertUnique(products.map((entry) => entry.metaDescription), "product descriptions");
  assertUnique(industries.map((entry) => entry.seoTitle), "industry titles");
  assertUnique(industries.map((entry) => entry.metaDescription), "industry descriptions");

  for (const entry of [...products, ...industries]) {
    assert.ok(entry.faq.length >= 3);
    assert.ok(entry.keywords.length >= 5);
  }
});

test("every editorial article links to several commercial next steps", () => {
  for (const article of articles) {
    const links = getArticleCommercialLinks(article);
    assert.equal(links.length, 3, `${article.slug}: ожидается три релевантные ссылки`);
    assertUnique(links.map((link) => link.href), `${article.slug} links`);
    assert.ok(links.every((link) => link.href.startsWith("/")));
  }
});
