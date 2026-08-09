import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { assertPdPermission } from "@/lib/pd-admin/auth/permissions";
import { requestIdPattern } from "@/lib/pd-admin/storage/safe-files";
import { assertChanged, auditedTransaction, enumValue, isoDate, newStage4Id, nonNegativeInteger, nowIso, optionalStage4Id, optionalText, PdStage4Error, positiveVersion, requiredText, stage4Id, stringArray } from "@/lib/pd-admin/stage4/common";

export const incidentStatuses = ["OPEN", "ASSESSMENT", "CONTAINED", "NOTIFICATION_REQUIRED", "NOTIFIED", "INVESTIGATION", "REMEDIATION", "CLOSED"] as const;

export function listIncidents(context: PdAuthContext, page = 1) {
  assertPdPermission(context.user.role, "VIEW_INCIDENTS"); const safePage = Math.max(1, Math.floor(page)); const pageSize = 30;
  const total = Number((context.database.prepare("SELECT COUNT(*) AS count FROM incidents").get() as { count: number }).count);
  const items = context.database.prepare(`SELECT id, detected_at, affected_systems, data_categories, estimated_subjects, rkn_notification_required,
    initial_notification_at, additional_notification_at, responsible_user_id, stage4_status, closed_at, updated_at, version
    FROM incidents ORDER BY detected_at DESC LIMIT ? OFFSET ?`).all(pageSize, (safePage - 1) * pageSize);
  return { page: safePage, pageSize, total, items };
}

export function getIncident(context: PdAuthContext, idValue: string): Record<string, unknown> & { requestIds: string[] } {
  assertPdPermission(context.user.role, "VIEW_INCIDENTS"); const id = stage4Id(idValue);
  const row = context.database.prepare("SELECT * FROM incidents WHERE id = ?").get(id); if (!row) throw new PdStage4Error("NOT_FOUND");
  const requestIds = context.database.prepare("SELECT request_id FROM incident_leads WHERE incident_id = ? ORDER BY request_id").all(id)
    .map((item) => String((item as { request_id: string }).request_id));
  return { ...(row as Record<string, unknown>), requestIds };
}

export function createIncident(context: PdAuthContext, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "CREATE_INCIDENT"); const id = newStage4Id(); const createdAt = nowIso();
  const requestIds = stringArray(input.requestIds ?? [], 100); if (requestIds.some((value) => !requestIdPattern.test(value))) throw new PdStage4Error("VALIDATION_ERROR");
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "INCIDENT_CREATED", targetType: "INCIDENT", targetId: id,
    legalBasis: requiredText(input.legalBasis, 3, 1_000), result: "SUCCESS", ipHash: context.ipHash, metadata: { count: requestIds.length, status: "OPEN" },
  }, (database) => {
    database.prepare(`INSERT INTO incidents(id, detected_at, detected_by, description, affected_systems, data_categories, estimated_subjects,
      initial_measures, rkn_notification_required, responsible_user_id, status, stage4_status, updated_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'OPEN', 'OPEN', ?, 1)`)
      .run(id, isoDate(input.detectedAt), context.user.id, requiredText(input.description, 8, 8_000), requiredText(input.affectedSystems, 2, 2_000),
        requiredText(input.dataCategories, 2, 2_000), input.estimatedSubjects === null || input.estimatedSubjects === undefined ? null : nonNegativeInteger(input.estimatedSubjects),
        requiredText(input.initialMeasures, 3, 4_000), optionalStage4Id(input.responsibleUserId), createdAt);
    const link = database.prepare("INSERT INTO incident_leads(incident_id, request_id) VALUES (?, ?)"); for (const requestId of requestIds) link.run(id, requestId);
    return { id, status: "OPEN", version: 1 };
  });
}

export function updateIncident(context: PdAuthContext, idValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "UPDATE_INCIDENT"); const id = stage4Id(idValue); const version = positiveVersion(input.version);
  const status = enumValue(input.status, incidentStatuses); const updatedAt = nowIso();
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id,
    action: input.initialNotificationAt || input.additionalNotificationAt ? "INCIDENT_NOTIFICATION_RECORDED" : "INCIDENT_UPDATED",
    targetType: "INCIDENT", targetId: id, legalBasis: requiredText(input.legalBasis, 3, 1_000), result: "SUCCESS", ipHash: context.ipHash,
    metadata: { status, version },
  }, (database) => {
    const notify = input.rknNotificationRequired === true ? 1 : 0;
    const result = database.prepare(`UPDATE incidents SET description = ?, affected_systems = ?, data_categories = ?, estimated_subjects = ?,
      initial_measures = ?, rkn_notification_required = ?, notification_assessment_basis = ?, initial_notification_at = ?, additional_notification_at = ?,
      investigation_result = ?, remediation = ?, responsible_user_id = ?, status = ?, stage4_status = ?, updated_at = ?, version = version + 1
      WHERE id = ? AND version = ?`).run(requiredText(input.description, 8, 8_000), requiredText(input.affectedSystems, 2, 2_000),
      requiredText(input.dataCategories, 2, 2_000), input.estimatedSubjects === null || input.estimatedSubjects === undefined ? null : nonNegativeInteger(input.estimatedSubjects),
      requiredText(input.initialMeasures, 3, 4_000), notify, requiredText(input.notificationAssessmentBasis, 8, 2_000),
      input.initialNotificationAt ? isoDate(input.initialNotificationAt) : null, input.additionalNotificationAt ? isoDate(input.additionalNotificationAt) : null,
      optionalText(input.investigationResult, 8_000), optionalText(input.remediation, 8_000), optionalStage4Id(input.responsibleUserId),
      status === "INVESTIGATION" ? "INVESTIGATING" : status === "ASSESSMENT" || status === "NOTIFICATION_REQUIRED" || status === "REMEDIATION" ? "OPEN" : status,
      status, updatedAt, id, version);
    assertChanged(result.changes); return { id, status, version: version + 1 };
  });
}

export function closeIncident(context: PdAuthContext, idValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "CLOSE_INCIDENT"); const id = stage4Id(idValue); const version = positiveVersion(input.version); const closedAt = nowIso();
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "INCIDENT_CLOSED", targetType: "INCIDENT", targetId: id,
    legalBasis: requiredText(input.legalBasis, 3, 1_000), result: "SUCCESS", ipHash: context.ipHash, metadata: { status: "CLOSED", version },
  }, (database) => {
    const result = database.prepare(`UPDATE incidents SET investigation_result = ?, remediation = ?, closed_at = ?, status = 'CLOSED', stage4_status = 'CLOSED', updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`)
      .run(requiredText(input.investigationResult, 8, 8_000), requiredText(input.remediation, 8, 8_000), closedAt, closedAt, id, version);
    assertChanged(result.changes); return { id, status: "CLOSED", version: version + 1 };
  });
}
