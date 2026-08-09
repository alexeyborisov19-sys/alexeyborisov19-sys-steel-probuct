import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { hasPdPermission, type PdRole } from "@/lib/pd-admin/auth/permissions";
import { findSessionByToken, persistSession } from "@/lib/pd-admin/auth/session-store";
import { verifyAccessEventChain } from "@/lib/pd-admin/audit/chain";
import { createAuthorityRequest, extendAuthorityDeadline, verifyAuthorityRequest } from "@/lib/pd-admin/authority-requests/repository";
import { readPdAdminConfig } from "@/lib/pd-admin/config";
import { closePdDatabase, openPdDatabase } from "@/lib/pd-admin/db/database";
import {
  approveExport,
  buildExportArchive,
  createExportDraft,
  createExportPreview,
  expireExportArchivesAsSystem,
  openExportDownload,
  registerExportTransfer,
} from "@/lib/pd-admin/export/service";
import { createCsv, createXlsx } from "@/lib/pd-admin/export/archive";
import { createIncident, closeIncident, updateIncident } from "@/lib/pd-admin/incidents/repository";
import { createLegalHold, releaseLegalHold } from "@/lib/pd-admin/legal-holds/repository";
import {
  listBackups,
  registerBackup,
  registerLegalDocumentVersion,
  registerRestoreTest,
  createSystem,
  updateSystem,
} from "@/lib/pd-admin/registers/repository";
import { approveDeletion, createDeletionScan, executeDeletion, retentionDashboard, verifyDeletion } from "@/lib/pd-admin/retention/service";
import { PdStage4Error } from "@/lib/pd-admin/stage4/common";
import { addWeekdays } from "@/lib/pd-admin/stage4/deadlines";
import {
  createSubjectRequest,
  extendSubjectDeadline,
  getSubjectRequest,
  verifySubjectIdentity,
} from "@/lib/pd-admin/subject-requests/repository";

const searchKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const sessionKey = "1123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const auditKey = "2123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

type Fixture = Awaited<ReturnType<typeof stage4Fixture>>;

function zipEntries(buffer: Buffer) {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressed = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    entries.set(name, buffer.subarray(contentStart, contentStart + compressed));
    offset = contentStart + compressed;
  }
  return entries;
}

async function stage4Fixture() {
  const root = await mkdtemp(join(tmpdir(), "steelprodukt-pd-stage4-"));
  const paths = {
    root,
    database: join(root, "admin", "personal-data.sqlite"),
    exports: join(root, "exports"),
    quote: join(root, "quote-leads"),
    assistant: join(root, "assistant-leads"),
    quarantine: join(root, "quarantine"),
    consent: join(root, "consent-audit"),
  };
  for (const path of [paths.exports, paths.quote, paths.assistant, paths.quarantine, paths.consent]) await mkdir(path, { recursive: true, mode: 0o700 });
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    PD_ADMIN_ENABLED: "true",
    PD_ADMIN_DB_PATH: paths.database,
    PD_EXPORT_PATH: paths.exports,
    PD_SEARCH_HMAC_KEY: searchKey,
    PD_SESSION_HASH_KEY: sessionKey,
    PD_AUDIT_CHAIN_KEY: auditKey,
    PD_EXPORT_TTL_HOURS: "24",
  };
  process.env.QUOTE_STORAGE_PATH = paths.quote;
  process.env.ASSISTANT_LEAD_STORAGE_PATH = paths.assistant;
  process.env.UPLOAD_QUARANTINE_PATH = paths.quarantine;
  process.env.CONSENT_AUDIT_STORAGE_PATH = paths.consent;
  process.env.CONSENT_AUDIT_RETENTION_DAYS = "1095";
  const database = openPdDatabase({ databasePath: paths.database, environment });
  const now = new Date();
  const createdAt = now.toISOString();
  const adminId = randomUUID();
  const officerId = randomUUID();
  const managerId = randomUUID();
  const insertUser = database.prepare(`INSERT INTO users(id, username, display_name, password_hash, password_algorithm,
    password_version, role, must_change_password, created_at, updated_at) VALUES (?, ?, ?, 'fixture-hash', 'scrypt', 1, ?, 0, ?, ?)`);
  insertUser.run(adminId, "stage4-admin", "Fixture Admin", "ADMIN", createdAt, createdAt);
  insertUser.run(officerId, "stage4-officer", "Fixture Officer", "PERSONAL_DATA_OFFICER", createdAt, createdAt);
  insertUser.run(managerId, "stage4-manager", "Fixture Manager", "MANAGER", createdAt, createdAt);

  function makeContext(userId: string, role: PdRole, username: string, stepUp = true): PdAuthContext {
    const secret = persistSession(database, { userId, ipHash: `fixture-ip-${role}`, userAgentHash: `fixture-ua-${role}`, hashKey: sessionKey, idleMinutes: 60, absoluteHours: 24, now });
    const stored = findSessionByToken(database, secret.token, sessionKey, now);
    assert.ok(stored);
    if (stepUp) stored.stepUpUntil = new Date(now.getTime() + 60 * 60_000).toISOString();
    return {
      config: readPdAdminConfig(environment, { production: false }),
      database,
      databasePath: paths.database,
      user: { id: userId, username, displayName: username, role, mustChangePassword: false, passwordVersion: 1 },
      session: stored,
      csrfToken: secret.csrfToken,
      ipHash: `fixture-ip-${role}`,
      close: () => undefined,
    };
  }

  return {
    root,
    paths,
    environment,
    database,
    adminId,
    officerId,
    managerId,
    admin: makeContext(adminId, "ADMIN", "stage4-admin"),
    officer: makeContext(officerId, "PERSONAL_DATA_OFFICER", "stage4-officer"),
    manager: makeContext(managerId, "MANAGER", "stage4-manager"),
    close: () => closePdDatabase(database, paths.database),
  };
}

async function addLead(fixture: Fixture, requestId: string, input: { expired?: boolean; attachment?: boolean; integrity?: string; source?: "quote-form" | "engineering-assistant" } = {}) {
  const source = input.source ?? "quote-form";
  const storage = source === "quote-form" ? "quote-leads" : "assistant-leads";
  const root = source === "quote-form" ? fixture.paths.quote : fixture.paths.assistant;
  const createdAt = "2026-01-01T09:00:00.000Z";
  const expiresAt = input.expired === false ? "2030-01-01T09:00:00.000Z" : "2026-02-01T09:00:00.000Z";
  const auditId = randomUUID();
  const storageId = input.attachment ? `${randomUUID()}.pdf` : null;
  const files = storageId ? [{ storageId, originalName: "fixture.pdf", mimeType: "application/pdf", size: 17, antivirus: "clean" }] : [];
  const lead = {
    requestId,
    source,
    createdAt,
    name: "Фиктивный субъект",
    email: "fixture@example.invalid",
    company: "=CMD()",
    message: "Только искусственные данные для локального теста",
    files,
    consentAudit: { status: "recorded", auditId },
  };
  await writeFile(join(root, `${requestId}.json`), `${JSON.stringify(lead)}\n`, { mode: 0o600 });
  await writeFile(join(fixture.paths.consent, `${auditId}.json`), `${JSON.stringify({ auditId, requestId, createdAt, retentionDays: 1095 })}\n`, { mode: 0o600 });
  if (storageId) {
    const directory = join(fixture.paths.quarantine, requestId);
    await mkdir(directory, { mode: 0o700 });
    await writeFile(join(directory, storageId), "%PDF-1.4 fixture", { mode: 0o600 });
  }
  fixture.database.prepare(`INSERT INTO lead_index(request_id, source, created_at, storage_path_type, retention_days, expires_at,
    consent_audit_status, delivery_status, files_count, integrity_status, first_indexed_at, last_indexed_at)
    VALUES (?, ?, ?, ?, 30, ?, 'recorded', 'stored', ?, ?, ?, ?)`).run(requestId, source, createdAt, storage, expiresAt, files.length, input.integrity ?? "OK", createdAt, createdAt);
  fixture.database.prepare(`INSERT INTO lead_workflow(request_id, internal_status, created_at, updated_at) VALUES (?, 'NEW', ?, ?)`).run(requestId, createdAt, createdAt);
  return { requestId, auditId, storageId, leadPath: join(root, `${requestId}.json`), consentPath: join(fixture.paths.consent, `${auditId}.json`) };
}

test("Stage 4 migrations and RBAC enforce separation of dangerous operations", async () => {
  const fixture = await stage4Fixture();
  try {
    const tables = fixture.database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => String((row as { name: string }).name));
    for (const table of ["authority_requests", "subject_identity_checks", "legal_hold_leads", "export_transfers", "deletion_candidates", "deletion_acts", "backup_restore_tests"]) assert.equal(tables.includes(table), true);
    assert.equal(hasPdPermission("ADMIN", "EXECUTE_DELETION"), true);
    assert.equal(hasPdPermission("PERSONAL_DATA_OFFICER", "APPROVE_EXPORT"), true);
    assert.equal(hasPdPermission("MANAGER", "APPROVE_EXPORT"), false);
    assert.equal(hasPdPermission("MANAGER", "RELEASE_LEGAL_HOLD"), false);
    assert.equal(hasPdPermission("AUDITOR", "VIEW_DELETION_ACT"), true);
    assert.equal(hasPdPermission("AUDITOR", "DOWNLOAD_EXPORT"), false);
  } finally { fixture.close(); }
});

test("subject and authority requests preserve identity, deadline history and optimistic locking", async () => {
  const fixture = await stage4Fixture();
  try {
    const lead = await addLead(fixture, "SP-20260101-AAA00001", { expired: false });
    const subject = createSubjectRequest(fixture.admin, {
      registrationNumber: "PD-SUBJECT-FIXTURE-1",
      receivedAt: "2026-08-03T09:00:00.000Z",
      channel: "EMAIL",
      requestType: "ACCESS",
      subjectName: "Фиктивный субъект",
      subjectContact: "fixture@example.invalid",
      legalBasis: "Запрос субъекта по статье 20 Федерального закона № 152-ФЗ",
      requestSummary: "Предоставить сведения об обработке тестовой записи",
      responsibleUserId: fixture.officerId,
      requestIds: [lead.requestId],
    });
    const created = getSubjectRequest(fixture.admin, subject.id);
    assert.equal(created.dueAt, addWeekdays("2026-08-03T09:00:00.000Z", 10));
    const identity = verifySubjectIdentity(fixture.officer, subject.id, { version: 1, result: "VERIFIED", method: "EMAIL_CONFIRMATION", basis: "Подтверждение через ранее указанный тестовый адрес" });
    const extended = extendSubjectDeadline(fixture.officer, subject.id, { version: identity.version, newDueAt: addWeekdays(String(created.dueAt), 5), reason: "Мотивированное продление на пять рабочих дней" });
    assert.equal(extended.version, 3);
    assert.throws(() => extendSubjectDeadline(fixture.officer, subject.id, { version: 2, newDueAt: "2026-09-30T09:00:00.000Z", reason: "Устаревшая версия обращения" }), (error: unknown) => error instanceof PdStage4Error);
    const detail = getSubjectRequest(fixture.admin, subject.id);
    assert.equal(detail.identityChecks.length, 1);
    assert.equal(detail.deadlineHistory.length, 1);

    const authority = createAuthorityRequest(fixture.officer, {
      registrationNumber: "PD-AUTH-FIXTURE-1",
      receivedAt: "2026-08-03T09:00:00.000Z",
      authorityName: "Роскомнадзор",
      department: "Фиктивное управление",
      officialName: "Фиктивный подписант",
      officialPosition: "Инспектор",
      requestNumber: "TEST-1",
      requestDate: "2026-08-03T00:00:00.000Z",
      deliveryChannel: "OFFICIAL_PORTAL",
      legalBasis: "Тестовое правовое основание без реальной передачи",
      requestedScope: "Только одна фиктивная запись",
      responsibleUserId: fixture.officerId,
      requestIds: [lead.requestId],
    });
    assert.equal((fixture.database.prepare("SELECT due_at FROM authority_requests WHERE id = ?").get(authority.id) as { due_at: string }).due_at, addWeekdays("2026-08-03T09:00:00.000Z", 10));
    const verified = verifyAuthorityRequest(fixture.officer, authority.id, { version: 1, verificationStatus: "VERIFIED", verificationBasis: "Реквизиты и полномочия проверены на фиктивном сценарии" });
    assert.equal(verified.status, "VERIFIED");
    assert.throws(() => extendAuthorityDeadline(fixture.officer, authority.id, { version: 2, newDueAt: "2026-09-30T09:00:00.000Z", reason: "Недопустимое превышение срока продления" }), (error: unknown) => error instanceof PdStage4Error && error.code === "VALIDATION_ERROR");
  } finally { fixture.close(); }
});

test("official export freezes preview scope, builds protected package and expires without losing history", async () => {
  const fixture = await stage4Fixture();
  try {
    const first = await addLead(fixture, "SP-20260101-BBB00001", { expired: false, attachment: true });
    const subject = createSubjectRequest(fixture.officer, {
      registrationNumber: "PD-SUBJECT-EXPORT-1", receivedAt: "2026-08-03T09:00:00.000Z", channel: "EMAIL", requestType: "ACCESS",
      subjectName: "Фиктивный субъект", subjectContact: "fixture@example.invalid", legalBasis: "Тестовый запрос субъекта",
      requestSummary: "Выборочная выгрузка одной фиктивной записи", responsibleUserId: fixture.officerId, requestIds: [first.requestId],
    });
    verifySubjectIdentity(fixture.officer, subject.id, { version: 1, result: "VERIFIED", method: "REQUEST_ID", basis: "Фиктивный requestId подтверждён" });
    assert.throws(() => createExportDraft(fixture.admin, { type: "OTHER", requestNumber: "NO-FILTER", requestDate: "2026-08-03", legalBasis: "Основание без фильтра запрещено", categories: ["RECORDS"], responsibleUserId: fixture.officerId, approvingUserId: fixture.officerId, filter: {} }));
    const draft = createExportDraft(fixture.admin, {
      type: "SUBJECT_REQUEST", subjectRequestId: subject.id, requestNumber: "EXPORT-FIXTURE-1", requestDate: "2026-08-03",
      legalBasis: "Подтверждённый запрос фиктивного субъекта", categories: ["RECORDS", "CONSENT", "ATTACHMENTS", "ACCESS_EVENTS", "WORKFLOW", "COMMENTS"],
      responsibleUserId: fixture.officerId, approvingUserId: fixture.officerId, filter: { subjectRequestId: subject.id },
    });
    const preview = await createExportPreview(fixture.admin, draft.id, 1);
    assert.equal(preview.preview.recordsCount, 1);
    assert.deepEqual(await readdir(fixture.paths.exports), []);

    const late = await addLead(fixture, "SP-20260101-BBB00002", { expired: false });
    fixture.database.prepare("INSERT INTO subject_request_leads(registration_number, request_id) VALUES (?, ?)").run("PD-SUBJECT-EXPORT-1", late.requestId);
    assert.throws(() => approveExport(fixture.admin, draft.id, 2), (error: unknown) => error instanceof PdStage4Error && error.code === "CONFLICT");
    const approved = approveExport(fixture.officer, draft.id, 2);
    assert.equal(approved.selfApproval, false);
    const built = await buildExportArchive(fixture.officer, draft.id, approved.version);
    const archivePath = (fixture.database.prepare("SELECT archive_path FROM exports WHERE id = ?").get(draft.id) as { archive_path: string }).archive_path;
    const archive = await readFile(archivePath);
    assert.equal(createHash("sha256").update(archive).digest("hex"), built.archiveSha256);
    const entries = zipEntries(archive);
    for (const expected of ["README.txt", "export_metadata.json", "index.xlsx", "index.csv", "manifest.json", "SHA256SUMS.txt", `records/quote/${first.requestId}.json`]) assert.equal(entries.has(expected), true, expected);
    assert.equal(entries.has(`records/quote/${late.requestId}.json`), false);
    const metadata = JSON.parse(entries.get("export_metadata.json")?.toString("utf8") || "{}") as Record<string, unknown>;
    assert.equal("archive_sha256" in metadata, false);
    assert.equal(JSON.stringify(metadata).includes(searchKey), false);
    const sums = entries.get("SHA256SUMS.txt")?.toString("utf8").trim().split("\n") ?? [];
    for (const line of sums) {
      const [sha256, path] = line.split("  ");
      assert.equal(createHash("sha256").update(entries.get(path) as Buffer).digest("hex"), sha256);
    }
    const download = await openExportDownload(fixture.officer, draft.id);
    assert.ok(download.size > 0);
    await download.handle.close();
    const transferVersion = Number((fixture.database.prepare("SELECT version FROM exports WHERE id = ?").get(draft.id) as { version: number }).version);
    registerExportTransfer(fixture.officer, draft.id, { version: transferVersion, transferredAt: new Date().toISOString(), channel: "OFFICIAL_PORTAL", recipientReference: "Фиктивный адресат", registrationNumber: "TRANSFER-1", transferReference: "PORTAL-TEST", confirmedBy: fixture.officerId, result: "Передача только в тестовом контуре", legalBasis: "Тестовая регистрация передачи" });
    fixture.database.prepare("UPDATE exports SET expires_at = ? WHERE id = ?").run("2000-01-01T00:00:00.000Z", draft.id);
    const expired = expireExportArchivesAsSystem(fixture.database, fixture.paths.exports, auditKey, new Date("2026-08-09T12:00:00.000Z"));
    assert.equal(expired.deleted, 1);
    assert.equal(existsSync(archivePath), false);
    assert.equal(Number((fixture.database.prepare("SELECT COUNT(*) AS count FROM export_downloads WHERE export_id = ?").get(draft.id) as { count: number }).count), 1);
    assert.equal(Number((fixture.database.prepare("SELECT COUNT(*) AS count FROM export_transfers WHERE export_id = ?").get(draft.id) as { count: number }).count), 1);
    assert.equal((fixture.database.prepare("SELECT archive_sha256, stage4_status FROM exports WHERE id = ?").get(draft.id) as { archive_sha256: string; stage4_status: string }).stage4_status, "DELETED");
  } finally { fixture.close(); }
});

test("legal hold and policy checks block deletion while approved fixture deletion preserves consent and creates an act", async () => {
  const fixture = await stage4Fixture();
  try {
    const deletable = await addLead(fixture, "SP-20260101-CCC00001", { attachment: true });
    const blocked = await addLead(fixture, "SP-20260101-CCC00002", { attachment: false });
    const hold = createLegalHold(fixture.officer, { requestIds: [blocked.requestId], reason: "Фиктивное внутреннее расследование", basisDocument: "TEST-HOLD-1", reviewAt: "2030-01-01T00:00:00.000Z" });
    const dashboard = retentionDashboard(fixture.officer, new Date("2026-08-09T00:00:00.000Z"));
    assert.equal(dashboard.summary.expired, 2);
    assert.equal(dashboard.items.find((item) => item.requestId === blocked.requestId)?.blockers.includes("LEGAL_HOLD"), true);
    const scan = createDeletionScan(fixture.officer, { reason: "Плановая проверка сроков хранения фиктивных данных" }, new Date("2026-08-09T00:00:00.000Z"));
    assert.equal(scan.eligible, 1);
    assert.equal(scan.blocked, 1);
    assert.equal(existsSync(deletable.leadPath), true);
    await assert.rejects(() => executeDeletion(fixture.officer, scan.id, 1));
    const approval = approveDeletion(fixture.officer, scan.id, { version: 1, reason: "Утверждение удаления только разрешённого фиктивного кандидата" });
    const executed = await executeDeletion(fixture.officer, scan.id, approval.version);
    assert.equal(executed.deleted, 1);
    assert.equal(existsSync(deletable.leadPath), false);
    assert.equal(existsSync(blocked.leadPath), true);
    assert.equal(existsSync(deletable.consentPath), true);
    const verified = verifyDeletion(fixture.officer, scan.id, executed.version);
    assert.equal(verified.result, "DELETED");
    const act = fixture.database.prepare("SELECT document_path, document_sha256 FROM deletion_acts WHERE deletion_job_id = ?").get(scan.id) as { document_path: string; document_sha256: string };
    const document = await readFile(act.document_path);
    assert.equal(document.subarray(0, 2).toString("utf8"), "PK");
    assert.equal(createHash("sha256").update(document).digest("hex"), act.document_sha256);
    assert.throws(() => releaseLegalHold({ ...fixture.officer, session: { ...fixture.officer.session, stepUpUntil: null } }, hold.id, { version: 1, reason: "Нет повторной аутентификации" }), (error: unknown) => error instanceof PdStage4Error && error.code === "STEP_UP_REQUIRED");
    const released = releaseLegalHold(fixture.officer, hold.id, { version: 1, reason: "Фиктивное основание завершено после проверки" });
    assert.equal(released.status, "RELEASED");
    assert.equal(verifyAccessEventChain(fixture.database, auditKey).valid, true);
  } finally { fixture.close(); }
});

test("symlink deletion is refused and reported as partial", async () => {
  const fixture = await stage4Fixture();
  try {
    const lead = await addLead(fixture, "SP-20260101-DDD00001", { attachment: true });
    const outside = join(fixture.root, "outside.json");
    await writeFile(outside, "{}", { mode: 0o600 });
    const attachmentPath = join(fixture.paths.quarantine, lead.requestId, String(lead.storageId));
    await import("node:fs/promises").then(({ unlink }) => unlink(attachmentPath));
    await symlink(outside, attachmentPath);
    const scan = createDeletionScan(fixture.admin, { reason: "Фиктивная проверка защиты от symlink" }, new Date("2026-08-09T00:00:00.000Z"));
    const approval = approveDeletion(fixture.admin, scan.id, { version: 1, reason: "Тестовое подтверждение без production-данных" });
    const result = await executeDeletion(fixture.admin, scan.id, approval.version);
    assert.equal(result.partial, 1);
    assert.equal((await lstat(attachmentPath)).isSymbolicLink(), true);
    assert.equal(existsSync(lead.leadPath), true);
    const verified = verifyDeletion(fixture.admin, scan.id, result.version);
    assert.equal(verified.result, "PARTIALLY_DELETED");
  } finally { fixture.close(); }
});

test("CSV and XLSX neutralize formula injection without formula cells", () => {
  const csv = createCsv(["Значение"], [["=cmd|' /C calc'!A0"], ["  +SUM(1,1)"], ["обычный текст"]]).toString("utf8");
  assert.equal(csv.includes("\"'=cmd"), true);
  assert.equal(csv.includes("\"'  +SUM"), true);
  const workbook = zipEntries(createXlsx([{ name: "Проверка", rows: [["Значение"], ["@fixture"], ["-1+2"]] }]));
  const worksheet = workbook.get("xl/worksheets/sheet1.xml")?.toString("utf8") || "";
  assert.equal(worksheet.includes("&apos;@fixture"), true);
  assert.equal(worksheet.includes("&apos;-1+2"), true);
  assert.equal(worksheet.includes("<f>"), false);
});

test("incident and governance registries validate data and keep off-server backup warning", async () => {
  const fixture = await stage4Fixture();
  try {
    const lead = await addLead(fixture, "SP-20260101-EEE00001", { expired: false });
    assert.throws(() => createIncident(fixture.officer, { detectedAt: new Date().toISOString(), description: "Фиктивный инцидент", affectedSystems: "Тестовая система", dataCategories: "Технические данные", estimatedSubjects: "NaN", initialMeasures: "Изоляция тестового контура", legalBasis: "Тестовый регламент", requestIds: [lead.requestId] }), (error: unknown) => error instanceof PdStage4Error && error.code === "VALIDATION_ERROR");
    const incident = createIncident(fixture.officer, { detectedAt: new Date().toISOString(), description: "Фиктивный инцидент без реальной утечки", affectedSystems: "Тестовая система", dataCategories: "Технические метаданные", estimatedSubjects: 1, initialMeasures: "Изоляция тестового каталога", legalBasis: "Локальная проверка процесса", responsibleUserId: fixture.officerId, requestIds: [lead.requestId] });
    const updated = updateIncident(fixture.officer, incident.id, { version: 1, status: "ASSESSMENT", description: "Фиктивный инцидент оценивается", affectedSystems: "Тестовая система", dataCategories: "Технические метаданные", estimatedSubjects: 1, initialMeasures: "Изоляция и проверка", rknNotificationRequired: false, notificationAssessmentBasis: "Решение не принимается автоматически; проведена фиктивная оценка", responsibleUserId: fixture.officerId, legalBasis: "Локальная проверка процесса" });
    const closed = closeIncident(fixture.officer, incident.id, { version: updated.version, investigationResult: "Реальные данные не затронуты", remediation: "Тестовые файлы изолированы", legalBasis: "Фиктивная проверка завершена" });
    assert.equal(closed.status, "CLOSED");

    const system = createSystem(fixture.officer, { systemName: "Fixture storage", purpose: "Локальные тесты", provider: "Не применяется", databaseCountry: "Россия", dataCategories: "Фиктивные данные", legalBasis: "Тестовый регламент", agreementReference: "Не применяется", retentionDescription: "До завершения теста", responsibleUser: "Тестовый ответственный", administrators: "Тестовая группа", mfaStatus: "Не применяется", exportMethod: "Локальный fixture", deletionMethod: "Удаление временного каталога", status: "TEST_ONLY" });
    const systemUpdated = updateSystem(fixture.officer, system.id, { version: 1, purpose: "Локальные архитектурные тесты", provider: "Не применяется", databaseCountry: "Россия", dataCategories: "Фиктивные данные", legalBasis: "Тестовый регламент", agreementReference: "Не применяется", retentionDescription: "До завершения теста", responsibleUser: "Тестовый ответственный", administrators: "Тестовая группа", mfaStatus: "Не применяется", exportMethod: "Локальный fixture", deletionMethod: "Удаление временного каталога", status: "TEST_ONLY" });
    assert.equal(systemUpdated.version, 2);
    const document = registerLegalDocumentVersion(fixture.officer, { documentType: "PRIVACY_POLICY", version: "fixture-1", effectiveFrom: "2026-08-09", contentSha256: "a".repeat(64), status: "DRAFT", approvalBasis: "Только локальная тестовая версия" });
    assert.ok(document.id);
    const backup = registerBackup(fixture.officer, { startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), backupType: "FIXTURE", status: "PASS", destinationType: "LOCAL_SAME_VPS", encrypted: true, archiveSha256: "b".repeat(64), filesCount: 3, totalBytes: 1024, legalBasis: "Регистрация фиктивной резервной копии" });
    registerRestoreTest(fixture.officer, backup.id, { version: 1, result: "PASS", filesVerified: 3, isolatedTarget: "Изолированный временный fixture", notes: "Production не затрагивался", legalBasis: "Фиктивная проверка восстановления" });
    const backups = listBackups(fixture.officer);
    assert.equal(backups.status.localEncrypted, "PASS");
    assert.equal(backups.status.localRestore, "PASS");
    assert.equal(backups.status.independentOffServer, "NOT_CONFIGURED");
    assert.equal(backups.status.overall, "PARTIAL_READINESS");
  } finally { fixture.close(); }
});
