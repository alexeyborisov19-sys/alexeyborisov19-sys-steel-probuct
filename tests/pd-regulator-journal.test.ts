import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  assertPrivateTarget,
  buildJournal,
  summariseConsents,
  summariseLeads,
  surveyStorage,
} from "@/lib/legal/regulator-journal";
import { legalDocumentVersions, legalOperator } from "@/lib/legal";

const root = process.cwd();
const privacyPage = readFileSync(join(root, "app/(public)/legal/privacy/page.tsx"), "utf8");
const servicesPage = readFileSync(join(root, "app/(public)/legal/services/page.tsx"), "utf8");
const journalScript = readFileSync(join(root, "scripts/pd-regulator-journal.ts"), "utf8");
const journalModule = readFileSync(join(root, "lib/legal/regulator-journal.ts"), "utf8");
const deployScript = readFileSync(join(root, "deploy/prepare-production.sh"), "utf8");

function requestInput() {
  return {
    generatedAt: "2026-09-01T09:00:00.000Z",
    authority: "Роскомнадзор",
    requestNumber: "12-345",
    requestDate: "2026-09-01",
    preparedBy: "Фамилия И.О.",
  };
}

async function fixtureWithPersonalData() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "regulator-journal-"));
  const leads = join(fixtureRoot, "leads");
  const consents = join(fixtureRoot, "consents");
  await mkdir(leads);
  await mkdir(consents);

  await writeFile(join(leads, "lead.json"), JSON.stringify({
    createdAt: "2026-08-01T10:00:00.000Z",
    name: "Иванов Иван",
    phone: "+79990000000",
    email: "ivanov@example.com",
    company: "ООО Тест",
    message: "СЕКРЕТНЫЙ ТЕКСТ ОБРАЩЕНИЯ",
    source: "quote-form",
    consentAudit: "stored",
    delivery: "mail",
    retentionDays: 90,
    files: [{ name: "чертёж.dwg", storedAs: "abc.dwg" }],
  }));

  await writeFile(join(consents, "consent.json"), JSON.stringify({
    createdAt: "2026-08-01T10:00:00.000Z",
    event: "quote-form",
    subjectHash: "a".repeat(64),
    personalDataConsentVersion: legalDocumentVersions.personalDataConsent,
    privacyVersion: legalDocumentVersions.privacy,
    marketing: false,
    retentionDays: 1095,
  }));

  return { leads, consents };
}

test("regulator journal is private and not exposed over HTTP", () => {
  assert.doesNotMatch(journalScript, /\bexport\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/);
  assert.doesNotMatch(journalModule, /\bexport\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/);
  assert.throws(() => assertPrivateTarget(resolve(root, "public")), /must not be written inside public/);
  assert.throws(() => assertPrivateTarget(resolve(root, "public/exports")), /must not be written inside public/);
  assert.doesNotThrow(() => assertPrivateTarget(resolve(root, ".data/regulator-journals")));
  assert.match(journalScript, /PD_JOURNAL_PATH \|\| "\.data\/regulator-journals"/);
  assert.match(journalScript, /mode: 0o600/);
});

test("official export requires request metadata", async () => {
  const empty = join(tmpdir(), "regulator-journal-missing");
  const base = {
    generatedAt: "2026-09-01T09:00:00.000Z",
    storage: [],
    consents: await summariseConsents(empty),
    leads: await summariseLeads(empty),
  };

  assert.throws(() => buildJournal({
    ...base,
    authority: null,
    requestNumber: "12-345",
    requestDate: "2026-09-01",
    preparedBy: "Фамилия И.О.",
  }), /Не указан обязательный реквизит/);

  assert.throws(() => buildJournal({
    ...base,
    authority: "Роскомнадзор",
    requestNumber: "12-345",
    requestDate: "01.09.2026",
    preparedBy: "Фамилия И.О.",
  }), /YYYY-MM-DD/);
});

test("journal contains no subject personal data or internal implementation details", async () => {
  const fixture = await fixtureWithPersonalData();
  const journal = buildJournal({
    ...requestInput(),
    storage: [
      await surveyStorage("Обращения (форма расчёта)", fixture.leads),
      await surveyStorage("Доказательства согласия", fixture.consents),
    ],
    consents: await summariseConsents(fixture.consents),
    leads: await summariseLeads(fixture.leads, new Date("2026-09-01T09:00:00.000Z")),
  });

  for (const planted of [
    "Иванов", "+79990000000", "ivanov@example.com", "ООО Тест",
    "СЕКРЕТНЫЙ ТЕКСТ", "чертёж.dwg", fixture.leads, fixture.consents,
    "PD_ADMIN_ENABLED", "CLAMAV_ENABLED",
  ]) {
    assert.ok(!journal.canonical.includes(planted), `journal leaked ${planted}`);
  }

  assert.equal(journal.payload.requests_register.total, 1);
  assert.equal(journal.payload.requests_register.withAttachments, 1);
  assert.equal(journal.payload.consent_evidence.total, 1);
  assert.equal(journal.payload.storage_summary.length, 2);
  assert.ok(!("path" in journal.payload.storage_summary[0]));
  assert.ok(!("mode" in journal.payload.storage_summary[0]));
  assert.equal(journal.sha256, createHash("sha256").update(journal.canonical).digest("hex"));
});

test("journal identifies ООО ЭНЕРГОАЛЬЯНС and records official request basis", async () => {
  const empty = join(tmpdir(), "regulator-journal-missing");
  const journal = buildJournal({
    ...requestInput(),
    storage: [],
    consents: await summariseConsents(empty),
    leads: await summariseLeads(empty),
  });

  assert.equal(journal.payload.operator.name, legalOperator.name);
  assert.equal(journal.payload.operator.short_name, "ООО «ЭНЕРГОАЛЬЯНС»");
  assert.equal(journal.payload.operator.inn, "6732110789");
  assert.equal(journal.payload.operator.ogrn, "1156733014657");
  assert.deepEqual(journal.payload.request, {
    authority: "Роскомнадзор",
    number: "12-345",
    date: "2026-09-01",
    prepared_by: "Фамилия И.О.",
  });

  assert.deepEqual(
    journal.payload.published_documents.map((document) => document.key).sort(),
    Object.keys(legalDocumentVersions).sort(),
  );
});

test("public legal pages do not expose internal storage or feature flags", () => {
  assert.match(privacyPage, /Официальная выгрузка формируется выборочно/);
  assert.match(servicesPage, /с использованием баз данных, находящихся на территории Российской Федерации/);
  assert.match(servicesPage, /Уничтожение персональных данных оформляется и подтверждается/);
  assert.doesNotMatch(servicesPage, /PD_ADMIN_ENABLED|SQLite|HMAC|CLAMAV_ENABLED/);
  assert.doesNotMatch(journalScript, /PD_ADMIN_ENABLED|CLAMAV_ENABLED/);
});

test("storage survey may inspect private paths but regulator payload strips them", async () => {
  const fixture = await fixtureWithPersonalData();
  const survey = await surveyStorage("Обращения", fixture.leads);
  assert.equal(survey.present, true);
  assert.equal(survey.files, 1);
  assert.equal(survey.path, fixture.leads);
  assert.match(survey.mode ?? "", /^\d{3}$/);

  const journal = buildJournal({
    ...requestInput(),
    storage: [survey],
    consents: await summariseConsents(fixture.consents),
    leads: await summariseLeads(fixture.leads),
  });
  assert.ok(!journal.canonical.includes(fixture.leads));
  assert.ok(!journal.canonical.includes(`\"mode\"`));
});

test("malformed records are counted without disclosure", async () => {
  const directory = await mkdtemp(join(tmpdir(), "regulator-journal-broken-"));
  await writeFile(join(directory, "broken.json"), '{"name":"Иванов","phone":"+79990000000",');

  const consents = await summariseConsents(directory);
  const leads = await summariseLeads(directory);
  assert.equal(consents.malformed, 1);
  assert.equal(leads.malformed, 1);

  const journal = buildJournal({
    ...requestInput(),
    storage: [await surveyStorage("Обращения", directory)],
    consents,
    leads,
  });
  assert.ok(!journal.canonical.includes("Иванов"));
  assert.ok(!journal.canonical.includes("+79990000000"));
});

test("production configuration still uses private Russian server storage paths", () => {
  for (const variable of [
    "QUOTE_STORAGE_PATH",
    "ASSISTANT_LEAD_STORAGE_PATH",
    "CONSENT_AUDIT_STORAGE_PATH",
    "UPLOAD_QUARANTINE_PATH",
  ]) {
    assert.ok(journalScript.includes(`process.env.${variable}`));
    assert.ok(deployScript.includes(variable));
  }
  assert.match(deployScript, /\/var\/lib\/steelprodukt\//);
});
