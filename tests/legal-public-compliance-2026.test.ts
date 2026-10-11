import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { legalDocumentVersions, legalOperator } from "../lib/legal";

// Source: signed FNS EGRUL extract dated 11.10.2026.
// These checks verify the published legal identity, not internal operational compliance.
test("legal operator identity agrees with the latest EGRUL", () => {
  assert.equal(legalOperator.name, "Общество с ограниченной ответственностью «ЭНЕРГОАЛЬЯНС»");
  assert.equal(legalOperator.inn, "6732110789");
  assert.equal(legalOperator.kpp, "673201001");
  assert.equal(legalOperator.ogrn, "1156733014657");
  assert.equal(legalOperator.director, "Москвин Виктор Александрович");
  assert.match(legalOperator.legalAddress, /214009/);
  assert.match(legalOperator.legalAddress, /Рославльское/);
  assert.match(legalOperator.legalAddress, /д\. 99, стр\. 2/);
  assert.notEqual(legalOperator.legalAddress, legalOperator.productionAddress);
});

test("public documents state the legal breach reporting timeline without making notification discretionary", () => {
  const text = readFileSync("app/(public)/legal/privacy/page.tsx", "utf8");
  assert.match(text, /в течение 24 часов/);
  assert.match(text, /в течение 72 часов/);
  assert.match(text, /часть 3\.1 статьи 21|частью 3\.1 статьи 21/);
  assert.match(text, /Роскомнадзор/);
  assert.match(text, /приказом Роскомнадзора от 28\.10\.2022 № 179/);
  assert.match(text, /акт/);
  assert.match(text, /выгрузк/);
  assert.equal(legalDocumentVersions.privacy, "2026-10-11");
});

test("advertising opt-in covers the corresponding processing of personal data and stays separate", () => {
  const marketing = readFileSync("app/(public)/legal/marketing-consent/page.tsx", "utf8");
  const form = readFileSync("components/QuoteRequestForm.tsx", "utf8");
  assert.match(marketing, /согласие на обработку указанных ниже моих персональных данных/);
  assert.match(marketing, /отдельную необязательную отметку/);
  assert.match(marketing, /Действия с персональными данными/);
  assert.match(marketing, /Отозвать согласие/);
  assert.match(form, /name="personalDataConsent"/);
  assert.match(form, /name="marketingConsent"/);
  assert.match(form, /name="personalDataConsent"[^>]*required/);
  assert.doesNotMatch(form, /name="marketingConsent"[^>]*required/);
  assert.equal(legalDocumentVersions.marketingConsent, "2026-10-11");
});

test("analytics permission remains independent and optional", () => {
  const widget = readFileSync("components/CookieConsent.tsx", "utf8");
  assert.match(widget, /choose\(false\)/);
  assert.match(widget, /choose\(true\)/);
  assert.match(widget, /Продолжить без аналитики/);
  assert.match(widget, /Разрешить аналитику/);
  assert.match(widget, /hasAnalyticsConsent/);
});
