import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { commercialProductLandings } from "../data/commercial-product-landings";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("basket introduction distinguishes equipment dimensions from basket dimensions", async () => {
  const source = await read("components/commercial/BasketLandingPage.tsx");
  assert.match(source, /размеры наружного блока/);
  assert.match(source, /Знаю размер корзины/);
  assert.doesNotMatch(source, /введите свой наружный габарит/);
  assert.match(source, /imageAlt=\{landing.imageAlt\}/);
  assert.match(source, /\{landing.imageCaption\}/);
});

test("commercial hero images distinguish illustrations from real production photographs", async () => {
  for (const landing of commercialProductLandings) {
    assert.ok(landing.imageAlt, `${landing.slug}: descriptive image alternative required`);
    if (landing.image.startsWith("/images/web/solution-")) {
      assert.match(landing.imageAlt, /Иллюстрация/);
      assert.match(landing.imageCaption ?? "", /Иллюстрация/);
      assert.doesNotMatch(landing.imageAlt, /производство «Сталь Продукт»/);
    } else {
      assert.match(landing.imageAlt, /производств/i);
      assert.equal(landing.imageCaption, undefined, "real workshop photography must not be relabeled");
    }
  }
  const source = await read("components/CommercialProductLandingPage.tsx");
  assert.match(source, /imageAlt=\{landing.imageAlt\}/);
  assert.match(source, /\{landing.imageCaption\}/);
});

test("commercial quote preparation links to detailed drawing and delivery guides", async () => {
  const source = await read("components/CommercialProductLandingPage.tsx");
  for (const path of ["/customers/requirements", "/customers/order-and-delivery"]) {
    assert.ok(source.includes(`href="${path}"`), `${path}: contextual guide link missing`);
  }
});
