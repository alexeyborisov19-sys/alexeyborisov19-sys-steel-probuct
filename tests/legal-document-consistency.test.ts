import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

test("public legal retention matches the configured 90-day lead period", async () => {
  const [environment, deployment, privacy, consent, regulation] = await Promise.all([
    readFile(join(root, ".env.example"), "utf8"),
    readFile(join(root, "deploy/prepare-production.sh"), "utf8"),
    readFile(join(root, "app/(public)/legal/privacy/page.tsx"), "utf8"),
    readFile(join(root, "app/(public)/legal/personal-data-consent/page.tsx"), "utf8"),
    readFile(join(root, "docs/legal-approval-package/05-retention-legal-hold-destruction.md"), "utf8"),
  ]);

  assert.match(environment, /^LEAD_RETENTION_DAYS=90$/m);
  assert.match(deployment, /LEAD_RETENTION_DAYS "90"/);
  assert.match(privacy, /не более 90 дней с даты направления заявки/);
  assert.match(consent, /не более 90 дней с даты направления заявки/);
  assert.match(regulation, /заявка без договора — до 90 дней с даты направления заявки/);
});

test("public consent evidence period matches the configured 1095-day audit period", async () => {
  const [environment, privacy, consent, regulation] = await Promise.all([
    readFile(join(root, ".env.example"), "utf8"),
    readFile(join(root, "app/(public)/legal/privacy/page.tsx"), "utf8"),
    readFile(join(root, "app/(public)/legal/personal-data-consent/page.tsx"), "utf8"),
    readFile(join(root, "docs/legal-approval-package/05-retention-legal-hold-destruction.md"), "utf8"),
  ]);

  assert.match(environment, /^CONSENT_AUDIT_RETENTION_DAYS=1095$/m);
  assert.match(privacy, /не более трёх лет с даты фиксации согласия/);
  assert.match(consent, /не более трёх лет с даты его фиксации/);
  assert.match(regulation, /до трёх лет с даты фиксации согласия/);
});

test("public consent states how the data subject is identified", async () => {
  const consent = await readFile(
    join(root, "app/(public)/legal/personal-data-consent/page.tsx"),
    "utf8",
  );

  assert.match(consent, /Сведения о субъекте персональных данных и порядок идентификации/);
  assert.match(consent, /имени, указанного в форме, и хотя бы одного контактного реквизита/);
  assert.match(consent, /не является удостоверением личности по документу/);
});

test("public legal texts describe analytics hosts and keep them consent-gated", async () => {
  const [privacy, consent, cookies, services, nextConfig] = await Promise.all([
    readFile(join(root, "app/(public)/legal/privacy/page.tsx"), "utf8"),
    readFile(join(root, "app/(public)/legal/personal-data-consent/page.tsx"), "utf8"),
    readFile(join(root, "app/(public)/legal/cookies/page.tsx"), "utf8"),
    readFile(join(root, "app/(public)/legal/services/page.tsx"), "utf8"),
    readFile(join(root, "next.config.ts"), "utf8"),
  ]);

  for (const document of [privacy, consent, cookies, services]) {
    assert.match(document, /mc\.yandex\.ru/);
    assert.match(document, /mc\.yandex\.com/);
  }

  assert.match(privacy, /только после отдельного согласия на аналитику/);
  assert.match(consent, /не распространяется на аналитические cookies/);
  assert.doesNotMatch(nextConfig, /images\.unsplash\.com/);
});

test("public legal drafts describe the internal interface as disabled", async () => {
  const [privacy, services, approvalPackage] = await Promise.all([
    readFile(join(root, "app/(public)/legal/privacy/page.tsx"), "utf8"),
    readFile(join(root, "app/(public)/legal/services/page.tsx"), "utf8"),
    readFile(join(root, "docs/legal-approval-package/14-public-site-legal-review.md"), "utf8"),
  ]);

  assert.match(privacy, /Административный интерфейс выключен/);
  assert.match(services, /PD_ADMIN_ENABLED=false/);
  assert.match(approvalPackage, /internal-база развёрнута, но `PD_ADMIN_ENABLED=false`/);
});

test("the legal approval package contains exact public drafts and staff confidentiality terms", async () => {
  const [publicDrafts, undertaking, order] = await Promise.all([
    readFile(join(root, "docs/legal-approval-package/16-public-legal-texts.md"), "utf8"),
    readFile(join(root, "docs/legal-approval-package/15-confidentiality-undertaking.md"), "utf8"),
    readFile(join(root, "docs/legal-approval-package/01-approval-order.md"), "utf8"),
  ]);

  for (const heading of [
    "Политика обработки персональных данных",
    "Согласие на обработку персональных данных",
    "Согласие на рекламные и информационные материалы",
    "Политика cookies",
    "Сервисы обработки данных",
    "Пользовательское соглашение",
    "Реквизиты для сверки",
  ]) {
    assert.ok(publicDrafts.includes(heading), `missing public legal draft: ${heading}`);
  }
  assert.match(undertaking, /обязуюсь/);
  assert.match(order, /Редакции публичных юридических документов сайта/);
});
