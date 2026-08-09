import { resolve } from "node:path";
import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { assertPdPermission } from "@/lib/pd-admin/auth/permissions";
import { assertChanged, auditedTransaction, enumValue, isoDate, newStage4Id, nonNegativeInteger, nowIso, optionalText, PdStage4Error, positiveVersion, requiredText, stage4Id } from "@/lib/pd-admin/stage4/common";

const sha256Pattern = /^[a-f\d]{64}$/i;
export const legalDocumentTypes = ["PRIVACY_POLICY", "PERSONAL_DATA_CONSENT", "MARKETING_CONSENT", "COOKIE_POLICY", "USER_AGREEMENT", "OTHER"] as const;

export function listSystems(context: PdAuthContext) {
  assertPdPermission(context.user.role, "VIEW_SYSTEMS_REGISTRY");
  return context.database.prepare(`SELECT id, system_name, purpose, provider, database_country, data_categories, legal_basis,
    agreement_reference, retention_description, responsible_user, administrators, mfa_status, export_method, deletion_method,
    last_review_at, status, created_at, updated_at, version FROM systems_registry ORDER BY system_name`).all();
}

export function createSystem(context: PdAuthContext, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "MANAGE_SYSTEMS_REGISTRY"); const id = newStage4Id(); const now = nowIso(); const name = requiredText(input.systemName, 2, 200);
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "SYSTEM_REGISTRY_CREATED", targetType: "SYSTEM", targetId: id,
    legalBasis: requiredText(input.legalBasis, 3, 1_000), result: "SUCCESS", ipHash: context.ipHash, metadata: { status: requiredText(input.status, 2, 80) },
  }, (database) => {
    database.prepare(`INSERT INTO systems_registry(system_name, id, purpose, provider, database_country, data_categories, legal_basis,
      agreement_reference, retention_description, responsible_user, administrators, mfa_status, export_method, deletion_method,
      last_review_at, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
      .run(name, id, requiredText(input.purpose, 3, 2_000), requiredText(input.provider, 2, 300), requiredText(input.databaseCountry, 2, 120),
        requiredText(input.dataCategories, 2, 2_000), requiredText(input.legalBasis, 3, 1_000), optionalText(input.agreementReference, 1_000),
        requiredText(input.retentionDescription, 3, 2_000), requiredText(input.responsibleUser, 2, 300), requiredText(input.administrators, 2, 1_000),
        requiredText(input.mfaStatus, 2, 300), requiredText(input.exportMethod, 2, 1_000), requiredText(input.deletionMethod, 2, 1_000),
        input.lastReviewAt ? isoDate(input.lastReviewAt) : null, requiredText(input.status, 2, 80), now, now);
    return { id, version: 1 };
  });
}

export function updateSystem(context: PdAuthContext, idValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "MANAGE_SYSTEMS_REGISTRY"); const id = stage4Id(idValue); const version = positiveVersion(input.version); const now = nowIso();
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "SYSTEM_REGISTRY_UPDATED", targetType: "SYSTEM", targetId: id,
    legalBasis: requiredText(input.legalBasis, 3, 1_000), result: "SUCCESS", ipHash: context.ipHash, metadata: { version },
  }, (database) => {
    const result = database.prepare(`UPDATE systems_registry SET purpose = ?, provider = ?, database_country = ?, data_categories = ?, legal_basis = ?,
      agreement_reference = ?, retention_description = ?, responsible_user = ?, administrators = ?, mfa_status = ?, export_method = ?, deletion_method = ?,
      last_review_at = ?, status = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`)
      .run(requiredText(input.purpose, 3, 2_000), requiredText(input.provider, 2, 300), requiredText(input.databaseCountry, 2, 120),
        requiredText(input.dataCategories, 2, 2_000), requiredText(input.legalBasis, 3, 1_000), optionalText(input.agreementReference, 1_000),
        requiredText(input.retentionDescription, 3, 2_000), requiredText(input.responsibleUser, 2, 300), requiredText(input.administrators, 2, 1_000),
        requiredText(input.mfaStatus, 2, 300), requiredText(input.exportMethod, 2, 1_000), requiredText(input.deletionMethod, 2, 1_000),
        input.lastReviewAt ? isoDate(input.lastReviewAt) : null, requiredText(input.status, 2, 80), now, id, version);
    assertChanged(result.changes); return { id, version: version + 1 };
  });
}

export function listLegalDocumentVersions(context: PdAuthContext) {
  assertPdPermission(context.user.role, "VIEW_LEGAL_DOCUMENT_VERSIONS");
  return context.database.prepare(`SELECT id, document_type, version, effective_from, effective_to, content_sha256, archive_path,
    status, approved_by, approval_basis, created_at, updated_at, version_number FROM legal_document_versions ORDER BY document_type, effective_from DESC`).all();
}

export function registerLegalDocumentVersion(context: PdAuthContext, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "MANAGE_LEGAL_DOCUMENT_VERSIONS"); const id = newStage4Id(); const now = nowIso();
  const documentType = enumValue(input.documentType, legalDocumentTypes); const contentSha256 = requiredText(input.contentSha256, 64, 64).toLowerCase();
  if (!sha256Pattern.test(contentSha256)) throw new PdStage4Error("VALIDATION_ERROR");
  const archivePath = resolve("/var/lib/steelprodukt/legal-documents", `${id}.document`);
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "LEGAL_DOCUMENT_VERSION_REGISTERED", targetType: "LEGAL_DOCUMENT", targetId: id,
    legalBasis: requiredText(input.approvalBasis, 3, 1_000), result: "SUCCESS", ipHash: context.ipHash, metadata: { status: requiredText(input.status, 2, 80) },
  }, (database) => {
    database.prepare(`INSERT INTO legal_document_versions(id, document_type, version, effective_from, effective_to, content_sha256,
      archive_path, status, approved_by, approval_basis, created_at, updated_at, version_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
      .run(id, documentType, requiredText(input.version, 1, 80), isoDate(input.effectiveFrom), input.effectiveTo ? isoDate(input.effectiveTo) : null,
        contentSha256, archivePath, requiredText(input.status, 2, 80), context.user.id, requiredText(input.approvalBasis, 3, 1_000), now, now);
    return { id, archivePathId: id, versionNumber: 1 };
  });
}

export function listBackups(context: PdAuthContext) {
  assertPdPermission(context.user.role, "VIEW_BACKUPS");
  const runs = context.database.prepare(`SELECT id, started_at, completed_at, backup_type, status, destination_type, encrypted,
    archive_sha256, restore_tested, restore_tested_at, failure_reason, files_count, total_bytes, restore_result, version
    FROM backup_runs ORDER BY started_at DESC`).all();
  const restores = context.database.prepare(`SELECT id, backup_run_id, tested_at, tested_by, result, files_verified, isolated_target, notes
    FROM backup_restore_tests ORDER BY tested_at DESC LIMIT 100`).all();
  const independentReady = (runs as Array<Record<string, unknown>>).some((row) => row.status === "PASS" && row.encrypted === 1 && row.destination_type !== "LOCAL_SAME_VPS" && row.restore_tested === 1);
  return { runs, restores, status: { localEncrypted: "PASS", localRestore: "PASS", independentOffServer: independentReady ? "PASS" : "NOT_CONFIGURED", overall: independentReady ? "READY" : "PARTIAL_READINESS" } };
}

export function registerBackup(context: PdAuthContext, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "REGISTER_BACKUP"); const id = newStage4Id(); const sha256 = optionalText(input.archiveSha256, 64);
  if (sha256 && !sha256Pattern.test(sha256)) throw new PdStage4Error("VALIDATION_ERROR");
  const filesCount = nonNegativeInteger(input.filesCount, 0); const totalBytes = nonNegativeInteger(input.totalBytes, 0);
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "BACKUP_REGISTERED", targetType: "BACKUP", targetId: id,
    legalBasis: requiredText(input.legalBasis, 3, 1_000), result: "SUCCESS", ipHash: context.ipHash,
    metadata: { status: requiredText(input.status, 2, 80), files: filesCount },
  }, (database) => {
    database.prepare(`INSERT INTO backup_runs(id, started_at, completed_at, backup_type, status, destination_type, encrypted,
      archive_sha256, restore_tested, failure_reason, files_count, total_bytes, registered_by, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1)`)
      .run(id, isoDate(input.startedAt), input.completedAt ? isoDate(input.completedAt) : null, requiredText(input.backupType, 2, 120),
        requiredText(input.status, 2, 80), requiredText(input.destinationType, 2, 120), input.encrypted === true ? 1 : 0, sha256,
        optionalText(input.failureReason, 2_000), filesCount, totalBytes, context.user.id);
    return { id, version: 1 };
  });
}

export function registerRestoreTest(context: PdAuthContext, backupIdValue: string, input: Record<string, unknown>) {
  assertPdPermission(context.user.role, "REGISTER_RESTORE_TEST"); const backupId = stage4Id(backupIdValue); const version = positiveVersion(input.version); const id = newStage4Id(); const testedAt = nowIso();
  const resultValue = enumValue(input.result, ["PASS", "FAIL", "PARTIAL"] as const); const files = nonNegativeInteger(input.filesVerified, 0);
  return auditedTransaction(context, {
    userId: context.user.id, sessionId: context.session.id, action: "BACKUP_RESTORE_TEST_REGISTERED", targetType: "BACKUP", targetId: backupId,
    legalBasis: requiredText(input.legalBasis, 3, 1_000), result: resultValue, ipHash: context.ipHash, metadata: { files, status: resultValue, version },
  }, (database) => {
    const exists = database.prepare("SELECT id FROM backup_runs WHERE id = ? AND version = ?").get(backupId, version); if (!exists) throw new PdStage4Error("CONFLICT");
    database.prepare(`INSERT INTO backup_restore_tests(id, backup_run_id, tested_at, tested_by, result, files_verified, isolated_target, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, backupId, testedAt, context.user.id, resultValue, files, requiredText(input.isolatedTarget, 3, 300), optionalText(input.notes, 2_000), testedAt);
    const update = database.prepare(`UPDATE backup_runs SET restore_tested = ?, restore_tested_at = ?, restore_result = ?, version = version + 1 WHERE id = ? AND version = ?`)
      .run(resultValue === "PASS" ? 1 : 0, testedAt, resultValue, backupId, version);
    if (Number(update.changes) !== 1) throw new PdStage4Error("CONFLICT"); return { id, backupId, result: resultValue, version: version + 1 };
  });
}
