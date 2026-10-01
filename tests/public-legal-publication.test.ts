import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

test("published legal pages use the approved 90-day lead retention period", async () => {
  const [privacy, consent] = await Promise.all([
    readFile(join(root, "app/(public)/legal/privacy/page.tsx"), "utf8"),
    readFile(join(root, "app/(public)/legal/personal-data-consent/page.tsx"), "utf8"),
  ]);

  assert.match(privacy, /не более 90 дней с даты направления заявки/);
  assert.match(consent, /не более 90 дней с даты направления заявки/);
  assert.doesNotMatch(privacy, /не более 12 месяцев/);
  assert.doesNotMatch(consent, /не более 12 месяцев/);
});

test("published legal pages use the configured consent audit period", async () => {
  const [privacy, consent] = await Promise.all([
    readFile(join(root, "app/(public)/legal/privacy/page.tsx"), "utf8"),
    readFile(join(root, "app/(public)/legal/personal-data-consent/page.tsx"), "utf8"),
  ]);

  assert.match(privacy, /не более трёх лет с даты фиксации согласия/);
  assert.match(consent, /не более трёх лет с даты его фиксации/);
});

test("published services page describes controls without exposing internal implementation", async () => {
  const services = await readFile(join(root, "app/(public)/legal/services/page.tsx"), "utf8");

  assert.match(services, /организационные и технические меры защиты персональных данных/);
  assert.match(services, /Уничтожение персональных данных оформляется и подтверждается/);
  assert.match(services, /не публикует сведения, которые могут раскрывать внутреннюю архитектуру/);
  assert.doesNotMatch(services, /PD_ADMIN_ENABLED|SQLite|HMAC/);
});

test("public legal version identifiers match their displayed dates", async () => {
  const legal = await readFile(join(root, "lib/legal.ts"), "utf8");

  assert.match(legal, /privacy: "2026-10-01"/);
  assert.match(legal, /personalDataConsent: "2026-10-01"/);
  assert.match(legal, /analyticsConsent: "2026-10-01"/);
  assert.match(legal, /marketingConsent: "2026-10-01"/);
  assert.match(legal, /cookies: "2026-10-01"/);
  assert.match(legal, /terms: "2026-07-30"/);
  assert.match(legal, /services: "2026-10-01"/);

  assert.match(legal, /privacy: "1 октября 2026 года"/);
  assert.match(legal, /personalDataConsent: "1 октября 2026 года"/);
  assert.match(legal, /analyticsConsent: "1 октября 2026 года"/);
  assert.match(legal, /marketingConsent: "1 октября 2026 года"/);
  assert.match(legal, /cookies: "1 октября 2026 года"/);
  assert.match(legal, /terms: "30 июля 2026 года"/);
  assert.match(legal, /services: "1 октября 2026 года"/);
});

test("every public form leads with the separate consent document", async () => {
  const [quoteForm, assistant] = await Promise.all([
    readFile(new URL("../components/QuoteRequestForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/EngineeringAssistant.tsx", import.meta.url), "utf8"),
  ]);

  function formBody(source: string) {
    const start = source.indexOf("<form");
    const end = source.lastIndexOf("</form>");
    assert.ok(start >= 0 && end > start, "the component must contain a form");
    return source.slice(start, end);
  }

  // Art. 9 152-ФЗ as amended by ФЗ-156 of 24.06.2025, in force since 01.09.2025:
  // the consent is its own document, and a link to the privacy policy alone does
  // not stand in for it. Both links belong inside the form, and the binding
  // consent is the one that leads — a reader, or a scanner working top-down,
  // should meet it before the policy.
  for (const [name, source] of [["quote", quoteForm], ["assistant", assistant]] as const) {
    const body = formBody(source);
    const consent = body.indexOf("legalLinks.personalDataConsent");
    const privacy = body.indexOf("legalLinks.privacy");

    assert.ok(consent >= 0, `${name}: the separate consent document must be linked inside the form`);
    assert.ok(privacy >= 0, `${name}: the privacy policy must be linked inside the form`);
    assert.ok(consent < privacy, `${name}: the consent document must be linked before the policy`);
    assert.match(body, /name="personalDataConsent"[^/]*required/);
  }
});


test("MAX is disclosed as a user-initiated external link, not automatic form forwarding", async () => {
  const [privacy, services, environment] = await Promise.all([
    readFile(join(root, "app/(public)/legal/privacy/page.tsx"), "utf8"),
    readFile(join(root, "app/(public)/legal/services/page.tsx"), "utf8"),
    readFile(join(root, ".env.example"), "utf8"),
  ]);

  assert.match(environment, /^NEXT_PUBLIC_MAX_URL=$/m);
  assert.match(services, /обычная внешняя ссылка на официальный профиль или чат-бот/);
  assert.match(services, /не передаёт в MAX поля формы/);
  assert.match(services, /Автоматическая пересылка заявок или файлов из формы steelprodukt\.ru в MAX не подключена/);
  assert.match(privacy, /обычная внешняя ссылка на официальный профиль или чат-бот Оператора в MAX/);
  assert.match(privacy, /до самостоятельного перехода пользователя сайт не передаёт в MAX поля формы/);
});


test("every legal page shows its own edition date, never another document's", async () => {
  for (const [file, key] of [
    ["marketing-consent", "marketingConsent"],
    ["terms", "terms"],
    ["analytics-consent", "analyticsConsent"],
    ["personal-data-consent", "personalDataConsent"],
    ["privacy", "privacy"],
    ["cookies", "cookies"],
  ] as const) {
    const page = await readFile(join(root, `app/(public)/legal/${file}/page.tsx`), "utf8");
    assert.match(page, new RegExp(`Редакция от \\{legalDocumentDisplayDates\\.${key}\\}`), `${file} must show its own edition`);
    assert.doesNotMatch(page, /Редакция от \{legalOperator\.policyVersion\}/, `${file} must not borrow the policy date`);
  }
});

test("processors are named with INN and address in the consent, the policy and the services page", async () => {
  const [legal, consent, privacy, services, cookies] = await Promise.all([
    readFile(join(root, "lib/legal.ts"), "utf8"),
    readFile(join(root, "app/(public)/legal/personal-data-consent/page.tsx"), "utf8"),
    readFile(join(root, "app/(public)/legal/privacy/page.tsx"), "utf8"),
    readFile(join(root, "app/(public)/legal/services/page.tsx"), "utf8"),
    readFile(join(root, "app/(public)/legal/cookies/page.tsx"), "utf8"),
  ]);

  for (const [name, inn] of [["ООО «Бегет»", "7801451618"], ["ООО «ВК»", "7743001840"], ["ООО «ЯНДЕКС»", "7736207543"]]) {
    assert.ok(legal.includes(name) && legal.includes(inn), `${name} must be listed with its INN`);
  }
  for (const key of ["hosting", "mail"]) {
    assert.match(consent, new RegExp(`legalProcessors\\.${key}\\.name[\\s\\S]*legalProcessors\\.${key}\\.address`));
  }
  assert.match(privacy, /Object\.values\(legalProcessors\)/);
  assert.match(services, /Object\.values\(legalProcessors\)/);
  assert.match(cookies, /legalProcessors\.analytics\.name/);
  assert.doesNotMatch(legal + consent + privacy + services, /UniSender|Юнисендер|GitHub/i);
});

test("analytics consent is its own document with every element the law asks for", async () => {
  const [page, banner, footer, sitemap] = await Promise.all([
    readFile(join(root, "app/(public)/legal/analytics-consent/page.tsx"), "utf8"),
    readFile(join(root, "components/CookieConsent.tsx"), "utf8"),
    readFile(join(root, "components/Footer.tsx"), "utf8"),
    readFile(join(root, "app/sitemap.ts"), "utf8"),
  ]);

  for (const heading of ["Какие данные обрабатываются", "Цели", "Действия и способ обработки", "Лицо, обрабатывающее данные по поручению Оператора", "Срок и отзыв", "Добровольность"]) {
    assert.ok(page.includes(heading), `analytics consent: missing «${heading}»`);
  }
  assert.match(page, /legalOperator\.legalAddress/);
  assert.match(page, /Согласие действует до его отзыва/);
  assert.match(page, /До выбора пользователя аналитика выключена/);
  assert.doesNotMatch(page, /mc\.yandex\.(?:ru|com)/);
  assert.match(banner, /Нажимая «Разрешить аналитику», вы даёте[\s\S]*legalLinks\.analyticsConsent/);
  assert.match(footer, /legalLinks\.analyticsConsent/);
  assert.match(sitemap, /"\/legal\/analytics-consent"/);
});

test("the assistant's consent checkbox carries only the consent, the policy is a separate note", async () => {
  const assistant = await readFile(new URL("../components/EngineeringAssistant.tsx", import.meta.url), "utf8");
  const label = assistant.slice(assistant.indexOf('name="personalDataConsent"'), assistant.indexOf("</label>", assistant.indexOf('name="personalDataConsent"')));
  assert.match(label, /legalLinks\.personalDataConsent/);
  assert.doesNotMatch(label, /legalLinks\.privacy|Ознакомлен/);
});
