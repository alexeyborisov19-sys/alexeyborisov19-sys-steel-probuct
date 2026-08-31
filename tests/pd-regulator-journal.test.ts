import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  assertPrivateTarget, buildJournal, summariseConsents, summariseLeads, surveyStorage,
} from "@/lib/legal/regulator-journal";
import { legalDocumentVersions, legalOperator } from "@/lib/legal";

const root = process.cwd();

/**
 * The journal exists to answer a supervisory request, and the site has already
 * published how such an answer is produced. These tests hold the code to that
 * published wording rather than to a private intention.
 */

const privacyPage = readFileSync(join(root, "app/(public)/legal/privacy/page.tsx"), "utf8");
const journalScript = readFileSync(join(root, "scripts/pd-regulator-journal.ts"), "utf8");
const journalModule = readFileSync(join(root, "lib/legal/regulator-journal.ts"), "utf8");
const servicesPage = readFileSync(join(root, "app/(public)/legal/services/page.tsx"), "utf8");
const deployScript = readFileSync(join(root, "deploy/prepare-production.sh"), "utf8");

/** grep -rl, with "no matches" (exit 1) reported as an empty list rather than a throw. */
function grepFiles(needle: string, roots: string[]) {
  try {
    return execFileSync("grep", ["-rl", "--", needle, ...roots], { cwd: root, encoding: "utf8" })
      .trim().split("\n").filter(Boolean).sort();
  } catch (error) {
    if ((error as { status?: number }).status === 1) return [];
    throw error;
  }
}

/** Leads and consent evidence live in separate directories, as they do in production. */
async function fixtureWithPersonalData() {
  const root = await mkdtemp(join(tmpdir(), "regulator-journal-"));
  const directory = join(root, "leads");
  const consentDirectory = join(root, "consents");
  await mkdir(directory);
  await mkdir(consentDirectory);
  await writeFile(join(directory, "lead.json"), JSON.stringify({
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
  await writeFile(join(consentDirectory, "consent.json"), JSON.stringify({
    createdAt: "2026-08-01T10:00:00.000Z",
    event: "quote-form",
    subjectHash: "a".repeat(64),
    personalDataConsentVersion: legalDocumentVersions.personalDataConsent,
    privacyVersion: legalDocumentVersions.privacy,
    marketing: false,
    retentionDays: 1095,
  }));
  return { leads: directory, consents: consentDirectory };
}

test("the journal is assembled on request and never published as an endpoint", async () => {
  // Privacy policy, section 8: официальная выгрузка формируется выборочно and
  // постоянные публичные ссылки не используются. Nothing may serve this over
  // HTTP, and nothing may write it where the web server can reach it.
  assert.match(privacyPage, /постоянные публичные ссылки и автоматическая отправка архивов не используются/);

  assert.doesNotMatch(journalScript, /\bexport\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/);
  assert.doesNotMatch(journalModule, /\bexport\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/);

  // The output directory is refused whenever it resolves inside public/.
  assert.throws(() => assertPrivateTarget(resolve(root, "public")), /must not be written inside public/);
  assert.throws(() => assertPrivateTarget(resolve(root, "public/exports")), /must not be written inside public/);
  assert.throws(() => assertPrivateTarget(resolve(root, "public/../public/nested")), /must not be written inside public/);
  assert.doesNotThrow(() => assertPrivateTarget(resolve(root, ".data/regulator-journals")));
  assert.doesNotThrow(() => assertPrivateTarget(resolve(root, "public-facing-notes")));

  // The default target is private too, and written with owner-only permissions.
  assert.match(journalScript, /PD_JOURNAL_PATH \|\| "\.data\/regulator-journals"/);
  assert.match(journalScript, /assertPrivateTarget\(outputDirectory\)/);
  assert.match(journalScript, /mkdir\(outputDirectory, \{ recursive: true, mode: 0o700 \}\)/);
  assert.match(journalScript, /mode: 0o600/);
});

test("the site does not send the journal to an authority by itself", async () => {
  // Privacy policy, section 7: Сайт не принимает такое решение и не отправляет
  // материалы государственным органам автоматически. The journal is written to
  // disk and nothing else — no mail transport, no outbound request, no schedule.
  assert.match(privacyPage, /не отправляет материалы государственным органам автоматически/);

  for (const source of [journalScript, journalModule]) {
    assert.doesNotMatch(source, /nodemailer|createTransport|sendMail/);
    assert.doesNotMatch(source, /\bfetch\(|node:https?\b|axios/);
  }

  // A person runs it. The site already ships systemd timers (export expiry,
  // offsite backup) and deploy workflows, so "nobody scheduled it" has to be
  // checked rather than assumed: none of those surfaces may name the journal.
  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.equal(packageJson.scripts["pd:journal"], "node --import tsx scripts/pd-regulator-journal.ts");

  const scheduled = grepFiles("pd-regulator-journal", [".github/workflows", "deploy"]);
  assert.deepEqual(scheduled, [], "the journal must not be run automatically");

  // The search itself has to be able to find something, or it proves nothing.
  assert.ok(grepFiles("prepare-production", [".github/workflows", "deploy"]).length > 0);
});

test("the journal carries no personal data even when the records do", async () => {
  // Privacy policy, section 8: a specific subject is answered by the selective
  // official export, not by this journal. So the journal has to stay free of
  // subject data no matter what the underlying records hold.
  const fixture = await fixtureWithPersonalData();

  const journal = buildJournal({
    generatedAt: "2026-09-01T09:00:00.000Z",
    authority: "Роскомнадзор",
    requestNumber: "12-345",
    requestDate: "2026-09-01",
    preparedBy: "Фамилия И.О.",
    storage: [
      await surveyStorage("Обращения (форма расчёта)", fixture.leads),
      await surveyStorage("Доказательства согласия", fixture.consents),
    ],
    consents: await summariseConsents(fixture.consents),
    leads: await summariseLeads(fixture.leads, new Date("2026-09-01T09:00:00.000Z")),
    environment: { "Внутренний интерфейс персональных данных": "выключен (404)" },
  });

  for (const planted of ["Иванов", "+79990000000", "ivanov@example.com", "ООО Тест", "СЕКРЕТНЫЙ ТЕКСТ", "чертёж.dwg"]) {
    assert.ok(!journal.canonical.includes(planted), `journal leaked ${planted}`);
  }

  // The records were read — the journal is empty of personal data, not empty.
  assert.equal(journal.payload.requests_register.total, 1);
  assert.equal(journal.payload.requests_register.withAttachments, 1);
  assert.deepEqual(journal.payload.requests_register.bySource, { "quote-form": 1 });
  assert.equal(journal.payload.consent_evidence.total, 1);
  assert.equal(journal.payload.consent_evidence.withMarketing, 0);

  // Consent evidence is reported by its stored form, which is already a hash.
  assert.ok(!journal.canonical.includes("a".repeat(64)), "journal repeated a subject hash");

  // The machine-readable part is bound to its own digest, so a journal that was
  // edited after signing stops matching the number it was sent under.
  assert.equal(journal.sha256, createHash("sha256").update(journal.canonical).digest("hex"));
});

test("the journal records who prepared it and on what basis", async () => {
  // Privacy policy, section 8: передаётся уполномоченным сотрудником по
  // официальному каналу. A journal with no named preparer and no request
  // reference would not evidence that.
  assert.match(privacyPage, /передаётся уполномоченным сотрудником по официальному каналу/);

  const journal = buildJournal({
    generatedAt: "2026-09-01T09:00:00.000Z",
    authority: "Роскомнадзор",
    requestNumber: "12-345",
    requestDate: "2026-09-01",
    preparedBy: "Фамилия И.О.",
    storage: [],
    consents: await summariseConsents(join(tmpdir(), "regulator-journal-missing")),
    leads: await summariseLeads(join(tmpdir(), "regulator-journal-missing")),
    environment: {},
  });

  assert.deepEqual(journal.payload.request, {
    authority: "Роскомнадзор",
    number: "12-345",
    date: "2026-09-01",
    prepared_by: "Фамилия И.О.",
  });

  // The operator identifies itself with the same details it publishes.
  assert.equal(journal.payload.operator.name, legalOperator.name);
  assert.equal(journal.payload.operator.inn, legalOperator.inn);
  assert.equal(journal.payload.operator.ogrn, legalOperator.ogrn);
  assert.equal(journal.payload.operator.contact_for_subjects, legalOperator.privacyEmail);

  // Every published document is listed at the redaction actually in force, so
  // the journal cannot describe a version of the rules the site never showed.
  const listed = journal.payload.published_documents;
  assert.deepEqual(
    listed.map((document) => document.key).sort(),
    Object.keys(legalDocumentVersions).sort(),
  );
  for (const document of listed) {
    assert.equal(document.version, legalDocumentVersions[document.key]);
    assert.match(document.url, /^https:\/\/www\.steelprodukt\.ru\/legal\//);
  }
});

test("the journal states its own limits in the words the policy uses", () => {
  // A regulator reading the journal must not mistake it for a subject export.
  const notice = buildJournal({
    generatedAt: "2026-09-01T09:00:00.000Z",
    authority: null, requestNumber: null, requestDate: null, preparedBy: null,
    storage: [], environment: {},
    consents: {
      total: 0, byEvent: {}, byPersonalDataVersion: {}, byPrivacyVersion: {},
      withMarketing: 0, retentionDays: [], earliest: null, latest: null, malformed: 0,
    },
    leads: {
      total: 0, bySource: {}, byConsentAudit: {}, byDelivery: {}, withAttachments: 0,
      attachments: 0, retentionDays: [], pastRetention: 0, earliest: null, latest: null, malformed: 0,
    },
  }).payload.notice;

  assert.match(notice, /Журнал не содержит персональных данных/);
  assert.match(notice, /хранятся в виде хешей/);
  assert.match(notice, /отдельной выборочной выгрузкой/);

  // The policy promises exactly that selectivity, and the hashed storage of
  // consent evidence is what the consent document publishes.
  assert.match(privacyPage, /Официальная выгрузка формируется выборочно/);

  // "Сервисы обработки данных" reserves the term «официальная выгрузка» for the
  // closed module's subject-data package, and states that none are performed
  // while PD_ADMIN_ENABLED=false. The journal must not read as evidence that
  // the module was switched on, so it disclaims that in the same terms.
  assert.match(servicesPage, /реальные официальные выгрузки и удаления не выполняются/);
  assert.match(servicesPage, /не предоставляет государственному органу прямой доступ/);
  assert.match(notice, /не является такой выгрузкой/);
  assert.match(notice, /закрытый служебный интерфейс остаётся выключенным/);
  assert.match(notice, /постоянные публичные ссылки и автоматическая отправка не используются/);
});

test("the journal reports the state of the closed module rather than assuming it", async () => {
  // The register row is only true while the interface is actually off, so the
  // journal reads the flag instead of restating the published sentence.
  assert.match(journalScript, /PD_ADMIN_ENABLED === "true" \? "включён" : "выключен \(404\)"/);

  // Storage locations are reported from the same environment variables the
  // deploy script sets, so the journal describes the server it runs on.
  for (const variable of [
    "QUOTE_STORAGE_PATH", "ASSISTANT_LEAD_STORAGE_PATH",
    "CONSENT_AUDIT_STORAGE_PATH", "UPLOAD_QUARANTINE_PATH",
  ]) {
    assert.ok(journalScript.includes(`process.env.${variable}`), `${variable} is not surveyed`);
    assert.ok(deployScript.includes(variable), `${variable} is not set at deploy time`);
  }

  // Services register: первичная база ... вне публичного каталога. The journal
  // lands beside them, under the same private root.
  assert.match(servicesPage, /вне публичного каталога на сервере в Российской Федерации/);
  const deployRoot = /\/var\/lib\/steelprodukt\//;
  assert.match(deployScript, deployRoot);
});

test("a malformed record is counted, not fatal, and not repeated", async () => {
  // An unreadable file must not stop the operator from answering a deadline,
  // and its contents must not be quoted into the reply while explaining it.
  const directory = await mkdtemp(join(tmpdir(), "regulator-journal-broken-"));
  await writeFile(join(directory, "broken.json"), '{"name":"Иванов","phone":"+79990000000",');

  const consents = await summariseConsents(directory);
  const leads = await summariseLeads(directory);
  assert.equal(consents.malformed, 1);
  assert.equal(consents.total, 0);
  assert.equal(leads.malformed, 1);
  assert.equal(leads.total, 0);

  const journal = buildJournal({
    generatedAt: "2026-09-01T09:00:00.000Z",
    authority: null, requestNumber: null, requestDate: null, preparedBy: null,
    storage: [await surveyStorage("Обращения (форма расчёта)", directory)],
    consents, leads, environment: {},
  });
  assert.ok(!journal.canonical.includes("Иванов"));
  assert.ok(!journal.canonical.includes("+79990000000"));
});

test("storage is described by location and shape, never by content", async () => {
  // Privacy policy, section 5: первичные базы данных на территории России.
  // The survey reports where records live and how many there are; it opens none.
  const fixture = await fixtureWithPersonalData();
  const survey = await surveyStorage("Обращения (форма расчёта)", fixture.leads);

  assert.equal(survey.present, true);
  assert.equal(survey.files, 1);
  assert.match(survey.mode ?? "", /^\d{3}$/);
  assert.ok(!JSON.stringify(survey).includes("Иванов"));

  // A missing directory is reported as absent rather than throwing, so the
  // journal still assembles on a server where a channel was never enabled.
  const absent = await surveyStorage("Карантин вложений", join(fixture.leads, "nowhere"));
  assert.equal(absent.present, false);
  assert.equal(absent.files, 0);
});
