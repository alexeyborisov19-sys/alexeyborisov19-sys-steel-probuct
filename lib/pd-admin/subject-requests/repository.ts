import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { assertPdPermission } from "@/lib/pd-admin/auth/permissions";
import { requestIdPattern } from "@/lib/pd-admin/storage/safe-files";
import {
  assertChanged,
  auditedTransaction,
  enumValue,
  isoDate,
  newStage4Id,
  nowIso,
  optionalStage4Id,
  optionalText,
  PdStage4Error,
  positiveVersion,
  requiredText,
  stage4Id,
  stringArray,
} from "@/lib/pd-admin/stage4/common";
import { assertFiveWeekdayExtension, defaultSubjectDueAt } from "@/lib/pd-admin/stage4/deadlines";

export const subjectRequestTypes = ["ACCESS", "CLARIFICATION", "BLOCKING", "DELETION", "CONSENT_WITHDRAWAL", "PROCESSING_INFORMATION", "OTHER"] as const;
export const subjectRequestStatuses = ["RECEIVED", "IDENTITY_REQUIRED", "IDENTITY_VERIFICATION", "IN_PROGRESS", "RESPONSE_PREPARED", "APPROVAL_REQUIRED", "COMPLETED", "REJECTED_WITH_REASON", "EXTENDED", "CLOSED"] as const;
export const identityStatuses = ["NOT_STARTED", "ADDITIONAL_INFORMATION_REQUIRED", "VERIFIED", "FAILED", "NOT_REQUIRED"] as const;
export const identityMethods = ["EMAIL_CONFIRMATION", "PHONE_CONFIRMATION", "REQUEST_ID", "CONTRACT_NUMBER", "IN_PERSON_DOCUMENT", "SIGNED_ELECTRONIC_REQUEST", "OTHER_APPROVED"] as const;

function legacyStatus(status: typeof subjectRequestStatuses[number]) {
  if (status === "IDENTITY_REQUIRED" || status === "IDENTITY_VERIFICATION") return "IDENTIFICATION_REQUIRED";
  if (status === "RESPONSE_PREPARED" || status === "APPROVAL_REQUIRED") return "RESPONSE_READY";
  if (status === "REJECTED_WITH_REASON") return "REASONED_REFUSAL";
  return status;
}

function mask(value: string | null) {
  if (!value) return "Не указано";
  return `${value.slice(0, 1)}${"•".repeat(Math.min(10, Math.max(4, value.length - 1)))}`;
}

function maySeeIdentity(context: PdAuthContext) {
  return context.user.role === "ADMIN" || context.user.role === "PERSONAL_DATA_OFFICER";
}

export function listSubjectRequests(context: PdAuthContext, page = 1) {
  assertPdPermission(context.user.role, "VIEW_SUBJECT_REQUESTS");
  const safePage = Math.max(1, Math.floor(page)); const pageSize = 30;
  const total = Number((context.database.prepare("SELECT COUNT(*) AS count FROM subject_requests WHERE id IS NOT NULL").get() as { count: number }).count);
  const rows = context.database.prepare(`
    SELECT sr.id, sr.registration_number, sr.received_at, sr.request_type, sr.stage4_identity_status,
      sr.stage4_status, sr.due_at, sr.extended_due_at, sr.subject_name, sr.subject_contact,
      sr.responsible_user_id, sr.updated_at, sr.version, u.display_name,
      (SELECT COUNT(*) FROM subject_request_leads srl WHERE srl.registration_number = sr.registration_number) AS leads_count
    FROM subject_requests sr LEFT JOIN users u ON u.id = sr.responsible_user_id
    WHERE sr.id IS NOT NULL ORDER BY sr.received_at DESC LIMIT ? OFFSET ?
  `).all(pageSize, (safePage - 1) * pageSize) as Array<Record<string, string | number | null>>;
  const disclose = maySeeIdentity(context);
  return { page: safePage, pageSize, total, items: rows.map((row) => ({
    id: String(row.id), registrationNumber: String(row.registration_number), receivedAt: String(row.received_at),
    requestType: String(row.request_type), identityStatus: String(row.stage4_identity_status), status: String(row.stage4_status),
    dueAt: String(row.due_at), extendedDueAt: row.extended_due_at ? String(row.extended_due_at) : null,
    subjectName: disclose ? String(row.subject_name) : mask(String(row.subject_name)),
    subjectContact: disclose ? String(row.subject_contact) : "Скрыто",
    responsibleUserId: row.responsible_user_id ? String(row.responsible_user_id) : null,
    responsibleName: row.display_name ? String(row.display_name) : null,
    updatedAt: String(row.updated_at), version: Number(row.version), leadsCount: Number(row.leads_count),
  })) };
}

export function getSubjectRequest(context: PdAuthContext, idValue: string) {
  assertPdPermission(context.user.role, "VIEW_SUBJECT_REQUESTS"); const id = stage4Id(idValue);
  const row = context.database.prepare(`SELECT sr.*, u.display_name AS due_confirmed_by_name
    FROM subject_requests sr LEFT JOIN users u ON u.id = sr.due_confirmed_by WHERE sr.id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) throw new PdStage4Error("NOT_FOUND");
  const links = context.database.prepare("SELECT request_id FROM subject_request_leads WHERE registration_number = ? ORDER BY request_id")
    .all(String(row.registration_number)).map((item) => String((item as { request_id: string }).request_id));
  const checks = context.database.prepare(`SELECT id, method, result, checked_at, checked_by, basis FROM subject_identity_checks WHERE subject_request_id = ? ORDER BY checked_at DESC`)
    .all(id) as Array<Record<string, string>>;
  const deadlines = context.database.prepare(`SELECT id, previous_due_at, new_due_at, reason, changed_at, changed_by FROM subject_request_deadline_events WHERE subject_request_id = ? ORDER BY changed_at DESC`)
    .all(id) as Array<Record<string, string>>;
  const disclose = maySeeIdentity(context);
  return {
    id, registrationNumber: String(row.registration_number), receivedAt: String(row.received_at), channel: String(row.channel),
    subjectName: disclose ? String(row.subject_name) : mask(String(row.subject_name)),
    subjectContact: disclose ? String(row.subject_contact) : "Скрыто", identityMethod: row.identity_method ? String(row.identity_method) : null,
    identityStatus: String(row.stage4_identity_status), requestType: String(row.request_type), requestSummary: String(row.request_summary),
    legalBasis: String(row.legal_basis), dueAt: String(row.confirmed_due_at || row.due_at), initialDueAt: String(row.initial_due_at || row.due_at),
    calculatedDueAt: row.calculated_due_at ? String(row.calculated_due_at) : null,
    confirmedDueAt: row.confirmed_due_at ? String(row.confirmed_due_at) : String(row.due_at),
    dueConfirmedAt: row.due_confirmed_at ? String(row.due_confirmed_at) : null,
    dueConfirmedBy: row.due_confirmed_by ? String(row.due_confirmed_by) : null,
    dueConfirmedByName: row.due_confirmed_by_name ? String(row.due_confirmed_by_name) : null,
    dueConfirmationBasis: row.due_confirmation_basis ? String(row.due_confirmation_basis) : null,
    extendedDueAt: row.extended_due_at ? String(row.extended_due_at) : null, extensionReason: row.extension_reason ? String(row.extension_reason) : null,
    responsibleUserId: row.responsible_user_id ? String(row.responsible_user_id) : null, status: String(row.stage4_status),
    answeredAt: row.answered_at ? String(row.answered_at) : null, responseMethod: row.response_method ? String(row.response_method) : null,
    resultSummary: row.result_summary ? String(row.result_summary) : null, exportId: row.export_id ? String(row.export_id) : null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at), version: Number(row.version), requestIds: links, identityChecks: checks, deadlineHistory: deadlines,
  };
}

export function createSubjectRequest(context: PdAuthContext, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "CREATE_SUBJECT_REQUEST");
  const id = newStage4Id(); const createdAt = nowIso();
  const registrationNumber = requiredText(input.registrationNumber, 3, 80);
  const requestType = enumValue(input.requestType, subjectRequestTypes);
  const receivedAt = isoDate(input.receivedAt); const calculatedDueAt = defaultSubjectDueAt(receivedAt, requestType);
  const confirmedDueAt = isoDate(input.confirmedDueAt); const dueConfirmationBasis = requiredText(input.dueConfirmationBasis, 8, 1_000);
  if (Date.parse(confirmedDueAt) < Date.parse(receivedAt)) throw new PdStage4Error("VALIDATION_ERROR");
  const requestIds = stringArray(input.requestIds ?? [], 50);
  if (requestIds.some((value) => !requestIdPattern.test(value))) throw new PdStage4Error("VALIDATION_ERROR");
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "SUBJECT_REQUEST_CREATED", targetType: "SUBJECT_REQUEST",
    targetId: id, legalBasis: requiredText(input.legalBasis, 3, 1_000), result: "SUCCESS", ipHash: context.ipHash,
    metadata: { count: requestIds.length, status: "RECEIVED" },
  }, (database) => {
    database.prepare(`INSERT INTO subject_requests(
      registration_number, id, received_at, channel, subject_name, subject_contact, identity_status,
      stage4_identity_status, request_type, request_summary, legal_basis, due_at, initial_due_at,
      calculated_due_at, confirmed_due_at, due_confirmed_at, due_confirmed_by, due_confirmation_basis,
      responsible_user_id, status, stage4_status, created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, 'NOT_STARTED', 'NOT_STARTED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', 'RECEIVED', ?, ?, 1)`)
      .run(registrationNumber, id, receivedAt, requiredText(input.channel, 2, 80), requiredText(input.subjectName, 2, 300),
        requiredText(input.subjectContact, 3, 500), requestType, requiredText(input.requestSummary, 3, 4_000),
        requiredText(input.legalBasis, 3, 1_000), confirmedDueAt, confirmedDueAt, calculatedDueAt, confirmedDueAt,
        createdAt, context.user.id, dueConfirmationBasis, optionalStage4Id(input.responsibleUserId), createdAt, createdAt);
    const link = database.prepare("INSERT INTO subject_request_leads(registration_number, request_id) VALUES (?, ?)");
    for (const requestId of requestIds) link.run(registrationNumber, requestId);
    return { id, registrationNumber, version: 1 };
  });
}

export function updateSubjectRequest(context: PdAuthContext, idValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "UPDATE_SUBJECT_REQUEST"); const id = stage4Id(idValue); const version = positiveVersion(input.version);
  const status = enumValue(input.status, subjectRequestStatuses); const updatedAt = nowIso();
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "SUBJECT_REQUEST_UPDATED", targetType: "SUBJECT_REQUEST", targetId: id,
    legalBasis: requiredText(input.legalBasis, 3, 1_000), result: "SUCCESS", ipHash: context.ipHash, metadata: { status, version },
  }, (database) => {
    const result = database.prepare(`UPDATE subject_requests SET request_summary = ?, legal_basis = ?, responsible_user_id = ?,
      status = ?, stage4_status = ?, response_method = ?, result_summary = ?, answered_at = ?, updated_at = ?, version = version + 1
      WHERE id = ? AND version = ?`).run(requiredText(input.requestSummary, 3, 4_000), requiredText(input.legalBasis, 3, 1_000),
      optionalStage4Id(input.responsibleUserId), legacyStatus(status), status, optionalText(input.responseMethod, 120),
      optionalText(input.resultSummary, 4_000), input.answeredAt ? isoDate(input.answeredAt) : null, updatedAt, id, version);
    assertChanged(result.changes); return { id, version: version + 1 };
  });
}

export function verifySubjectIdentity(context: PdAuthContext, idValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "VERIFY_SUBJECT_IDENTITY"); const id = stage4Id(idValue); const version = positiveVersion(input.version);
  const resultStatus = enumValue(input.result, identityStatuses.filter((value) => value !== "NOT_STARTED"));
  const method = enumValue(input.method, identityMethods); const checkedAt = nowIso();
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "SUBJECT_IDENTITY_CHECKED", targetType: "SUBJECT_REQUEST", targetId: id,
    legalBasis: requiredText(input.basis, 3, 1_000), result: resultStatus === "VERIFIED" || resultStatus === "NOT_REQUIRED" ? "SUCCESS" : "REVIEW",
    ipHash: context.ipHash, metadata: { status: resultStatus, method, version },
  }, (database) => {
    database.prepare(`INSERT INTO subject_identity_checks(id, subject_request_id, method, result, checked_at, checked_by, basis) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(newStage4Id(), id, method, resultStatus, checkedAt, context.user.id, requiredText(input.basis, 3, 1_000));
    const status = resultStatus === "VERIFIED" || resultStatus === "NOT_REQUIRED" ? "IN_PROGRESS" : resultStatus === "FAILED" ? "IDENTITY_REQUIRED" : "IDENTITY_REQUIRED";
    const update = database.prepare(`UPDATE subject_requests SET identity_method = ?, identity_status = ?, stage4_identity_status = ?,
      status = ?, stage4_status = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`)
      .run(method, resultStatus, resultStatus, legacyStatus(status), status, checkedAt, id, version);
    assertChanged(update.changes); return { id, identityStatus: resultStatus, version: version + 1 };
  });
}

export function extendSubjectDeadline(context: PdAuthContext, idValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "EXTEND_REQUEST_DEADLINE"); const id = stage4Id(idValue); const version = positiveVersion(input.version);
  const newDueAt = isoDate(input.newDueAt); const reason = requiredText(input.reason, 8, 1_000); const changedAt = nowIso();
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "SUBJECT_REQUEST_EXTENDED", targetType: "SUBJECT_REQUEST", targetId: id,
    legalBasis: reason, result: "SUCCESS", ipHash: context.ipHash, metadata: { version },
  }, (database) => {
    const current = database.prepare("SELECT due_at, extended_due_at, request_type FROM subject_requests WHERE id = ? AND version = ?").get(id, version) as { due_at: string; extended_due_at: string | null; request_type: string } | undefined;
    if (!current || Date.parse(newDueAt) <= Date.parse(current.extended_due_at || current.due_at)) throw new PdStage4Error("CONFLICT");
    if (["ACCESS", "PROCESSING_INFORMATION"].includes(current.request_type)) assertFiveWeekdayExtension(current.extended_due_at || current.due_at, newDueAt);
    database.prepare(`INSERT INTO subject_request_deadline_events(id, subject_request_id, previous_due_at, new_due_at, reason, changed_at, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(newStage4Id(), id, current.extended_due_at || current.due_at, newDueAt, reason, changedAt, context.user.id);
    const update = database.prepare(`UPDATE subject_requests SET extended_due_at = ?, extension_reason = ?, confirmed_due_at = ?,
      due_confirmed_at = ?, due_confirmed_by = ?, due_confirmation_basis = ?, status = 'EXTENDED', stage4_status = 'EXTENDED',
      updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`)
      .run(newDueAt, reason, newDueAt, changedAt, context.user.id, reason, changedAt, id, version); assertChanged(update.changes);
    return { id, extendedDueAt: newDueAt, version: version + 1 };
  });
}

export function closeSubjectRequest(context: PdAuthContext, idValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "CLOSE_SUBJECT_REQUEST"); const id = stage4Id(idValue); const version = positiveVersion(input.version);
  const status = enumValue(input.status, ["COMPLETED", "REJECTED_WITH_REASON", "CLOSED"] as const); const answeredAt = isoDate(input.answeredAt || nowIso());
  const event = status === "REJECTED_WITH_REASON" ? "SUBJECT_REQUEST_REJECTED" : "SUBJECT_REQUEST_COMPLETED";
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: event, targetType: "SUBJECT_REQUEST", targetId: id,
    legalBasis: requiredText(input.legalBasis, 3, 1_000), result: "SUCCESS", ipHash: context.ipHash, metadata: { status, version },
  }, (database) => {
    const result = database.prepare(`UPDATE subject_requests SET status = ?, stage4_status = ?, response_method = ?, result_summary = ?,
      answered_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`).run(legacyStatus(status), status,
      requiredText(input.responseMethod, 2, 120), requiredText(input.resultSummary, 3, 4_000), answeredAt, answeredAt, id, version);
    assertChanged(result.changes); return { id, status, version: version + 1 };
  });
}
