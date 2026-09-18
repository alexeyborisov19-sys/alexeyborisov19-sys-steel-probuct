import assert from "node:assert/strict";
import test from "node:test";
import type { Metadata } from "next";
import { metadata as metalBodiesMetadata } from "@/app/(public)/products/metallicheskie-korpusa/page";
import { metadata as basketsMetadata } from "@/app/(public)/products/korziny-dlya-konditsionerov/page";
import { generateMetadata as generateSolutionMetadata } from "@/app/(public)/solutions/[slug]/page";
import { commercialProductLandingBySlug } from "@/data/commercial-product-landings";
import { solutionDetailBySlug } from "@/data/solution-details";
import { solutionSeoBySlug } from "@/data/solution-seo";
import sitemap from "@/app/sitemap";

function titleOf(metadata: Metadata) {
  return String(metadata.title ?? "");
}

function canonicalOf(metadata: Metadata) {
  return String(metadata.alternates?.canonical ?? "");
}

test("industry solution and metal body product own different primary intents", async () => {
  const industryMetadata = await generateSolutionMetadata({ params: Promise.resolve({ slug: "industry" }) });
  const product = commercialProductLandingBySlug["metallicheskie-korpusa"];
  const solution = solutionSeoBySlug.industry;
  const detail = solutionDetailBySlug.industry;

  assert.match(titleOf(metalBodiesMetadata), /Металлические корпуса.*на заказ/i);
  assert.doesNotMatch(titleOf(industryMetadata), /Металлические корпуса.*на заказ/i);
  assert.match(titleOf(industryMetadata), /Контрактное производство.*промышленности/i);
  assert.match(detail.title, /металлоизделия.*промышленности.*OEM/i);
  assert.match(solution.serviceType ?? "", /Контрактное и OEM-производство/i);
  assert.ok(solution.keywords.some((keyword) => /контрактное производство/i.test(keyword)));

  const productBackLink = product.related.find((item) => item.href === "/solutions/industry");
  const solutionProductLink = solution.related.find((item) => item.href === "/products/metallicheskie-korpusa");
  assert.equal(productBackLink?.label, "Контрактное и OEM-производство для промышленности");
  assert.equal(solutionProductLink?.label, "Металлические корпуса на заказ");
});

test("climate solution and basket product own different primary intents", async () => {
  const climateMetadata = await generateSolutionMetadata({ params: Promise.resolve({ slug: "climate" }) });
  const product = commercialProductLandingBySlug["korziny-dlya-konditsionerov"];
  const solution = solutionSeoBySlug.climate;

  assert.match(titleOf(basketsMetadata), /Корзины для кондиционеров/i);
  assert.doesNotMatch(titleOf(climateMetadata), /^Корзины для кондиционеров/i);
  assert.match(titleOf(climateMetadata), /размещения климатического оборудования/i);
  assert.match(solution.serviceType ?? "", /размещения и защиты климатического оборудования/i);
  assert.ok(solution.keywords.some((keyword) => /размещение климатического оборудования/i.test(keyword)));

  const productBackLink = product.related.find((item) => item.href === "/solutions/climate");
  const solutionProductLink = solution.related.find((item) => item.href === "/products/korziny-dlya-konditsionerov");
  assert.equal(productBackLink?.label, "Комплексные решения для климатического оборудования");
  assert.equal(solutionProductLink?.label, "Фасадные корзины для кондиционеров");
});

test("all four commercial pages keep self canonicals and stay indexable", async () => {
  const industryMetadata = await generateSolutionMetadata({ params: Promise.resolve({ slug: "industry" }) });
  const climateMetadata = await generateSolutionMetadata({ params: Promise.resolve({ slug: "climate" }) });

  const pages: Array<[Metadata, string]> = [
    [industryMetadata, "/solutions/industry"],
    [metalBodiesMetadata, "/products/metallicheskie-korpusa"],
    [climateMetadata, "/solutions/climate"],
    [basketsMetadata, "/products/korziny-dlya-konditsionerov"],
  ];

  for (const [metadata, path] of pages) {
    assert.equal(canonicalOf(metadata), path);
    assert.equal(metadata.robots && typeof metadata.robots === "object" ? metadata.robots.index : undefined, true);
  }

  const urls = new Set(sitemap().map((entry) => entry.url));
  for (const [, path] of pages) {
    assert.ok(urls.has(`https://www.steelprodukt.ru${path}`), `sitemap is missing ${path}`);
  }
});
