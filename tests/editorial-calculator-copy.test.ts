import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("public calculation warnings are concise without losing the non-offer and review conditions", async () => {
  const [notice, shared] = await Promise.all([
    source("lib/product-calculation-notice.ts"),
    source("lib/instant-quote/client-labels.ts"),
  ]);

  assert.doesNotMatch(notice, /Предварительный ориентировочный/);
  assert.match(notice, /Расчёт предварительный/);
  assert.match(notice, /инженеру/);
  assert.match(shared, /не является публичной офертой/);
  assert.match(shared, /проверки инженером/);
  assert.match(shared, /коммерческом предложении и договоре/);
  assert.match(shared, /PRODUCT_CALCULATION_NOTICE/);
  assert.match(shared, /Не является офертой/);
});

test("cassette budget and facade grid use consistent understandable labels", async () => {
  const [landing, visual] = await Promise.all([
    source("app/(public)/calculator-metallokassety/page.tsx"),
    source("components/cassette-project/CassetteVisualWorkspace.tsx"),
  ]);

  assert.match(landing, /По размерам стены/);
  assert.doesNotMatch(landing, /По стене — точнее|целые ряды и колонны/);
  assert.match(visual, /столбцов/);
  assert.match(visual, /countWithWord\(layout\.summary\.quantity/);
  assert.match(visual, /облицовки/);
  assert.doesNotMatch(visual, /колонок|Ряд\.колонка/);
});

test("CAD projects explain reattachment and unsupported DWG calculation clearly", async () => {
  const [save, faq] = await Promise.all([
    source("components/cad/shared/ProjectFileControls.tsx"),
    source("app/(public)/online-order/page.tsx"),
  ]);

  assert.match(save, /прикрепите исходные CAD заново/);
  assert.match(save, /Автосохранения нет/);
  assert.match(faq, /DWG не используется в автоматическом расчёте/);
  assert.match(faq, /через форму заявки/);
});

test("AC basket sample dimensions remain qualified by manufacturer's documentation", async () => {
  const [reference, control] = await Promise.all([
    source("lib/quote/basket-ac-reference.ts"),
    source("components/commercial/BasketAcReference.tsx"),
  ]);

  assert.match(reference, /Размеры приведены для примера/);
  assert.match(reference, /документацией производителя/);
  assert.match(control, /Точные размеры проверяйте по документации своей модели/);
});
