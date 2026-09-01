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

  for (const key of ["privacy", "personalDataConsent", "cookies"]) {
    assert.match(legal, new RegExp(`${key}: "2026-08-27"`));
  }
  assert.match(legal, /services: "2026-09-01"/);

  assert.match(legal, /privacy: "27 августа 2026 года"/);
  assert.match(legal, /personalDataConsent: "27 августа 2026 года"/);
  assert.match(legal, /cookies: "27 августа 2026 года"/);
  assert.match(legal, /services: "1 сентября 2026 года"/);
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
