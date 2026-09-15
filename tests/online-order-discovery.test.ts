import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the calculator is reachable from the pages that lead to it", async () => {
  const entryPoints: Array<[string, RegExp]> = [
    ["app/(public)/page.tsx", /<CadCalculatorShowcase \/>/],
    ["components/CadCalculatorShowcase.tsx", /href="\/online-order"/],
    ["components/MegaMenu.tsx", /href:\s*"\/online-order"/],
    ["components/Header.tsx", /href="\/online-order"/],
    ["components/ArticleCommercialLinks.tsx", /href:\s*"\/online-order"/],
    ["components/ProductPricingFactors.tsx", /href="\/online-order"/],
    ["app/llms.txt/route.ts", /\/online-order/],
    ["app/sitemap.ts", /"\/online-order"/],
  ];

  for (const [path, pattern] of entryPoints) {
    assert.match(await source(path), pattern, `${path} does not link to the calculator`);
  }
});

test("the article links offer the calculator on both engineering directions", async () => {
  const links = await source("components/ArticleCommercialLinks.tsx");
  assert.equal(
    (links.match(/href:\s*"\/online-order"/g) ?? []).length,
    2,
    "the calculator belongs in metalworking and engineering-practice",
  );
  // The cassette calculator keeps its own place.
  assert.match(links, /href:\s*"\/calculator-metallokassety"/);
});

test("the calculator page carries FAQ structured data and the text behind it", async () => {
  const page = await source("app/(public)/online-order/page.tsx");

  assert.match(page, /faqSchema\(/);
  assert.match(page, /WebApplication/);
  // A schema that describes questions the page does not show is a false signal.
  assert.match(page, /faqItems\.map\(/);
  assert.ok((page.match(/question:/g) ?? []).length >= 5, "too few questions to be worth marking up");

  for (const phrase of ["Как считает калькулятор", "Частые вопросы"]) {
    assert.ok(page.includes(phrase), `the page is missing the "${phrase}" section`);
  }
});

test("the calculator page links onward into production instead of being a cul-de-sac", async () => {
  const page = await source("app/(public)/online-order/page.tsx");
  for (const href of [
    "/production/lazernaya-rezka-metalla",
    "/production/gibka-listovogo-metalla",
    "/production",
    "/contacts#contact-form",
  ]) {
    assert.ok(page.includes(href), `no onward link to ${href}`);
  }
});

test("the showcase animates without overriding a reduced-motion preference", async () => {
  const showcase = await source("components/CadCalculatorShowcase.tsx");

  assert.match(showcase, /useReducedMotion/);
  assert.match(showcase, /reduceMotion \?/);
  // Decorative motion must be hidden from assistive technology.
  assert.match(showcase, /aria-hidden="true"/);
  assert.match(showcase, /aria-labelledby="cad-calculator-title"/);
});
