import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { assertPdPermission } from "@/lib/pd-admin/auth/permissions";
import { isStepUpActive } from "@/lib/pd-admin/auth/session";
import { requestIdPattern } from "@/lib/pd-admin/storage/safe-files";
import {
  assertChanged, auditedTransaction, enumValue, isoDate, newStage4Id, nowIso, optionalStage4Id, optionalText,
  PdStage4Error, positiveVersion, requiredText, stage4Id, stringArray,
} from "@/lib/pd-admin/stage4/common";

export const legalHoldStatuses = ["ACTIVE", "REVIEW_REQUIRED", "RELEASED"] as const;

export function listLegalHolds(context: PdAuthContext, page = 1) {
  assertPdPermission(context.user.role, "VIEW_LEGAL_HOLD"); const safePage = Math.max(1, Math.floor(page)); const pageSize = 30;
  const total = Number((context.database.prepare("SELECT COUNT(*) AS count FROM legal_holds").get() as { count: number }).count);
  const items = context.database.prepare(`SELECT lh.id, lh.reason, lh.basis_document, lh.started_at, lh.review_at, lh.ended_at,
    lh.stage4_status, lh.subject_request_id, lh.authority_request_id, lh.incident_id, lh.version,
    (SELECT COUNT(*) FROM legal_hold_leads lhl WHERE lhl.legal_hold_id = lh.id) AS leads_count
    FROM legal_holds lh ORDER BY lh.started_at DESC LIMIT ? OFFSET ?`).all(pageSize, (safePage - 1) * pageSize);
  return { page: safePage, pageSize, total, items };
}

export function getLegalHold(context: PdAuthContext, idValue: string): Record<string, unknown> & { requestIds: string[] } {
  assertPdPermission(context.user.role, "VIEW_LEGAL_HOLD"); const id = stage4Id(idValue);
  const row = context.database.prepare("SELECT * FROM legal_holds WHERE id = ?").get(id);
  if (!row) throw new PdStage4Error("NOT_FOUND");
  const requestIds = context.database.prepare("SELECT request_id FROM legal_hold_leads WHERE legal_hold_id = ? ORDER BY request_id")
    .all(id).map((item) => String((item as { request_id: string }).request_id));
  return { ...(row as Record<string, unknown>), requestIds };
}

export function createLegalHold(context: PdAuthContext, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "CREATE_LEGAL_HOLD"); const id = newStage4Id(); const now = nowIso();
  const requestIds = stringArray(input.requestIds, 100); if (!requestIds.length || requestIds.some((value) => !requestIdPattern.test(value))) throw new PdStage4Error("VALIDATION_ERROR");
  const reason = requiredText(input.reason, 8, 2_000); const reviewAt = isoDate(input.reviewAt);
  if (Date.parse(reviewAt) <= Date.parse(now)) throw new PdStage4Error("VALIDATION_ERROR");
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "LEGAL_HOLD_CREATED", targetType: "LEGAL_HOLD", targetId: id,
    legalBasis: reason, result: "SUCCESS", ipHash: context.ipHash, metadata: { count: requestIds.length, status: "ACTIVE" },
  }, (database) => {
    database.prepare(`INSERT INTO legal_holds(id, request_id, reason, basis_document, started_at, review_at, created_by, status,
      subject_request_id, authority_request_id, incident_id, stage4_status, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, 'ACTIVE', 1)`)
      .run(id, requestIds[0], reason, optionalText(input.basisDocument, 1_000), now, reviewAt, context.user.id,
        optionalStage4Id(input.subjectRequestId), optionalStage4Id(input.authorityRequestId), optionalStage4Id(input.incidentId));
    const link = database.prepare("INSERT INTO legal_hold_leads(legal_hold_id, request_id) VALUES (?, ?)");
    const mark = database.prepare("UPDATE lead_workflow SET legal_hold_active = 1, updated_at = ?, updated_by = ? WHERE request_id = ?");
    for (const requestId of requestIds) { link.run(id, requestId); mark.run(now, context.user.id, requestId); }
    return { id, status: "ACTIVE", version: 1 };
  });
}

export function reviewLegalHold(context: PdAuthContext, idValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "CREATE_LEGAL_HOLD"); const id = stage4Id(idValue); const version = positiveVersion(input.version);
  const status = enumValue(input.status, ["ACTIVE", "REVIEW_REQUIRED"] as const); const reviewAt = isoDate(input.reviewAt);
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "LEGAL_HOLD_REVIEWED", targetType: "LEGAL_HOLD", targetId: id,
    legalBasis: requiredText(input.reason, 8, 1_000), result: "SUCCESS", ipHash: context.ipHash, metadata: { status, version },
  }, (database) => {
    const result = database.prepare("UPDATE legal_holds SET review_at = ?, stage4_status = ?, reason = ?, version = version + 1 WHERE id = ? AND version = ? AND stage4_status != 'RELEASED'")
      .run(reviewAt, status, requiredText(input.reason, 8, 2_000), id, version); assertChanged(result.changes); return { id, status, version: version + 1 };
  });
}

export function releaseLegalHold(context: PdAuthContext, idValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "RELEASE_LEGAL_HOLD"); if (!isStepUpActive(context.session.stepUpUntil)) throw new PdStage4Error("STEP_UP_REQUIRED");
  const id = stage4Id(idValue); const version = positiveVersion(input.version); const reason = requiredText(input.reason, 8, 2_000); const endedAt = nowIso();
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "LEGAL_HOLD_RELEASED", targetType: "LEGAL_HOLD", targetId: id,
    legalBasis: reason, result: "SUCCESS", ipHash: context.ipHash, metadata: { status: "RELEASED", version },
  }, (database) => {
    const requestIds = database.prepare("SELECT request_id FROM legal_hold_leads WHERE legal_hold_id = ?").all(id)
      .map((row) => String((row as { request_id: string }).request_id));
    if (!requestIds.length) throw new PdStage4Error("NOT_FOUND");
    const result = database.prepare(`UPDATE legal_holds SET ended_at = ?, ended_by = ?, release_reason = ?, status = 'RELEASED', stage4_status = 'RELEASED', version = version + 1
      WHERE id = ? AND version = ? AND stage4_status != 'RELEASED'`).run(endedAt, context.user.id, reason, id, version); assertChanged(result.changes);
    const active = database.prepare(`SELECT COUNT(*) AS count FROM legal_hold_leads lhl JOIN legal_holds lh ON lh.id = lhl.legal_hold_id
      WHERE lhl.request_id = ? AND lh.stage4_status IN ('ACTIVE','REVIEW_REQUIRED')`);
    const clear = database.prepare("UPDATE lead_workflow SET legal_hold_active = ?, updated_at = ?, updated_by = ? WHERE request_id = ?");
    let remainingActive = 0;
    for (const requestId of requestIds) {
      const count = Number((active.get(requestId) as { count: number }).count); remainingActive += count; clear.run(count > 0 ? 1 : 0, endedAt, context.user.id, requestId);
    }
    return { id, status: "RELEASED", version: version + 1, remainingActive };
  });
}
