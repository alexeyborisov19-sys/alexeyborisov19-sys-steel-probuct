import assert from "node:assert/strict";
import test from "node:test";
import { getArticleCommercialLinks } from "@/components/ArticleCommercialLinks";
import { buildKnowledgeFallback, steelProductAssistantSystemPrompt } from "@/data/assistant-knowledge";
import { articleQualityRewrites } from "@/data/article-quality-rewrites";
import { articles } from "@/data/articles";
import { industrySeoBySlug } from "@/data/industry-seo";
import {
  customerMaterialSummary,
  laserCuttingCapabilities,
  productionLeadTimeSummary,
  productionOrderConditions,
} from "@/data/manufacturing-facts";
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

test("laser cutting page publishes the confirmed technical range without an unconditional promise", () => {
  const laserCutting = productionServices.find((service) => service.slug === "lazernaya-rezka-metalla");

  assert.ok(laserCutting);
  assert.match(`${laserCutting.description} ${laserCutting.lead}`, /0,5–40 мм/);
  assert.match(laserCutting.lead, /чёрной стали/);
  assert.match(laserCutting.lead, /1500 × 3000 мм/);
  assert.ok(laserCutting.faq.some((item) => /максимальная толщина/i.test(item.question) && /0,5–40 мм.*до 40 мм/.test(item.answer)));
  assert.ok(laserCutting.faq.some((item) => /металла заказчика/i.test(item.question) && /входного контроля/i.test(item.answer)));
  assert.ok(laserCutting.faq.some((item) => /срок лазерной резки/i.test(item.question) && /7–14 дней/i.test(item.answer)));
  assert.deepEqual(
    laserCutting.specifications?.map(({ value }) => value),
    [laserCuttingCapabilities.thicknessRange, laserCuttingCapabilities.tableWorkingArea, productionOrderConditions.typicalLeadTime, "Принимаем"],
  );

  const assistantLaserAnswer = buildKnowledgeFallback("Какая максимальная толщина и размер стола лазерной резки?");
  assert.match(assistantLaserAnswer, /чёрной стали.*0,5–40 мм/);
  assert.match(assistantLaserAnswer, /1500 × 3000 мм/);
});

test("commercial copy keeps confirmed lead time and customer-supplied material conditions consistent", () => {
  assert.match(productionLeadTimeSummary, /7–14 дней/);
  assert.match(productionLeadTimeSummary, /загрузки оборудования/);
  assert.match(customerMaterialSummary, /металлом заказчика/);
  assert.match(customerMaterialSummary, /входного контроля/);
  assert.match(steelProductAssistantSystemPrompt, /7–14 дней/);
  assert.match(steelProductAssistantSystemPrompt, /металлом заказчика/);
  assert.match(buildKnowledgeFallback("Работаете с моим сырьём?"), /входного контроля/);
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

test("drawing production and industrial housings use one strong landing page per intent", () => {
  const custom = solutionSeoBySlug.custom;
  const industry = solutionSeoBySlug.industry;
  const drawingArticle = articles.find((article) => article.slug === "izdeliya-iz-listovogo-metalla-po-chertezham");
  const housingArticle = articles.find((article) => article.slug === "kak-proverit-tehnologichnost-korpusa-iz-listovogo-metalla");

  assert.match(custom.seoTitle, /деталей из листового металла по чертежам/i);
  assert.match(industry.seoTitle, /металлические корпуса.*на заказ/i);
  assert.equal(custom.commercialFacts?.length, 4);
  assert.equal(industry.commercialFacts?.length, 4);
  assert.ok(custom.faq.some((item) => /материалом заказчика/i.test(item.question)));
  assert.ok(industry.faq.some((item) => /срок изготовления/i.test(item.question) && /7–14 дней/.test(item.answer)));
  assert.ok(drawingArticle);
  assert.ok(housingArticle);
  assert.ok(getArticleCommercialLinks(drawingArticle).some((link) => link.href === "/solutions/custom"));
  assert.ok(getArticleCommercialLinks(housingArticle).some((link) => link.href === "/solutions/industry"));
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

test("every editorial article has a practical engineering rewrite", () => {
  assert.equal(articles.length, Object.keys(articleQualityRewrites).length);
  assertUnique(articles.map((article) => article.seoTitle ?? article.title), "article titles");
  assertUnique(articles.map((article) => article.lead), "article leads");

  for (const article of articles) {
    const renderedTitle = `${article.seoTitle ?? article.title} | Сталь Продукт`;

    assert.ok(articleQualityRewrites[article.slug], `${article.slug}: нет полной инженерной редакции`);
    assert.ok(article.modifiedAt >= "2026-08-19", `${article.slug}: не обновлена дата редакции`);
    assert.ok(renderedTitle.length <= 70, `${article.slug}: title длиннее 70 символов`);
    assert.ok((article.metaDescription?.length ?? 0) >= 100, `${article.slug}: meta description слишком короткий`);
    assert.ok((article.metaDescription?.length ?? 0) <= 160, `${article.slug}: meta description длиннее 160 символов`);
    assert.ok((article.keyTakeaways?.length ?? 0) >= 4, `${article.slug}: нет коротких инженерных выводов`);
    assert.ok((article.faq?.length ?? 0) >= 3, `${article.slug}: FAQ не закрывает практические вопросы`);
    assert.ok((article.sources?.length ?? 0) >= 1, `${article.slug}: нет проверяемых источников`);
    assert.ok(article.sections.some((section) => section.table), `${article.slug}: нет таблицы принятия решения`);
    assert.ok(article.sections.some((section) => section.example), `${article.slug}: нет практического разбора`);
    assert.match(article.readingTime, /^(?:[7-9]|1[0-4]) минут$/);

    assertUnique(article.faq?.map((item) => item.question) ?? [], `${article.slug} FAQ`);

    for (const section of article.sections) {
      if (!section.table) continue;
      assert.ok(section.table.columns.length >= 3, `${article.slug}: таблица слишком узкая`);
      assert.ok(section.table.rows.length >= 3, `${article.slug}: таблица не даёт выбора`);
      assert.ok(
        section.table.rows.every((row) => row.length === section.table?.columns.length),
        `${article.slug}: число ячеек не совпадает с заголовками`,
      );
    }
  }
});

test("high-risk engineering topics state their limits instead of promising universal values", () => {
  const tolerances = articles.find((article) => article.slug === "dopustimye-otkloneniya-pri-gibke-listovogo-metalla");
  const thickness = articles.find((article) => article.slug === "kak-vybrat-tolshchinu-listovogo-metalla");

  assert.ok(tolerances);
  assert.ok(thickness);
  assert.match(`${tolerances.lead} ${tolerances.editorNote}`, /не .*универсаль|универсальн.*нет/i);
  assert.ok(tolerances.sources?.some((source) => source.url.includes("iso.org/standard/7748")));
  assert.match(`${thickness.lead} ${thickness.editorNote}`, /не .*универсаль|без ложных универсальных/i);
  assert.ok(thickness.sections.some((section) => /матрица/i.test(section.title) && section.table));
});
