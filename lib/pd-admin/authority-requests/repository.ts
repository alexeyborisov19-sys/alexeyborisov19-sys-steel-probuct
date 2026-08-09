import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { assertPdPermission } from "@/lib/pd-admin/auth/permissions";
import { requestIdPattern } from "@/lib/pd-admin/storage/safe-files";
import {
  assertChanged, auditedTransaction, enumValue, isoDate, newStage4Id, nowIso, optionalStage4Id, optionalText,
  PdStage4Error, positiveVersion, requiredText, stage4Id, stringArray,
} from "@/lib/pd-admin/stage4/common";
import { assertFiveWeekdayExtension, defaultAuthorityDueAt } from "@/lib/pd-admin/stage4/deadlines";

export const authorityRequestStatuses = ["RECEIVED", "VERIFICATION_REQUIRED", "VERIFIED", "IN_PROGRESS", "PACKAGE_PREPARED", "APPROVAL_REQUIRED", "READY_TO_TRANSFER", "TRANSFERRED", "COMPLETED", "REJECTED_WITH_REASON", "CLOSED"] as const;
export const authorityVerificationStatuses = ["NOT_STARTED", "ADDITIONAL_INFORMATION_REQUIRED", "VERIFIED", "FAILED"] as const;

export function listAuthorityRequests(context: PdAuthContext, page = 1) {
  assertPdPermission(context.user.role, "VIEW_AUTHORITY_REQUESTS"); const safePage = Math.max(1, Math.floor(page)); const pageSize = 30;
  const total = Number((context.database.prepare("SELECT COUNT(*) AS count FROM authority_requests").get() as { count: number }).count);
  const rows = context.database.prepare(`SELECT ar.id, ar.registration_number, ar.received_at, ar.authority_name, ar.request_number,
    ar.due_at, ar.extended_due_at, ar.verification_status, ar.status, ar.responsible_user_id, ar.updated_at, ar.version,
    u.display_name, (SELECT COUNT(*) FROM authority_request_leads l WHERE l.authority_request_id = ar.id) AS leads_count
    FROM authority_requests ar LEFT JOIN users u ON u.id = ar.responsible_user_id ORDER BY ar.received_at DESC LIMIT ? OFFSET ?`)
    .all(pageSize, (safePage - 1) * pageSize) as Array<Record<string, string | number | null>>;
  return { page: safePage, pageSize, total, items: rows.map((row) => ({
    id: String(row.id), registrationNumber: String(row.registration_number), receivedAt: String(row.received_at), authorityName: String(row.authority_name),
    requestNumber: String(row.request_number), dueAt: String(row.due_at), extendedDueAt: row.extended_due_at ? String(row.extended_due_at) : null,
    verificationStatus: String(row.verification_status), status: String(row.status), responsibleUserId: row.responsible_user_id ? String(row.responsible_user_id) : null,
    responsibleName: row.display_name ? String(row.display_name) : null, updatedAt: String(row.updated_at), version: Number(row.version), leadsCount: Number(row.leads_count),
  })) };
}

export function getAuthorityRequest(context: PdAuthContext, idValue: string): Record<string, unknown> & { requestIds: string[]; deadlineHistory: unknown[] } {
  assertPdPermission(context.user.role, "VIEW_AUTHORITY_REQUESTS"); const id = stage4Id(idValue);
  const row = context.database.prepare(`SELECT ar.*, u.display_name AS due_confirmed_by_name
    FROM authority_requests ar LEFT JOIN users u ON u.id = ar.due_confirmed_by WHERE ar.id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) throw new PdStage4Error("NOT_FOUND");
  const requestIds = context.database.prepare("SELECT request_id FROM authority_request_leads WHERE authority_request_id = ? ORDER BY request_id")
    .all(id).map((item) => String((item as { request_id: string }).request_id));
  const deadlineHistory = context.database.prepare("SELECT * FROM authority_request_deadline_events WHERE authority_request_id = ? ORDER BY changed_at DESC").all(id);
  return { ...row, requestIds, deadlineHistory };
}

export function createAuthorityRequest(context: PdAuthContext, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "CREATE_AUTHORITY_REQUEST"); const id = newStage4Id(); const createdAt = nowIso();
  const receivedAt = isoDate(input.receivedAt); const authorityName = requiredText(input.authorityName, 2, 300);
  const calculatedDueAt = defaultAuthorityDueAt(receivedAt, authorityName); const legalBasis = requiredText(input.legalBasis, 3, 1_000);
  const confirmedDueAt = isoDate(input.confirmedDueAt); const dueConfirmationBasis = requiredText(input.dueConfirmationBasis, 8, 1_000);
  if (Date.parse(confirmedDueAt) < Date.parse(receivedAt)) throw new PdStage4Error("VALIDATION_ERROR");
  const requestIds = stringArray(input.requestIds ?? [], 100); if (requestIds.some((value) => !requestIdPattern.test(value))) throw new PdStage4Error("VALIDATION_ERROR");
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "AUTHORITY_REQUEST_CREATED", targetType: "AUTHORITY_REQUEST", targetId: id,
    legalBasis, result: "SUCCESS", ipHash: context.ipHash, metadata: { count: requestIds.length, status: "RECEIVED" },
  }, (database) => {
    database.prepare(`INSERT INTO authority_requests(id, registration_number, received_at, authority_name, department, official_name,
      official_position, request_number, request_date, delivery_channel, legal_basis, requested_scope, due_at, initial_due_at,
      calculated_due_at, confirmed_due_at, due_confirmed_at, due_confirmed_by, due_confirmation_basis,
      responsible_user_id, status, verification_status, created_at, updated_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', 'NOT_STARTED', ?, ?, 1)`)
      .run(id, requiredText(input.registrationNumber, 3, 80), receivedAt, authorityName, optionalText(input.department, 300),
        optionalText(input.officialName, 300), optionalText(input.officialPosition, 300), requiredText(input.requestNumber, 2, 120), isoDate(input.requestDate),
        requiredText(input.deliveryChannel, 2, 120), legalBasis, requiredText(input.requestedScope, 3, 4_000), confirmedDueAt, confirmedDueAt,
        calculatedDueAt, confirmedDueAt, createdAt, context.user.id, dueConfirmationBasis,
        optionalStage4Id(input.responsibleUserId), createdAt, createdAt);
    const link = database.prepare("INSERT INTO authority_request_leads(authority_request_id, request_id) VALUES (?, ?)");
    for (const requestId of requestIds) link.run(id, requestId);
    return { id, version: 1 };
  });
}

export function updateAuthorityRequest(context: PdAuthContext, idValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "UPDATE_AUTHORITY_REQUEST"); const id = stage4Id(idValue); const version = positiveVersion(input.version);
  const status = enumValue(input.status, authorityRequestStatuses); const legalBasis = requiredText(input.legalBasis, 3, 1_000); const updatedAt = nowIso();
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "AUTHORITY_REQUEST_UPDATED", targetType: "AUTHORITY_REQUEST", targetId: id,
    legalBasis, result: "SUCCESS", ipHash: context.ipHash, metadata: { status, version },
  }, (database) => {
    const result = database.prepare(`UPDATE authority_requests SET requested_scope = ?, legal_basis = ?, responsible_user_id = ?, status = ?,
      response_channel = ?, transfer_reference = ?, result_summary = ?, response_sent_at = ?, updated_at = ?, version = version + 1
      WHERE id = ? AND version = ?`).run(requiredText(input.requestedScope, 3, 4_000), legalBasis, optionalStage4Id(input.responsibleUserId), status,
      optionalText(input.responseChannel, 120), optionalText(input.transferReference, 240), optionalText(input.resultSummary, 4_000),
      input.responseSentAt ? isoDate(input.responseSentAt) : null, updatedAt, id, version);
    assertChanged(result.changes); return { id, version: version + 1 };
  });
}

export function verifyAuthorityRequest(context: PdAuthContext, idValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "VERIFY_AUTHORITY_REQUEST"); const id = stage4Id(idValue); const version = positiveVersion(input.version);
  const verification = enumValue(input.verificationStatus, authorityVerificationStatuses.filter((value) => value !== "NOT_STARTED"));
  const basis = requiredText(input.verificationBasis, 8, 2_000); const updatedAt = nowIso();
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "AUTHORITY_REQUEST_VERIFIED", targetType: "AUTHORITY_REQUEST", targetId: id,
    legalBasis: basis, result: verification === "VERIFIED" ? "SUCCESS" : "REVIEW", ipHash: context.ipHash, metadata: { status: verification, version },
  }, (database) => {
    const status = verification === "VERIFIED" ? "VERIFIED" : "VERIFICATION_REQUIRED";
    const result = database.prepare(`UPDATE authority_requests SET verification_status = ?, status = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`)
      .run(verification, status, updatedAt, id, version); assertChanged(result.changes); return { id, verificationStatus: verification, status, version: version + 1 };
  });
}

export function extendAuthorityDeadline(context: PdAuthContext, idValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "UPDATE_AUTHORITY_REQUEST"); const id = stage4Id(idValue); const version = positiveVersion(input.version);
  const newDueAt = isoDate(input.newDueAt); const reason = requiredText(input.reason, 8, 1_000); const changedAt = nowIso();
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "AUTHORITY_REQUEST_UPDATED", targetType: "AUTHORITY_REQUEST", targetId: id,
    legalBasis: reason, result: "SUCCESS", ipHash: context.ipHash, metadata: { code: "DEADLINE_EXTENDED", version },
  }, (database) => {
    const current = database.prepare("SELECT due_at, extended_due_at, authority_name FROM authority_requests WHERE id = ? AND version = ?").get(id, version) as { due_at: string; extended_due_at: string | null; authority_name: string } | undefined;
    if (!current || Date.parse(newDueAt) <= Date.parse(current.extended_due_at || current.due_at)) throw new PdStage4Error("CONFLICT");
    if (defaultAuthorityDueAt(current.due_at, current.authority_name)) assertFiveWeekdayExtension(current.extended_due_at || current.due_at, newDueAt);
    database.prepare(`INSERT INTO authority_request_deadline_events(id, authority_request_id, previous_due_at, new_due_at, reason, changed_at, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(newStage4Id(), id, current.extended_due_at || current.due_at, newDueAt, reason, changedAt, context.user.id);
    const update = database.prepare(`UPDATE authority_requests SET extended_due_at = ?, extension_reason = ?, confirmed_due_at = ?,
      due_confirmed_at = ?, due_confirmed_by = ?, due_confirmation_basis = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`)
      .run(newDueAt, reason, newDueAt, changedAt, context.user.id, reason, changedAt, id, version); assertChanged(update.changes); return { id, extendedDueAt: newDueAt, version: version + 1 };
  });
}

export function closeAuthorityRequest(context: PdAuthContext, idValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "CLOSE_AUTHORITY_REQUEST"); const id = stage4Id(idValue); const version = positiveVersion(input.version);
  const status = enumValue(input.status, ["COMPLETED", "REJECTED_WITH_REASON", "CLOSED"] as const); const updatedAt = nowIso();
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "AUTHORITY_REQUEST_COMPLETED", targetType: "AUTHORITY_REQUEST", targetId: id,
    legalBasis: requiredText(input.legalBasis, 3, 1_000), result: "SUCCESS", ipHash: context.ipHash, metadata: { status, version },
  }, (database) => {
    const result = database.prepare(`UPDATE authority_requests SET status = ?, result_summary = ?, response_channel = ?, response_sent_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`)
      .run(status, requiredText(input.resultSummary, 3, 4_000), requiredText(input.responseChannel, 2, 120), isoDate(input.responseSentAt || updatedAt), updatedAt, id, version);
    assertChanged(result.changes); return { id, status, version: version + 1 };
  });
}
