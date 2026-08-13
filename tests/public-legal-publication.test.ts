import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

test("published legal pages use the approved 90-day lead retention period", async () => {
  const [environment, privacy, consent] = await Promise.all([
    readFile(join(root, ".env.example"), "utf8"),
    readFile(join(root, "app/(public)/legal/privacy/page.tsx"), "utf8"),
    readFile(join(root, "app/(public)/legal/personal-data-consent/page.tsx"), "utf8"),
  ]);

  assert.match(environment, /^LEAD_RETENTION_DAYS=90$/m);
  assert.match(privacy, /не более 90 дней с даты направления заявки/);
  assert.match(consent, /не более 90 дней с даты направления заявки/);
  assert.doesNotMatch(privacy, /не более 12 месяцев/);
  assert.doesNotMatch(consent, /не более 12 месяцев/);
});

test("published legal pages use the configured consent audit period", async () => {
  const [environment, privacy, consent] = await Promise.all([
    readFile(join(root, ".env.example"), "utf8"),
    readFile(join(root, "app/(public)/legal/privacy/page.tsx"), "utf8"),
    readFile(join(root, "app/(public)/legal/personal-data-consent/page.tsx"), "utf8"),
  ]);

  assert.match(environment, /^CONSENT_AUDIT_RETENTION_DAYS=1095$/m);
  assert.match(privacy, /не более трёх лет с даты фиксации согласия/);
  assert.match(consent, /не более трёх лет с даты его фиксации/);
});

test("published services page reflects the deployed but disabled internal foundation", async () => {
  const [privacy, services, environment] = await Promise.all([
    readFile(join(root, "app/(public)/legal/privacy/page.tsx"), "utf8"),
    readFile(join(root, "app/(public)/legal/services/page.tsx"), "utf8"),
    readFile(join(root, ".env.example"), "utf8"),
  ]);

  assert.match(environment, /^PD_ADMIN_ENABLED=false$/m);
  assert.match(privacy, /Административный интерфейс выключен/);
  assert.match(services, /PD_ADMIN_ENABLED=false/);
  assert.match(services, /реальные официальные выгрузки и удаления не выполняются/);
});

test("public legal version identifiers match their displayed dates", async () => {
  const legal = await readFile(join(root, "lib/legal.ts"), "utf8");

  for (const key of ["privacy", "personalDataConsent", "services"]) {
    assert.match(legal, new RegExp(`${key}: "2026-08-13"`));
  }

  assert.match(legal, /privacy: "13 августа 2026 года"/);
  assert.match(legal, /personalDataConsent: "13 августа 2026 года"/);
  assert.match(legal, /services: "13 августа 2026 года"/);
});
