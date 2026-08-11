import { constants, chmodSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { assertPdPermission } from "@/lib/pd-admin/auth/permissions";
import { isStepUpActive } from "@/lib/pd-admin/auth/session";
import { contactHmac } from "@/lib/pd-admin/contacts";
import { createCsv, createStoredZip, createXlsx, sha256Buffer, type ZipEntry } from "@/lib/pd-admin/export/archive";
import { assertExportPreviewIsBounded, assertMetadataExcludesFinalArchiveHash, assertSelectiveExportFilter } from "@/lib/pd-admin/export/policy";
import { exportCategories, officialExportTypes, type EmbeddedExportMetadata, type ExportCategory, type ExportDraftInput, type ExportFilter, type ExportPreview } from "@/lib/pd-admin/export/types";
import { auditIdPattern, openProtectedAttachment, readProtectedJson, requestIdPattern, resolveProtectedFile } from "@/lib/pd-admin/storage/safe-files";
import { auditedTransaction, enumValue, isoDate, newStage4Id, nowIso, optionalStage4Id, optionalText, PdStage4Error, positiveVersion, requiredText, stage4Id, stringArray } from "@/lib/pd-admin/stage4/common";
import { legalOperator } from "@/lib/legal";
import { recordAccessEvent, recordAccessEventInTransaction } from "@/lib/pd-admin/audit/chain";

type LeadRow = { request_id: string; source: string; created_at: string; storage_path_type: "quote-leads" | "assistant-leads"; files_count: number; integrity_status: string };
type ProtectedLead = { requestId?: unknown; source?: unknown; createdAt?: unknown; files?: unknown; consentAudit?: unknown } & Record<string, unknown>;

function prepareExportRoot(root: string) {
  mkdirSync(root, { recursive: true, mode: 0o700 }); const node = lstatSync(root);
  if (!node.isDirectory() || node.isSymbolicLink()) throw new PdStage4Error("BLOCKED"); chmodSync(root, 0o700);
}

function leadRoot(storage: LeadRow["storage_path_type"]) {
  return resolve(storage === "quote-leads" ? process.env.QUOTE_STORAGE_PATH || ".data/quote-leads" : process.env.ASSISTANT_LEAD_STORAGE_PATH || ".data/assistant-leads");
}

function quarantineRoot() { return resolve(process.env.UPLOAD_QUARANTINE_PATH || ".data/quarantine"); }
function consentRoot() { return resolve(process.env.CONSENT_AUDIT_STORAGE_PATH || ".data/consent-audit"); }

function readDraftInput(context: PdAuthContext, input: Record<string, unknown>): ExportDraftInput {
  const type = enumValue(input.type, officialExportTypes); const categories = stringArray(input.categories, exportCategories.length)
    .map((item) => enumValue(item, exportCategories));
  if (!categories.length) throw new PdStage4Error("VALIDATION_ERROR");
  const rawFilter = input.filter && typeof input.filter === "object" && !Array.isArray(input.filter) ? input.filter as Record<string, unknown> : input;
  const filter: ExportFilter = {};
  if (rawFilter.requestIds !== undefined) {
    const values = stringArray(rawFilter.requestIds, 500); if (values.some((value) => !requestIdPattern.test(value))) throw new PdStage4Error("VALIDATION_ERROR"); filter.requestIds = [...new Set(values)];
  }
  if (rawFilter.subjectRequestId) filter.subjectRequestId = stage4Id(rawFilter.subjectRequestId);
  if (rawFilter.authorityRequestId) filter.authorityRequestId = stage4Id(rawFilter.authorityRequestId);
  if (rawFilter.phone) {
    if (!context.config.searchHmacKey) throw new PdStage4Error("BLOCKED");
    filter.phoneHmac = contactHmac("phone", requiredText(rawFilter.phone, 5, 80), context.config.searchHmacKey, context.config.searchHmacKeyVersion) || undefined;
  }
  if (rawFilter.email) {
    if (!context.config.searchHmacKey) throw new PdStage4Error("BLOCKED");
    filter.emailHmac = contactHmac("email", requiredText(rawFilter.email, 5, 320), context.config.searchHmacKey, context.config.searchHmacKeyVersion) || undefined;
  }
  if (rawFilter.createdFrom) filter.createdFrom = isoDate(rawFilter.createdFrom);
  if (rawFilter.createdTo) filter.createdTo = isoDate(rawFilter.createdTo);
  if (rawFilter.sources !== undefined) filter.sources = stringArray(rawFilter.sources, 2).map((value) => enumValue(value, ["quote-form", "engineering-assistant"] as const));
  const subjectRequestId = input.subjectRequestId ? stage4Id(input.subjectRequestId) : null;
  const authorityRequestId = input.authorityRequestId ? stage4Id(input.authorityRequestId) : null;
  if (subjectRequestId && authorityRequestId) throw new PdStage4Error("VALIDATION_ERROR");
  if (type === "SUBJECT_REQUEST" && !subjectRequestId) throw new PdStage4Error("VALIDATION_ERROR");
  if (type === "AUTHORITY_REQUEST" && !authorityRequestId) throw new PdStage4Error("VALIDATION_ERROR");
  if (subjectRequestId) {
    if (filter.subjectRequestId && filter.subjectRequestId !== subjectRequestId) throw new PdStage4Error("VALIDATION_ERROR");
    filter.subjectRequestId = subjectRequestId;
  }
  if (authorityRequestId) {
    if (filter.authorityRequestId && filter.authorityRequestId !== authorityRequestId) throw new PdStage4Error("VALIDATION_ERROR");
    filter.authorityRequestId = authorityRequestId;
  }
  assertSelectiveExportFilter(filter);
  return {
    type, authorityName: optionalText(input.authorityName, 300), requestNumber: requiredText(input.requestNumber, 2, 120), requestDate: isoDate(input.requestDate),
    legalBasis: requiredText(input.legalBasis, 8, 2_000), filter, categories, responsibleUserId: stage4Id(input.responsibleUserId),
    approvingUserId: stage4Id(input.approvingUserId), subjectRequestId, authorityRequestId,
  };
}

function selectedRows(database: DatabaseSync, filter: ExportFilter) {
  const selectorSets: Array<Set<string>> = [];
  if (filter.requestIds?.length) selectorSets.push(new Set(filter.requestIds));
  if (filter.subjectRequestId) {
    const subject = database.prepare("SELECT registration_number FROM subject_requests WHERE id = ?").get(filter.subjectRequestId) as { registration_number: string } | undefined;
    const ids = subject ? database.prepare("SELECT request_id FROM subject_request_leads WHERE registration_number = ?").all(subject.registration_number) as Array<{ request_id: string }> : [];
    selectorSets.push(new Set(ids.map((row) => row.request_id)));
  }
  if (filter.authorityRequestId) {
    const ids = database.prepare("SELECT request_id FROM authority_request_leads WHERE authority_request_id = ?").all(filter.authorityRequestId) as Array<{ request_id: string }>;
    selectorSets.push(new Set(ids.map((row) => row.request_id)));
  }
  const requestIds = selectorSets.length ? [...selectorSets.slice(1).reduce((intersection, set) => new Set([...intersection].filter((id) => set.has(id))), selectorSets[0])] : [];
  const clauses = ["deleted_at IS NULL"]; const values: Array<string | number> = [];
  if (selectorSets.length && !requestIds.length) return [];
  if (requestIds.length) { clauses.push(`request_id IN (${requestIds.map(() => "?").join(",")})`); values.push(...requestIds); }
  if (filter.phoneHmac) { clauses.push("phone_hmac = ?"); values.push(filter.phoneHmac); }
  if (filter.emailHmac) { clauses.push("email_hmac = ?"); values.push(filter.emailHmac); }
  if (filter.createdFrom) { clauses.push("created_at >= ?"); values.push(filter.createdFrom); }
  if (filter.createdTo) { clauses.push("created_at <= ?"); values.push(filter.createdTo); }
  if (filter.sources?.length) { clauses.push(`source IN (${filter.sources.map(() => "?").join(",")})`); values.push(...filter.sources); }
  return database.prepare(`SELECT request_id, source, created_at, storage_path_type, files_count, integrity_status FROM lead_index WHERE ${clauses.join(" AND ")} ORDER BY created_at LIMIT 501`)
    .all(...values) as LeadRow[];
}

function selectedRowsByApprovedIds(database: DatabaseSync, requestIds: string[]) {
  if (!requestIds.length) return [];
  const placeholders = requestIds.map(() => "?").join(",");
  return database.prepare(`SELECT request_id, source, created_at, storage_path_type, files_count, integrity_status
    FROM lead_index WHERE deleted_at IS NULL AND request_id IN (${placeholders}) ORDER BY created_at`).all(...requestIds) as LeadRow[];
}

function archiveFilter(filter: ExportFilter) {
  return {
    requestIds: filter.requestIds,
    subjectRequestId: filter.subjectRequestId,
    authorityRequestId: filter.authorityRequestId,
    phoneExactMatchApplied: Boolean(filter.phoneHmac),
    emailExactMatchApplied: Boolean(filter.emailHmac),
    createdFrom: filter.createdFrom,
    createdTo: filter.createdTo,
    sources: filter.sources,
  };
}

async function leadSize(row: LeadRow) {
  try { const path = await resolveProtectedFile(leadRoot(row.storage_path_type), [`${row.request_id}.json`]); return (await stat(path)).size; } catch { return 0; }
}

async function readLead(row: LeadRow) { return readProtectedJson<ProtectedLead>(leadRoot(row.storage_path_type), row.request_id); }

async function findConsentRecords(requestIds: Set<string>) {
  const root = consentRoot(); const result: Array<{ auditId: string; requestId: string; record: Record<string, unknown> }> = [];
  for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) continue;
    const auditId = basename(entry.name, ".json"); if (!auditIdPattern.test(auditId)) continue;
    try { const record = await readProtectedJson<Record<string, unknown>>(root, auditId, { idPattern: auditIdPattern }); const requestId = String(record.requestId || ""); if (requestIds.has(requestId)) result.push({ auditId, requestId, record }); } catch { /* preview reports unavailable through integrity state */ }
  }
  return result;
}

async function computePreview(database: DatabaseSync, filter: ExportFilter, categories: ExportCategory[]): Promise<ExportPreview> {
  const rows = selectedRows(database, filter); if (rows.length > 500) throw new PdStage4Error("BLOCKED");
  const requestIds = new Set(rows.map((row) => row.request_id)); const consents = categories.includes("CONSENT") ? await findConsentRecords(requestIds) : [];
  let totalBytes = 0; let attachmentsCount = 0; let blockedFiles = 0; let unavailableRecords = 0;
  for (const row of rows) {
    const size = await leadSize(row); totalBytes += size; if (!size || row.integrity_status !== "OK") unavailableRecords += 1;
    if (!categories.includes("ATTACHMENTS")) continue;
    try {
      const lead = await readLead(row); const files = Array.isArray(lead.files) ? lead.files as Array<Record<string, unknown>> : [];
      attachmentsCount += files.length;
      for (const file of files) { totalBytes += Math.max(0, Number(file.size || 0)); if (file.antivirus === "blocked") blockedFiles += 1; }
    } catch { unavailableRecords += 1; }
  }
  const warnings = [
    categories.includes("COMMENTS") ? "Служебные комментарии требуют отдельной проверки необходимости." : null,
    categories.includes("ATTACHMENTS") ? "Вложения могут содержать данные третьих лиц; требуется ручная минимизация." : null,
    blockedFiles ? "Есть файлы со статусом antivirus=blocked." : null,
    unavailableRecords ? "Есть недоступные или повреждённые записи." : null,
    categories.includes("TECHNICAL_EVENTS") ? "Технические события включаются только при наличии безопасного выборочного источника." : null,
  ].filter((item): item is string => Boolean(item));
  const preview = { requestIds: [...requestIds], recordsCount: rows.length, consentRecordsCount: consents.length, attachmentsCount, totalBytes, categories, sources: [...new Set(rows.map((row) => row.source))], blockedFiles, unavailableRecords, warnings };
  assertExportPreviewIsBounded(preview); return preview;
}

export function listExports(context: PdAuthContext, page = 1) {
  assertPdPermission(context.user.role, "VIEW_EXPORTS"); const safePage = Math.max(1, Math.floor(page)); const pageSize = 30;
  const total = Number((context.database.prepare("SELECT COUNT(*) AS count FROM exports").get() as { count: number }).count);
  const items = context.database.prepare(`SELECT id, export_type, request_number, request_date, stage4_status, requested_by, approved_by,
    records_count, consent_records_count, attachments_count, total_bytes, created_at, expires_at, downloaded_at, transferred_at,
    archive_sha256, manifest_sha256, approval_self_used, version,
    (SELECT COUNT(*) FROM export_downloads ed WHERE ed.export_id = exports.id AND ed.result = 'SUCCESS') AS downloads_count
    FROM exports ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(pageSize, (safePage - 1) * pageSize);
  return { page: safePage, pageSize, total, items };
}

export function getExport(context: PdAuthContext, idValue: string): Record<string, unknown> & { transfers: unknown[]; downloads: unknown[] } {
  assertPdPermission(context.user.role, "VIEW_EXPORTS"); const id = stage4Id(idValue);
  const row = context.database.prepare(`SELECT id, export_type, authority_name, request_number, request_date, legal_basis, filter_json,
    stage4_status, requested_by, approved_by, responsible_user_id, approving_user_id, categories_json, preview_json,
    approval_self_used, archive_sha256, manifest_sha256, records_count, consent_records_count, attachments_count, total_bytes,
    created_at, updated_at, expires_at, downloaded_at, transferred_at, deleted_at, failure_reason, version FROM exports WHERE id = ?`).get(id);
  if (!row) throw new PdStage4Error("NOT_FOUND");
  const transfers = context.database.prepare("SELECT id, transferred_at, channel, recipient_reference, registration_number, transfer_reference, transferred_by, confirmed_by, result FROM export_transfers WHERE export_id = ? ORDER BY transferred_at DESC").all(id);
  const downloads = context.database.prepare("SELECT id, user_id, downloaded_at, result FROM export_downloads WHERE export_id = ? ORDER BY downloaded_at DESC").all(id);
  return { ...(row as Record<string, unknown>), transfers, downloads };
}

export function createExportDraft(context: PdAuthContext, raw: Record<string, unknown>) {
  assertPdPermission(context.user.role, "CREATE_EXPORT_DRAFT"); const input = readDraftInput(context, raw); const id = newStage4Id(); const createdAt = nowIso();
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "EXPORT_DRAFT_CREATED", targetType: "EXPORT", targetId: id,
    legalBasis: input.legalBasis, result: "SUCCESS", ipHash: context.ipHash, metadata: { status: "DRAFT", scope: input.categories.length },
  }, (database) => {
    database.prepare(`INSERT INTO exports(id, export_type, authority_name, request_number, request_date, legal_basis, filter_json,
      status, stage4_status, requested_by, responsible_user_id, approving_user_id, subject_request_id, authority_request_id,
      categories_json, created_at, updated_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
      .run(id, input.type, input.authorityName ?? null, input.requestNumber, input.requestDate, input.legalBasis, JSON.stringify(input.filter),
        context.user.id, input.responsibleUserId, input.approvingUserId, input.subjectRequestId ?? null, input.authorityRequestId ?? null,
        JSON.stringify(input.categories), createdAt, createdAt);
    return { id, version: 1 };
  });
}

export async function createExportPreview(context: PdAuthContext, idValue: string, versionValue: unknown) {
  assertPdPermission(context.user.role, "CREATE_EXPORT_PREVIEW"); const id = stage4Id(idValue); const version = positiveVersion(versionValue);
  const row = context.database.prepare("SELECT filter_json, categories_json, legal_basis, subject_request_id, authority_request_id FROM exports WHERE id = ? AND version = ? AND stage4_status = 'DRAFT'").get(id, version) as { filter_json: string; categories_json: string; legal_basis: string; subject_request_id: string | null; authority_request_id: string | null } | undefined;
  if (!row) throw new PdStage4Error("CONFLICT"); const filter = JSON.parse(row.filter_json) as ExportFilter; const categories = JSON.parse(row.categories_json) as ExportCategory[];
  if (row.subject_request_id) {
    const subject = context.database.prepare("SELECT stage4_identity_status FROM subject_requests WHERE id = ?").get(row.subject_request_id) as { stage4_identity_status: string } | undefined;
    if (!subject || !["VERIFIED", "NOT_REQUIRED"].includes(subject.stage4_identity_status)) throw new PdStage4Error("BLOCKED");
  }
  if (row.authority_request_id) {
    const authority = context.database.prepare("SELECT verification_status FROM authority_requests WHERE id = ?").get(row.authority_request_id) as { verification_status: string } | undefined;
    const activeHold = context.database.prepare("SELECT COUNT(*) AS count FROM legal_holds WHERE authority_request_id = ? AND stage4_status IN ('ACTIVE','REVIEW_REQUIRED')").get(row.authority_request_id) as { count: number };
    if (authority?.verification_status !== "VERIFIED" || Number(activeHold.count) < 1) throw new PdStage4Error("BLOCKED");
  }
  const preview = await computePreview(context.database, filter, categories); const updatedAt = nowIso();
  if (row.authority_request_id) {
    const heldIds = context.database.prepare(`SELECT DISTINCT lhl.request_id FROM legal_hold_leads lhl
      JOIN legal_holds lh ON lh.id = lhl.legal_hold_id
      WHERE lh.authority_request_id = ? AND lh.stage4_status IN ('ACTIVE','REVIEW_REQUIRED')`).all(row.authority_request_id)
      .map((item) => String((item as { request_id: string }).request_id));
    if (preview.requestIds.some((requestId) => !heldIds.includes(requestId))) throw new PdStage4Error("BLOCKED");
  }
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "EXPORT_PREVIEW_CREATED", targetType: "EXPORT", targetId: id,
    legalBasis: row.legal_basis, result: "SUCCESS", ipHash: context.ipHash, metadata: { count: preview.recordsCount, bytes: preview.totalBytes, status: "PREVIEW_READY", version },
  }, (database) => {
    const result = database.prepare(`UPDATE exports SET status = 'PREVIEW_READY', stage4_status = 'PREVIEW_READY', preview_json = ?,
      records_count = ?, consent_records_count = ?, attachments_count = ?, total_bytes = ?, updated_at = ?, version = version + 1
      WHERE id = ? AND version = ? AND stage4_status = 'DRAFT'`)
      .run(JSON.stringify(preview), preview.recordsCount, preview.consentRecordsCount, preview.attachmentsCount, preview.totalBytes, updatedAt, id, version);
    if (Number(result.changes) !== 1) throw new PdStage4Error("CONFLICT"); return { id, preview, version: version + 1 };
  });
}

export function approveExport(context: PdAuthContext, idValue: string, versionValue: unknown) {
  assertPdPermission(context.user.role, "APPROVE_EXPORT"); if (!isStepUpActive(context.session.stepUpUntil)) throw new PdStage4Error("STEP_UP_REQUIRED");
  const id = stage4Id(idValue); const version = positiveVersion(versionValue); const now = nowIso();
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "EXPORT_APPROVED", targetType: "EXPORT", targetId: id,
    legalBasis: "OFFICIAL_EXPORT_MINIMIZATION_APPROVAL", result: "SUCCESS", ipHash: context.ipHash, metadata: { status: "APPROVAL_REQUIRED", version },
  }, (database) => {
    const row = database.prepare("SELECT requested_by, approving_user_id, preview_json FROM exports WHERE id = ? AND version = ? AND stage4_status = 'PREVIEW_READY'").get(id, version) as { requested_by: string; approving_user_id: string | null; preview_json: string | null } | undefined;
    if (!row?.preview_json || !row.approving_user_id || row.approving_user_id !== context.user.id) throw new PdStage4Error("CONFLICT");
    const self = row.requested_by === context.user.id;
    const result = database.prepare(`UPDATE exports SET approved_by = ?, step_up_verified_at = ?, approval_self_used = ?, status = 'APPROVAL_REQUIRED',
      stage4_status = 'APPROVAL_REQUIRED', updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`)
      .run(context.user.id, now, self ? 1 : 0, now, id, version); if (Number(result.changes) !== 1) throw new PdStage4Error("CONFLICT");
    return { id, selfApproval: self, version: version + 1 };
  });
}

function acquireExportLocks(database: DatabaseSync, requestIds: string[], exportId: string, userId: string, now: Date) {
  database.prepare("DELETE FROM lead_operation_locks WHERE expires_at <= ?").run(now.toISOString());
  const insert = database.prepare("INSERT INTO lead_operation_locks(request_id, operation_type, operation_id, acquired_at, expires_at, acquired_by) VALUES (?, 'EXPORT', ?, ?, ?, ?)");
  const expiresAt = new Date(now.getTime() + 30 * 60_000).toISOString();
  for (const requestId of requestIds) {
    try { insert.run(requestId, exportId, now.toISOString(), expiresAt, userId); } catch { throw new PdStage4Error("CONFLICT"); }
  }
}

function releaseExportLocks(database: DatabaseSync, exportId: string) { database.prepare("DELETE FROM lead_operation_locks WHERE operation_type = 'EXPORT' AND operation_id = ?").run(exportId); }

function recordRows(database: DatabaseSync, requestIds: string[], category: "workflow" | "comments" | "access") {
  if (!requestIds.length) return [];
  const placeholders = requestIds.map(() => "?").join(",");
  if (category === "workflow") return database.prepare(`SELECT request_id, internal_status, assigned_user_id, legal_hold_active, retention_override_until, retention_override_reason, created_at, updated_at FROM lead_workflow WHERE request_id IN (${placeholders})`).all(...requestIds);
  if (category === "comments") return database.prepare(`SELECT id, request_id, author_user_id, body, created_at, updated_at FROM staff_comments WHERE deleted_at IS NULL AND request_id IN (${placeholders})`).all(...requestIds);
  return database.prepare(`SELECT occurred_at, user_id, action, target_type, target_id, legal_basis, result, metadata_json FROM access_events WHERE target_id IN (${placeholders}) ORDER BY occurred_at`).all(...requestIds);
}

async function buildEntries(database: DatabaseSync, exportRow: Record<string, unknown>, preview: ExportPreview) {
  const categories = JSON.parse(String(exportRow.categories_json)) as ExportCategory[]; const requestIds = preview.requestIds;
  const rows = selectedRowsByApprovedIds(database, requestIds); const entries: ZipEntry[] = [];
  if (rows.length !== requestIds.length) throw new PdStage4Error("BLOCKED");
  const manifestItems: Array<Record<string, unknown>> = []; const exclusions: Array<Record<string, unknown>> = [];
  const add = (path: string, content: Buffer, source: string, category: string, requestId: string | null = null) => {
    entries.push({ path, content }); manifestItems.push({ relative_path: path, size: content.length, sha256: sha256Buffer(content), source, category, requestId, included_at: nowIso() });
  };
  if (categories.includes("RECORDS")) for (const row of rows) {
    try { const record = await readLead(row); add(`records/${row.source === "quote-form" ? "quote" : "assistant"}/${row.request_id}.json`, Buffer.from(`${JSON.stringify(record, null, 2)}\n`), row.source, "record", row.request_id); }
    catch { exclusions.push({ requestId: row.request_id, category: "record", reason: "UNAVAILABLE" }); }
  }
  if (categories.includes("CONSENT")) for (const consent of await findConsentRecords(new Set(requestIds))) {
    add(`consent-audit/${consent.auditId}.json`, Buffer.from(`${JSON.stringify(consent.record, null, 2)}\n`), "consent-audit", "consent", consent.requestId);
  }
  if (categories.includes("ATTACHMENTS")) for (const row of rows) {
    try {
      const lead = await readLead(row); const files = Array.isArray(lead.files) ? lead.files as Array<Record<string, unknown>> : [];
      for (const file of files) {
        const storageId = String(file.storageId || ""); if (file.antivirus === "blocked") { exclusions.push({ requestId: row.request_id, category: "attachment", sourceId: storageId, reason: "ANTIVIRUS_BLOCKED" }); continue; }
        try { const opened = await openProtectedAttachment(quarantineRoot(), row.request_id, storageId); const content = await opened.handle.readFile(); await opened.handle.close(); add(`attachments/${row.request_id}/${storageId}`, content, "quarantine", "attachment", row.request_id); }
        catch { exclusions.push({ requestId: row.request_id, category: "attachment", sourceId: storageId, reason: "UNAVAILABLE" }); }
      }
    } catch { exclusions.push({ requestId: row.request_id, category: "attachment", reason: "LEAD_UNAVAILABLE" }); }
  }
  const serviceGroups: Array<[ExportCategory, "workflow" | "comments" | "access", string]> = [["WORKFLOW", "workflow", "workflow/workflow.json"], ["COMMENTS", "comments", "workflow/comments.json"], ["ACCESS_EVENTS", "access", "access-events/access-events.json"]];
  for (const [category, query, path] of serviceGroups) if (categories.includes(category)) {
    const content = Buffer.from(`${JSON.stringify(recordRows(database, requestIds, query), null, 2)}\n`); add(path, content, "administrative-sqlite", category.toLowerCase(), null);
  }
  if (categories.includes("TECHNICAL_EVENTS")) exclusions.push({ category: "technical-events", reason: "SAFE_SOURCE_NOT_CONFIGURED" });
  const manifest = { export_id: String(exportRow.id), created_at: nowIso(), items: manifestItems, exclusions }; const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`); const manifestSha256 = sha256Buffer(manifestBuffer);
  const metadata: EmbeddedExportMetadata = {
    operator_name: legalOperator.name, operator_inn: legalOperator.inn, operator_ogrn: legalOperator.ogrn, created_at: nowIso(), export_id: String(exportRow.id),
    export_type: String(exportRow.export_type) as EmbeddedExportMetadata["export_type"], legal_basis: String(exportRow.legal_basis),
    authority_or_subject: String(exportRow.authority_name || "Связанный запрос"), request_number: String(exportRow.request_number), request_date: String(exportRow.request_date),
    created_by: String(exportRow.requested_by), approved_by: String(exportRow.approved_by), filters: archiveFilter(JSON.parse(String(exportRow.filter_json)) as ExportFilter),
    categories, records_count: preview.recordsCount, consent_count: preview.consentRecordsCount, attachments_count: preview.attachmentsCount,
    total_bytes: preview.totalBytes, manifest_sha256: manifestSha256, archive_expires_at: String(exportRow.expires_at),
    notice: "Архив подготовлен для ручной проверки и передачи по утверждённому официальному каналу. Автоматическая отправка не выполнялась.",
  };
  assertMetadataExcludesFinalArchiveHash(metadata);
  add("README.txt", Buffer.from("Официальная выборочная выгрузка ООО «ЭНЕРГОАЛЬЯНС». Перед передачей требуется ручная проверка состава.\n"), "system", "readme");
  add("manifest.json", manifestBuffer, "system", "manifest"); add("export_metadata.json", Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`), "system", "metadata");
  const indexRows = manifestItems.map((item) => [item.requestId || "", item.category, item.relative_path, item.size, item.sha256, item.source]);
  add("index.csv", createCsv(["Request ID", "Категория", "Путь", "Размер", "SHA-256", "Источник"], indexRows), "system", "index");
  add("index.xlsx", createXlsx([
    { name: "Состав выгрузки", rows: [["Request ID", "Категория", "Путь", "Размер", "SHA-256", "Источник"], ...indexRows] },
    { name: "Параметры запроса", rows: [["Параметр", "Значение"], ["Номер", exportRow.request_number], ["Дата", exportRow.request_date], ["Основание", exportRow.legal_basis], ["Тип", exportRow.export_type]] },
    { name: "Оператор", rows: [["Параметр", "Значение"], ["Наименование", legalOperator.name], ["ИНН", legalOperator.inn], ["ОГРН", legalOperator.ogrn]] },
    { name: "Опись файлов", rows: [["Путь", "Размер", "SHA-256"], ...manifestItems.map((item) => [item.relative_path, item.size, item.sha256])] },
    { name: "Исключённые материалы", rows: [["Request ID", "Категория", "Причина"], ...exclusions.map((item) => [item.requestId || "", item.category || "", item.reason])] },
  ]), "system", "index");
  const checksumEntries = entries.map((entry) => `${sha256Buffer(entry.content)}  ${entry.path}`).sort(); entries.push({ path: "SHA256SUMS.txt", content: Buffer.from(`${checksumEntries.join("\n")}\n`) });
  return { entries, manifestSha256, manifestItems, exclusions };
}

export async function buildExportArchive(context: PdAuthContext, idValue: string, versionValue: unknown) {
  assertPdPermission(context.user.role, "BUILD_EXPORT"); if (!isStepUpActive(context.session.stepUpUntil)) throw new PdStage4Error("STEP_UP_REQUIRED");
  const id = stage4Id(idValue); const version = positiveVersion(versionValue); prepareExportRoot(context.config.exportPath); const now = new Date();
  const row = context.database.prepare("SELECT * FROM exports WHERE id = ? AND version = ? AND stage4_status = 'APPROVAL_REQUIRED' AND approved_by IS NOT NULL").get(id, version) as Record<string, unknown> | undefined;
  if (!row) throw new PdStage4Error("CONFLICT"); const preview = JSON.parse(String(row.preview_json)) as ExportPreview;
  const expiresAt = new Date(now.getTime() + context.config.exportTtlHours * 3_600_000).toISOString(); const archiveName = `${id}.zip`; const archivePath = resolve(context.config.exportPath, archiveName);
  auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "EXPORT_BUILD_STARTED", targetType: "EXPORT", targetId: id,
    legalBasis: String(row.legal_basis), result: "SUCCESS", ipHash: context.ipHash, metadata: { count: preview.requestIds.length, status: "BUILDING", version },
  }, (database) => {
    acquireExportLocks(database, preview.requestIds, id, context.user.id, now);
    const update = database.prepare(`UPDATE exports SET status = 'BUILDING', stage4_status = 'BUILDING', expires_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`)
      .run(expiresAt, now.toISOString(), id, version);
    if (Number(update.changes) !== 1) throw new PdStage4Error("CONFLICT");
  });
  try {
    const buildRow = { ...row, expires_at: expiresAt }; const built = await buildEntries(context.database, buildRow, preview); const archive = createStoredZip(built.entries); const archiveSha256 = sha256Buffer(archive);
    const fd = openSync(archivePath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
    try { writeFileSync(fd, archive); } finally { closeSync(fd); } chmodSync(archivePath, 0o600);
    if (!context.config.auditChainKey) throw new Error("Audit unavailable");
    recordAccessEvent(context.database, { userId: context.user.id, sessionId: context.session.id, action: "EXPORT_ARCHIVE_HASHED", targetType: "EXPORT", targetId: id,
      legalBasis: String(row.legal_basis), result: "SUCCESS", ipHash: context.ipHash, metadata: { bytes: archive.length, status: "BUILDING" } }, context.config.auditChainKey);
    return auditedTransaction(context, {
      userId: context.user.id, sessionId: context.session.id, action: "EXPORT_BUILD_COMPLETED", targetType: "EXPORT", targetId: id,
      legalBasis: String(row.legal_basis), result: "SUCCESS", ipHash: context.ipHash, metadata: { bytes: archive.length, files: built.entries.length, status: "READY" },
    }, (database) => {
      database.prepare(`UPDATE exports SET archive_path = ?, archive_sha256 = ?, manifest_sha256 = ?, status = 'READY', stage4_status = 'READY',
        total_bytes = ?, updated_at = ?, version = version + 1 WHERE id = ? AND stage4_status = 'BUILDING'`)
        .run(archivePath, archiveSha256, built.manifestSha256, archive.length, nowIso(), id);
      const add = database.prepare(`INSERT OR REPLACE INTO export_items(export_id, item_type, source_id, relative_path, sha256, size_bytes, included, exclusion_reason) VALUES (?, ?, ?, ?, ?, ?, 1, NULL)`);
      for (const item of built.manifestItems) add.run(id, String(item.category), String(item.requestId || item.relative_path), String(item.relative_path), String(item.sha256), Number(item.size));
      releaseExportLocks(database, id); return { id, archiveSha256, manifestSha256: built.manifestSha256, expiresAt, version: version + 2 };
    });
  } catch (error) {
    if (existsSync(archivePath)) unlinkSync(archivePath);
    context.database.exec("BEGIN IMMEDIATE"); try {
      releaseExportLocks(context.database, id); context.database.prepare(`UPDATE exports SET status = 'FAILED', stage4_status = 'FAILED', failure_reason = 'BUILD_FAILED', updated_at = ?, version = version + 1 WHERE id = ?`).run(nowIso(), id);
      if (context.config.auditChainKey) recordAccessEventInTransaction(context.database, { userId: context.user.id, sessionId: context.session.id, action: "EXPORT_BUILD_FAILED", targetType: "EXPORT", targetId: id, legalBasis: String(row.legal_basis), result: "FAILED", ipHash: context.ipHash, metadata: { code: "BUILD_FAILED", status: "FAILED" } }, context.config.auditChainKey);
      context.database.exec("COMMIT");
    } catch { context.database.exec("ROLLBACK"); }
    throw error;
  }
}

export async function openExportDownload(context: PdAuthContext, idValue: string) {
  assertPdPermission(context.user.role, "DOWNLOAD_EXPORT"); if (!isStepUpActive(context.session.stepUpUntil)) throw new PdStage4Error("STEP_UP_REQUIRED");
  const id = stage4Id(idValue); const row = context.database.prepare("SELECT archive_path, expires_at, stage4_status, legal_basis FROM exports WHERE id = ?").get(id) as { archive_path: string | null; expires_at: string | null; stage4_status: string; legal_basis: string } | undefined;
  if (!row?.archive_path || !row.expires_at || !["READY", "DOWNLOADED", "TRANSFERRED"].includes(row.stage4_status) || Date.parse(row.expires_at) <= Date.now()) throw new PdStage4Error("NOT_FOUND");
  const expectedName = `${id}.zip`; if (basename(row.archive_path) !== expectedName) throw new PdStage4Error("BLOCKED");
  const path = await resolveProtectedFile(context.config.exportPath, [expectedName]); const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); const size = (await handle.stat()).size;
  auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "EXPORT_DOWNLOADED", targetType: "EXPORT", targetId: id,
    legalBasis: row.legal_basis, result: "SUCCESS", ipHash: context.ipHash, metadata: { bytes: size, status: "DOWNLOADED" },
  }, (database) => {
    database.prepare("INSERT INTO export_downloads(id, export_id, user_id, downloaded_at, ip_hash, result) VALUES (?, ?, ?, ?, ?, 'SUCCESS')")
      .run(newStage4Id(), id, context.user.id, nowIso(), context.ipHash);
    database.prepare(`UPDATE exports SET downloaded_at = COALESCE(downloaded_at, ?), status = 'DOWNLOADED', stage4_status = CASE WHEN stage4_status = 'READY' THEN 'DOWNLOADED' ELSE stage4_status END, updated_at = ?, version = version + 1 WHERE id = ?`)
      .run(nowIso(), nowIso(), id);
  });
  return { handle, size, fileName: `steelprodukt-export-${id}.zip` };
}

export function registerExportTransfer(context: PdAuthContext, idValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "REGISTER_EXPORT_TRANSFER"); const id = stage4Id(idValue); const version = positiveVersion(input.version); const transferId = newStage4Id(); const transferredAt = isoDate(input.transferredAt);
  const channel = enumValue(input.channel, ["OFFICIAL_PORTAL", "SECURE_SYSTEM", "REGISTERED_MAIL", "IN_PERSON", "OTHER_APPROVED"] as const);
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "EXPORT_TRANSFER_REGISTERED", targetType: "EXPORT", targetId: id,
    legalBasis: requiredText(input.legalBasis, 3, 1_000), result: "SUCCESS", ipHash: context.ipHash, metadata: { method: channel, status: "TRANSFERRED", version },
  }, (database) => {
    const row = database.prepare("SELECT id FROM exports WHERE id = ? AND version = ? AND stage4_status IN ('READY','DOWNLOADED')").get(id, version); if (!row) throw new PdStage4Error("CONFLICT");
    database.prepare(`INSERT INTO export_transfers(id, export_id, transferred_at, channel, recipient_reference, registration_number,
      transfer_reference, transferred_by, confirmed_by, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(transferId, id, transferredAt, channel, requiredText(input.recipientReference, 2, 300), requiredText(input.registrationNumber, 2, 120),
        requiredText(input.transferReference, 2, 240), context.user.id, optionalStage4Id(input.confirmedBy), requiredText(input.result, 2, 1_000), nowIso());
    const update = database.prepare(`UPDATE exports SET transferred_at = ?, status = 'DOWNLOADED', stage4_status = 'TRANSFERRED', updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`)
      .run(transferredAt, nowIso(), id, version);
    if (Number(update.changes) !== 1) throw new PdStage4Error("CONFLICT"); return { id, transferId, status: "TRANSFERRED", version: version + 1 };
  });
}

export function expireExportArchives(context: PdAuthContext, now = new Date()) {
  assertPdPermission(context.user.role, "DELETE_EXPORT"); const rows = context.database.prepare(`SELECT id, archive_path, legal_basis FROM exports
    WHERE expires_at IS NOT NULL AND expires_at <= ?
      AND (stage4_status IN ('READY','DOWNLOADED','TRANSFERRED') OR (stage4_status = 'EXPIRED' AND archive_path IS NOT NULL))`).all(now.toISOString()) as Array<{ id: string; archive_path: string | null; legal_basis: string }>;
  let deleted = 0; let failed = 0;
  for (const row of rows) {
    let result = "SUCCESS";
    try {
      if (row.archive_path) { const expected = `${row.id}.zip`; if (basename(row.archive_path) !== expected) throw new PdStage4Error("BLOCKED"); const safePath = resolve(context.config.exportPath, expected); const node = lstatSync(safePath); if (!node.isFile() || node.isSymbolicLink()) throw new PdStage4Error("BLOCKED"); unlinkSync(safePath); }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") result = "FAILED"; }
    auditedTransaction(context, {
      userId: context.user.id, sessionId: context.session.id, action: result === "SUCCESS" ? "EXPORT_FILE_DELETED" : "EXPORT_EXPIRED", targetType: "EXPORT", targetId: row.id,
      legalBasis: row.legal_basis, result, ipHash: context.ipHash, metadata: { status: result === "SUCCESS" ? "DELETED" : "EXPIRED" },
    }, (database) => { database.prepare(`UPDATE exports SET stage4_status = ?, status = ?,
      archive_path = CASE WHEN ? = 'SUCCESS' THEN NULL ELSE archive_path END,
      deleted_at = CASE WHEN ? = 'SUCCESS' THEN ? ELSE deleted_at END,
      updated_at = ?, version = version + 1 WHERE id = ?`)
      .run(result === "SUCCESS" ? "DELETED" : "EXPIRED", result === "SUCCESS" ? "DELETED" : "EXPIRED", result, result, now.toISOString(), now.toISOString(), row.id); });
    if (result === "SUCCESS") deleted += 1; else failed += 1;
  }
  return { examined: rows.length, deleted, failed };
}

export type ExportExpiryMode = "dry-run" | "apply";

export function expireExportArchivesAsSystem(
  database: DatabaseSync,
  exportPath: string,
  auditChainKey: string,
  options: { mode: ExportExpiryMode; now?: Date },
) {
  const now = options.now ?? new Date();
  prepareExportRoot(exportPath);
  const rows = database.prepare(`SELECT id, archive_path, legal_basis FROM exports
    WHERE expires_at IS NOT NULL AND expires_at <= ?
      AND (stage4_status IN ('READY','DOWNLOADED','TRANSFERRED') OR (stage4_status = 'EXPIRED' AND archive_path IS NOT NULL))`).all(now.toISOString()) as Array<{ id: string; archive_path: string | null; legal_basis: string }>;
  const systemHash = sha256Buffer(`${auditChainKey}:PD_EXPORT_EXPIRY_JOB`); let deleted = 0; let failed = 0;
  for (const row of rows) {
    let result = "SUCCESS";
    try {
      if (row.archive_path) {
        const expected = `${row.id}.zip`; if (basename(row.archive_path) !== expected) throw new PdStage4Error("BLOCKED");
        const safePath = resolve(exportPath, expected); const node = lstatSync(safePath); if (!node.isFile() || node.isSymbolicLink()) throw new PdStage4Error("BLOCKED");
        if (options.mode === "apply") unlinkSync(safePath);
      }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") result = "FAILED"; }
    if (options.mode === "dry-run") {
      if (result === "FAILED") failed += 1;
      continue;
    }
    database.exec("BEGIN IMMEDIATE");
    try {
      recordAccessEventInTransaction(database, { action: "EXPORT_EXPIRED", targetType: "EXPORT", targetId: row.id, legalBasis: row.legal_basis, result, ipHash: systemHash, metadata: { status: "EXPIRED" } }, auditChainKey);
      if (result === "SUCCESS") recordAccessEventInTransaction(database, { action: "EXPORT_FILE_DELETED", targetType: "EXPORT", targetId: row.id, legalBasis: row.legal_basis, result, ipHash: systemHash, metadata: { status: "DELETED" } }, auditChainKey);
      database.prepare(`UPDATE exports SET stage4_status = ?, status = ?, archive_path = CASE WHEN ? = 'SUCCESS' THEN NULL ELSE archive_path END,
        deleted_at = CASE WHEN ? = 'SUCCESS' THEN ? ELSE deleted_at END, updated_at = ?, version = version + 1 WHERE id = ?`)
        .run(result === "SUCCESS" ? "DELETED" : "EXPIRED", result === "SUCCESS" ? "DELETED" : "EXPIRED", result, result, now.toISOString(), now.toISOString(), row.id);
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
    if (result === "SUCCESS") deleted += 1; else failed += 1;
  }
  return { mode: options.mode, examined: rows.length, eligible: rows.length - failed, deleted, failed };
}
