import { createHash } from "node:crypto";
import { constants, chmodSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { assertPdPermission } from "@/lib/pd-admin/auth/permissions";
import { isStepUpActive } from "@/lib/pd-admin/auth/session";
import { recordAccessEventInTransaction } from "@/lib/pd-admin/audit/chain";
import { resolveProtectedFile } from "@/lib/pd-admin/storage/safe-files";
import { assertChanged, auditedTransaction, newStage4Id, nowIso, PdStage4Error, positiveVersion, requiredText, stage4Id } from "@/lib/pd-admin/stage4/common";
import { legalOperator } from "@/lib/legal";
import { createDocx } from "@/lib/pd-admin/export/archive";

type CandidateRow = { request_id: string; expires_at: string; storage_path_type: "quote-leads" | "assistant-leads"; integrity_status: string; internal_status: string; retention_override_until: string | null };
type CandidateAssessment = { requestId: string; expiresAt: string; consentExpiresAt: string | null; blockers: string[]; eligible: boolean };

const openSubject = ["RECEIVED", "IDENTITY_REQUIRED", "IDENTITY_VERIFICATION", "IN_PROGRESS", "RESPONSE_PREPARED", "APPROVAL_REQUIRED", "EXTENDED"];
const openAuthority = ["RECEIVED", "VERIFICATION_REQUIRED", "VERIFIED", "IN_PROGRESS", "PACKAGE_PREPARED", "APPROVAL_REQUIRED", "READY_TO_TRANSFER", "TRANSFERRED"];

function rootFor(storage: CandidateRow["storage_path_type"]) {
  return resolve(storage === "quote-leads" ? process.env.QUOTE_STORAGE_PATH || ".data/quote-leads" : process.env.ASSISTANT_LEAD_STORAGE_PATH || ".data/assistant-leads");
}
function quarantineRoot() { return resolve(process.env.UPLOAD_QUARANTINE_PATH || ".data/quarantine"); }

function inList(values: string[]) { return values.map(() => "?").join(","); }

function assessCandidate(database: DatabaseSync, row: CandidateRow, now: Date): CandidateAssessment {
  const requestId = row.request_id; const blockers: string[] = [];
  const scalar = (sql: string, ...params: Array<string | number>) => Number((database.prepare(sql).get(...params) as { count: number }).count);
  if (Date.parse(row.expires_at) > now.getTime()) blockers.push("NOT_EXPIRED");
  if (row.retention_override_until && Date.parse(row.retention_override_until) > now.getTime()) blockers.push("RETENTION_OVERRIDE");
  if (row.internal_status === "CONTRACT") blockers.push("CONTRACT_BASIS");
  if (row.integrity_status !== "OK") blockers.push("INTEGRITY_MISMATCH");
  if (scalar(`SELECT COUNT(*) AS count FROM legal_hold_leads l JOIN legal_holds h ON h.id = l.legal_hold_id WHERE l.request_id = ? AND h.stage4_status IN ('ACTIVE','REVIEW_REQUIRED')`, requestId)) blockers.push("LEGAL_HOLD");
  if (scalar(`SELECT COUNT(*) AS count FROM subject_request_leads l JOIN subject_requests s ON s.registration_number = l.registration_number WHERE l.request_id = ? AND s.stage4_status IN (${inList(openSubject)})`, requestId, ...openSubject)) blockers.push("OPEN_SUBJECT_REQUEST");
  if (scalar(`SELECT COUNT(*) AS count FROM authority_request_leads l JOIN authority_requests a ON a.id = l.authority_request_id WHERE l.request_id = ? AND a.status IN (${inList(openAuthority)})`, requestId, ...openAuthority)) blockers.push("OPEN_AUTHORITY_REQUEST");
  if (scalar(`SELECT COUNT(*) AS count FROM incident_leads l JOIN incidents i ON i.id = l.incident_id WHERE l.request_id = ? AND i.stage4_status != 'CLOSED'`, requestId)) blockers.push("OPEN_INCIDENT");
  if (scalar(`SELECT COUNT(*) AS count FROM lead_operation_locks WHERE request_id = ? AND operation_type = 'EXPORT' AND expires_at > ?`, requestId, now.toISOString())) blockers.push("EXPORT_LOCK");
  const exports = database.prepare(`SELECT preview_json FROM exports WHERE stage4_status IN ('PREVIEW_READY','APPROVAL_REQUIRED','BUILDING','READY','DOWNLOADED','TRANSFERRED') AND preview_json IS NOT NULL`).all() as Array<{ preview_json: string }>;
  if (exports.some((item) => { try { return (JSON.parse(item.preview_json) as { requestIds?: string[] }).requestIds?.includes(requestId); } catch { return false; } })) blockers.push("ACTIVE_EXPORT");
  const consent = database.prepare("SELECT retention_days, created_at FROM lead_index WHERE request_id = ?").get(requestId) as { retention_days: number; created_at: string };
  const consentRetention = Number(process.env.CONSENT_AUDIT_RETENTION_DAYS || consent.retention_days);
  const consentExpiresAt = new Date(Date.parse(consent.created_at) + consentRetention * 86_400_000).toISOString();
  return { requestId, expiresAt: row.expires_at, consentExpiresAt, blockers: [...new Set(blockers)], eligible: blockers.length === 0 };
}

function retentionRows(database: DatabaseSync, now: Date) {
  const rows = database.prepare(`SELECT li.request_id, li.expires_at, li.storage_path_type, li.integrity_status,
    lw.internal_status, lw.retention_override_until FROM lead_index li JOIN lead_workflow lw ON lw.request_id = li.request_id
    WHERE li.deleted_at IS NULL ORDER BY li.expires_at`).all() as CandidateRow[];
  return rows.map((row) => assessCandidate(database, row, now));
}

export function retentionDashboard(context: PdAuthContext, now = new Date()) {
  assertPdPermission(context.user.role, "VIEW_RETENTION"); const items = retentionRows(context.database, now);
  const days = (value: string) => (Date.parse(value) - now.getTime()) / 86_400_000;
  return {
    summary: {
      expires30Days: items.filter((item) => days(item.expiresAt) > 7 && days(item.expiresAt) <= 30).length,
      expires7Days: items.filter((item) => days(item.expiresAt) >= 0 && days(item.expiresAt) <= 7).length,
      expired: items.filter((item) => days(item.expiresAt) < 0).length,
      blocked: items.filter((item) => item.blockers.length > 0).length,
      candidates: items.filter((item) => item.eligible).length,
    }, items: items.slice(0, 500), truncated: items.length > 500,
  };
}

export function listDeletionJobs(context: PdAuthContext, page = 1) {
  assertPdPermission(context.user.role, "VIEW_RETENTION"); const safePage = Math.max(1, Math.floor(page)); const pageSize = 30;
  const total = Number((context.database.prepare("SELECT COUNT(*) AS count FROM deletion_jobs").get() as { count: number }).count);
  const items = context.database.prepare(`SELECT id, stage4_mode, stage4_status, started_at, completed_at, started_by, approved_by,
    candidates_count, deleted_count, skipped_count, report_sha256, act_sha256, approval_self_used, version
    FROM deletion_jobs ORDER BY started_at DESC LIMIT ? OFFSET ?`).all(pageSize, (safePage - 1) * pageSize);
  return { page: safePage, pageSize, total, items };
}

export function getDeletionJob(context: PdAuthContext, idValue: string): Record<string, unknown> & { candidates: Array<Record<string, unknown>>; act: Record<string, unknown> | null } {
  assertPdPermission(context.user.role, "VIEW_RETENTION"); const id = stage4Id(idValue);
  const row = context.database.prepare(`SELECT id, stage4_mode, stage4_status, started_at, completed_at, started_by, approved_by,
    candidates_count, deleted_count, skipped_count, report_sha256, act_sha256, approval_self_used, failure_reason, version FROM deletion_jobs WHERE id = ?`).get(id);
  if (!row) throw new PdStage4Error("NOT_FOUND"); const candidates = context.database.prepare("SELECT request_id, expires_at, consent_expires_at, blockers_json, status, reason, updated_at FROM deletion_candidates WHERE deletion_job_id = ? ORDER BY request_id").all(id);
  const act = context.database.prepare("SELECT id, act_number, created_at, basis, files_count, method, result, report_sha256, document_sha256 FROM deletion_acts WHERE deletion_job_id = ?").get(id);
  return { ...(row as Record<string, unknown>), candidates: candidates as Array<Record<string, unknown>>, act: act ? act as Record<string, unknown> : null };
}

export function createDeletionScan(context: PdAuthContext, input: Record<string, unknown>, now = new Date()) {
  assertPdPermission(context.user.role, "CREATE_DELETION_SCAN"); const id = newStage4Id(); const basis = requiredText(input.reason, 8, 1_000); const startedAt = now.toISOString();
  const assessed = retentionRows(context.database, now).filter((item) => Date.parse(item.expiresAt) <= now.getTime());
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "DELETION_SCAN_CREATED", targetType: "DELETION_JOB", targetId: id,
    legalBasis: basis, result: "SUCCESS", ipHash: context.ipHash, metadata: { count: assessed.length, status: "CANDIDATES" },
  }, (database) => {
    database.prepare(`INSERT INTO deletion_jobs(id, mode, stage4_mode, status, stage4_status, started_at, started_by, candidates_count,
      skipped_count, updated_at, version) VALUES (?, 'DRY_RUN', 'DRY_RUN', 'CANDIDATES', 'CANDIDATES', ?, ?, ?, ?, ?, 1)`)
      .run(id, startedAt, context.user.id, assessed.length, assessed.filter((item) => !item.eligible).length, startedAt);
    const insert = database.prepare(`INSERT INTO deletion_candidates(id, deletion_job_id, request_id, expires_at, consent_expires_at,
      blockers_json, status, reason, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const item of assessed) insert.run(newStage4Id(), id, item.requestId, item.expiresAt, item.consentExpiresAt, JSON.stringify(item.blockers), item.eligible ? "CANDIDATE" : "BLOCKED", basis, startedAt, startedAt);
    return { id, mode: "DRY_RUN", candidates: assessed.length, eligible: assessed.filter((item) => item.eligible).length, blocked: assessed.filter((item) => !item.eligible).length, version: 1 };
  });
}

export function approveDeletion(context: PdAuthContext, idValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "APPROVE_DELETION"); if (!isStepUpActive(context.session.stepUpUntil)) throw new PdStage4Error("STEP_UP_REQUIRED");
  const id = stage4Id(idValue); const version = positiveVersion(input.version); const now = nowIso(); const basis = requiredText(input.reason, 8, 1_000);
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "DELETION_APPROVED", targetType: "DELETION_JOB", targetId: id,
    legalBasis: basis, result: "SUCCESS", ipHash: context.ipHash, metadata: { status: "HUMAN_APPROVAL", version },
  }, (database) => {
    const job = database.prepare("SELECT started_by FROM deletion_jobs WHERE id = ? AND version = ? AND stage4_status = 'CANDIDATES'").get(id, version) as { started_by: string } | undefined;
    if (!job) throw new PdStage4Error("CONFLICT");
    const eligible = Number((database.prepare("SELECT COUNT(*) AS count FROM deletion_candidates WHERE deletion_job_id = ? AND status = 'CANDIDATE' AND blockers_json = '[]'").get(id) as { count: number }).count);
    if (!eligible) throw new PdStage4Error("BLOCKED"); const self = job.started_by === context.user.id;
    database.prepare("UPDATE deletion_candidates SET status = 'APPROVED', updated_at = ? WHERE deletion_job_id = ? AND status = 'CANDIDATE' AND blockers_json = '[]'").run(now, id);
    const result = database.prepare(`UPDATE deletion_jobs SET mode = 'APPLY', stage4_mode = 'APPROVED_DELETE', status = 'HUMAN_APPROVAL',
      stage4_status = 'HUMAN_APPROVAL', approved_by = ?, approved_at = ?, step_up_verified_at = ?, approval_self_used = ?, updated_at = ?, version = version + 1
      WHERE id = ? AND version = ?`).run(context.user.id, now, now, self ? 1 : 0, now, id, version);
    if (Number(result.changes) !== 1) throw new PdStage4Error("CONFLICT"); return { id, approved: eligible, selfApproval: self, version: version + 1 };
  });
}

async function deleteCandidateFiles(row: CandidateRow) {
  const targets: string[] = []; const deleted: string[] = []; let quarantineDirectory: string | null = null;
  try { targets.push(await resolveProtectedFile(rootFor(row.storage_path_type), [`${row.request_id}.json`])); } catch { return { deleted, partial: true }; }
  if (existsSync(resolve(quarantineRoot(), row.request_id))) {
    const directory = resolve(quarantineRoot(), row.request_id); const node = lstatSync(directory);
    if (!node.isDirectory() || node.isSymbolicLink()) return { deleted, partial: true };
    quarantineDirectory = directory;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || entry.isSymbolicLink()) return { deleted, partial: true };
      try { targets.push(await resolveProtectedFile(quarantineRoot(), [row.request_id, entry.name])); } catch { return { deleted, partial: true }; }
    }
  }
  let partial = false;
  for (const path of targets) {
    try { unlinkSync(path); deleted.push(path); } catch { partial = true; break; }
  }
  if (quarantineDirectory) {
    try { if (!readdirSync(quarantineDirectory).length) rmdirSync(quarantineDirectory); else partial = true; } catch { partial = true; }
  }
  return { deleted, partial };
}

export async function executeDeletion(context: PdAuthContext, idValue: string, versionValue: unknown) {
  assertPdPermission(context.user.role, "EXECUTE_DELETION"); if (!isStepUpActive(context.session.stepUpUntil)) throw new PdStage4Error("STEP_UP_REQUIRED");
  const id = stage4Id(idValue); const version = positiveVersion(versionValue); const now = new Date();
  const job = context.database.prepare("SELECT approved_by FROM deletion_jobs WHERE id = ? AND version = ? AND stage4_status = 'HUMAN_APPROVAL' AND stage4_mode = 'APPROVED_DELETE'").get(id, version);
  if (!job) throw new PdStage4Error("CONFLICT"); const approved = context.database.prepare("SELECT request_id FROM deletion_candidates WHERE deletion_job_id = ? AND status = 'APPROVED'").all(id) as Array<{ request_id: string }>;
  auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "DELETION_STARTED", targetType: "DELETION_JOB", targetId: id,
    legalBasis: "APPROVED_RETENTION_DELETION", result: "SUCCESS", ipHash: context.ipHash, metadata: { count: approved.length, status: "DELETING" },
  }, (database) => {
    database.prepare("DELETE FROM lead_operation_locks WHERE expires_at <= ?").run(now.toISOString());
    const lock = database.prepare("INSERT INTO lead_operation_locks(request_id, operation_type, operation_id, acquired_at, expires_at, acquired_by) VALUES (?, 'DELETE', ?, ?, ?, ?)");
    const expires = new Date(now.getTime() + 30 * 60_000).toISOString(); for (const row of approved) { try { lock.run(row.request_id, id, now.toISOString(), expires, context.user.id); } catch { throw new PdStage4Error("CONFLICT"); } }
    database.prepare(`UPDATE deletion_jobs SET status = 'DELETING', stage4_status = 'DELETING', updated_at = ?, version = version + 1 WHERE id = ?`).run(now.toISOString(), id);
    database.prepare("UPDATE deletion_candidates SET status = 'LOCKED', updated_at = ? WHERE deletion_job_id = ? AND status = 'APPROVED'").run(now.toISOString(), id);
  });
  let deletedCount = 0; let partialCount = 0; let skippedCount = 0;
  for (const item of approved) {
    const row = context.database.prepare(`SELECT li.request_id, li.expires_at, li.storage_path_type, li.integrity_status, lw.internal_status, lw.retention_override_until
      FROM lead_index li JOIN lead_workflow lw ON lw.request_id = li.request_id WHERE li.request_id = ? AND li.deleted_at IS NULL`).get(item.request_id) as CandidateRow | undefined;
    if (!row) { skippedCount += 1; continue; }
    const reassessed = assessCandidate(context.database, row, new Date());
    if (!reassessed.eligible) {
      context.database.prepare("UPDATE deletion_candidates SET status = 'BLOCKED', blockers_json = ?, updated_at = ? WHERE deletion_job_id = ? AND request_id = ?")
        .run(JSON.stringify(reassessed.blockers), nowIso(), id, row.request_id); skippedCount += 1; continue;
    }
    const outcome = await deleteCandidateFiles(row); const deletedAt = nowIso(); const result = outcome.partial ? "PARTIALLY_DELETED" : "DELETED";
    context.database.exec("BEGIN IMMEDIATE");
    try {
      if (!outcome.partial) context.database.prepare("UPDATE lead_index SET deleted_at = ? WHERE request_id = ?").run(deletedAt, row.request_id);
      context.database.prepare("UPDATE lead_workflow SET internal_status = ?, updated_at = ?, updated_by = ? WHERE request_id = ?")
        .run(outcome.partial ? "PENDING_DELETION" : "DELETED", deletedAt, context.user.id, row.request_id);
      context.database.prepare(`INSERT INTO deletion_records(id, deletion_job_id, request_id, data_category, reason, deleted_paths_json,
        preserved_records_json, method, result, deleted_at, executed_by, report_hash, verification_status)
        VALUES (?, ?, ?, 'LEAD_AND_ATTACHMENTS', 'RETENTION_EXPIRED', ?, ?, 'CONTROLLED_FILE_DELETE', ?, ?, ?, ?, 'PENDING')`)
        .run(newStage4Id(), id, row.request_id, JSON.stringify(outcome.deleted), JSON.stringify(["access_events", "deletion_records", "legal_history", "consent_audit_until_own_expiry"]), result, deletedAt, context.user.id, createHash("sha256").update(JSON.stringify(outcome.deleted)).digest("hex"));
      context.database.prepare("UPDATE deletion_candidates SET status = ?, updated_at = ? WHERE deletion_job_id = ? AND request_id = ?").run(result, deletedAt, id, row.request_id);
      context.database.prepare("DELETE FROM lead_operation_locks WHERE request_id = ? AND operation_type = 'DELETE' AND operation_id = ?").run(row.request_id, id);
      if (!context.config.auditChainKey) throw new Error("Audit unavailable");
      recordAccessEventInTransaction(context.database, { userId: context.user.id, sessionId: context.session.id, action: outcome.partial ? "DELETION_ITEM_SKIPPED" : "DELETION_ITEM_DELETED", targetType: "LEAD", targetId: row.request_id, legalBasis: "RETENTION_EXPIRED", result, ipHash: context.ipHash, metadata: { files: outcome.deleted.length, status: result } }, context.config.auditChainKey);
      context.database.exec("COMMIT");
    } catch (error) { context.database.exec("ROLLBACK"); throw error; }
    if (outcome.partial) partialCount += 1; else deletedCount += 1;
  }
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: partialCount || skippedCount ? "DELETION_FAILED" : "DELETION_COMPLETED", targetType: "DELETION_JOB", targetId: id,
    legalBasis: "APPROVED_RETENTION_DELETION", result: partialCount || skippedCount ? "PARTIAL" : "SUCCESS", ipHash: context.ipHash,
    metadata: { count: deletedCount, items: partialCount + skippedCount, status: "VERIFYING" },
  }, (database) => {
    database.prepare(`UPDATE deletion_jobs SET status = 'VERIFYING', stage4_status = 'VERIFYING', deleted_count = ?, skipped_count = skipped_count + ?,
      updated_at = ?, version = version + 1 WHERE id = ?`).run(deletedCount, partialCount + skippedCount, nowIso(), id);
    database.prepare("DELETE FROM lead_operation_locks WHERE operation_type = 'DELETE' AND operation_id = ?").run(id);
    return { id, deleted: deletedCount, partial: partialCount, skipped: skippedCount, version: version + 2 };
  });
}

function protectedReportDirectory(context: PdAuthContext) {
  const path = resolve(dirname(context.databasePath), "deletion-reports"); mkdirSync(path, { recursive: true, mode: 0o700 });
  const stat = lstatSync(path); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new PdStage4Error("BLOCKED"); chmodSync(path, 0o700); return path;
}

function writeProtected(path: string, content: Buffer) {
  const fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { writeFileSync(fd, content); } finally { closeSync(fd); } chmodSync(path, 0o600);
}

export function verifyDeletion(context: PdAuthContext, idValue: string, versionValue: unknown) {
  assertPdPermission(context.user.role, "VERIFY_DELETION"); const id = stage4Id(idValue); const version = positiveVersion(versionValue); const now = nowIso();
  const job = context.database.prepare("SELECT started_at, approved_by, deleted_count, skipped_count FROM deletion_jobs WHERE id = ? AND version = ? AND stage4_status = 'VERIFYING'").get(id, version) as Record<string, unknown> | undefined;
  if (!job) throw new PdStage4Error("CONFLICT"); const records = context.database.prepare("SELECT id, request_id, deleted_paths_json, result FROM deletion_records WHERE deletion_job_id = ?").all(id) as Array<{ id: string; request_id: string; deleted_paths_json: string; result: string }>;
  const verification = records.map((record) => {
    const paths = JSON.parse(record.deleted_paths_json) as string[]; const present = paths.filter((path) => existsSync(path));
    const index = context.database.prepare("SELECT deleted_at FROM lead_index WHERE request_id = ?").get(record.request_id) as { deleted_at: string | null } | undefined;
    return { ...record, verified: record.result === "DELETED" && present.length === 0 && Boolean(index?.deleted_at), remaining: present.length };
  });
  const failed = verification.filter((item) => !item.verified); const report = {
    operator: legalOperator.name, deletionJobId: id, verifiedAt: now, items: verification.map((item) => ({ requestId: item.request_id, result: item.verified ? "VERIFIED" : "FAILED", remaining: item.remaining })),
    preserved: ["access_events", "deletion_records", "legal_history", "export_history", "request_history", "incident_history", "consent_audit_until_own_expiry"],
  };
  const directory = protectedReportDirectory(context); const reportContent = Buffer.from(`${JSON.stringify(report, null, 2)}\n`); const reportSha = createHash("sha256").update(reportContent).digest("hex");
  const reportPath = resolve(directory, `${id}.report.json`); writeProtected(reportPath, reportContent);
  const actId = newStage4Id(); const actNumber = `SP-DEL-${now.slice(0, 10).replaceAll("-", "")}-${id.slice(0, 8).toUpperCase()}`;
  const actDocument = createDocx([
    "Акт уничтожения персональных данных", `Оператор: ${legalOperator.name}, ИНН ${legalOperator.inn}, ОГРН ${legalOperator.ogrn}`,
    `Номер: ${actNumber}`, `Дата: ${now}`, `Основание: истечение утверждённого срока хранения; deletion job ${id}`,
    `Категории: заявки и связанные вложения. Количество записей: ${records.length}.`,
    `Результат проверки: ${failed.length ? "имеются исключения" : "подтверждено"}.`,
    "Сохранены обязательные служебные журналы и consent-audit до собственного срока.",
    `SHA-256 отчёта: ${reportSha}`, "Исполнитель: ____________________", "Проверяющий: ____________________",
  ]);
  const actPath = resolve(directory, `${id}.act.docx`); let actWritten = false;
  try {
    writeProtected(actPath, actDocument); actWritten = true;
    const actSha = createHash("sha256").update(actDocument).digest("hex");
    return auditedTransaction(context, {
      userId: context.user.id, sessionId: context.session.id, action: "DELETION_ACT_CREATED", targetType: "DELETION_JOB", targetId: id,
      legalBasis: "DELETION_VERIFICATION", result: failed.length ? "PARTIAL" : "SUCCESS", ipHash: context.ipHash, metadata: { count: records.length, items: failed.length, status: failed.length ? "PARTIALLY_COMPLETED" : "COMPLETED" },
    }, (database) => {
      const updateRecord = database.prepare("UPDATE deletion_records SET verification_status = ?, verified_at = ?, verified_by = ?, act_id = ? WHERE id = ?");
      for (const item of verification) updateRecord.run(item.verified ? "VERIFIED" : "FAILED", now, context.user.id, actId, item.id);
      database.prepare(`INSERT INTO deletion_acts(id, deletion_job_id, act_number, created_at, basis, categories_json, request_ids_json,
        files_count, method, executed_by, verified_by, result, preserved_records_json, exceptions_json, report_sha256, document_path, document_sha256)
        VALUES (?, ?, ?, ?, 'RETENTION_EXPIRED', '["LEAD_AND_ATTACHMENTS"]', ?, ?, 'CONTROLLED_FILE_DELETE', ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(actId, id, actNumber, now, JSON.stringify(records.map((record) => record.request_id)), records.length, context.user.id, context.user.id,
          failed.length ? "PARTIALLY_DELETED" : "DELETED", JSON.stringify(report.preserved), JSON.stringify(failed.map((item) => item.request_id)), reportSha, actPath, actSha);
      const updated = database.prepare(`UPDATE deletion_jobs SET status = ?, stage4_status = ?, completed_at = ?, report_path = ?, report_sha256 = ?, act_path = ?, act_sha256 = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`)
        .run(failed.length ? "FAILED" : "COMPLETED", failed.length ? "PARTIALLY_COMPLETED" : "COMPLETED", now, reportPath, reportSha, actPath, actSha, now, id, version);
      assertChanged(updated.changes);
      return { id, result: failed.length ? "PARTIALLY_DELETED" : "DELETED", reportSha256: reportSha, actSha256: actSha, version: version + 1 };
    });
  } catch (error) {
    if (actWritten && existsSync(actPath)) unlinkSync(actPath);
    if (existsSync(reportPath)) unlinkSync(reportPath);
    throw error;
  }
}
