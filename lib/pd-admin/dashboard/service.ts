import type { DatabaseSync } from "node:sqlite";
import { verifyAccessEventChain } from "@/lib/pd-admin/audit/chain";
import type { PdAdminConfig } from "@/lib/pd-admin/config";

function count(database: DatabaseSync, sql: string, ...values: Array<string | number>) {
  return Number((database.prepare(sql).get(...values) as { count: number }).count);
}

export function dashboardSnapshot(database: DatabaseSync, config: PdAdminConfig, now = new Date()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const inSevenDays = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const workflowCount = (status: string) => count(database, "SELECT COUNT(*) AS count FROM lead_workflow WHERE internal_status = ?", status);
  const sourceCount = (source: string) => count(database, "SELECT COUNT(*) AS count FROM lead_index WHERE source = ? AND deleted_at IS NULL", source);
  const latestIntegrity = database.prepare(`
    SELECT id, started_at, completed_at, status, findings_count
    FROM integrity_runs ORDER BY started_at DESC LIMIT 1
  `).get() as {
    id: string;
    started_at: string;
    completed_at: string | null;
    status: string;
    findings_count: number;
  } | undefined;
  const latestSync = database.prepare("SELECT MAX(last_indexed_at) AS value FROM lead_index").get() as { value: string | null };
  const audit = config.auditChainKey
    ? verifyAccessEventChain(database, config.auditChainKey)
    : { valid: false, events: 0, invalidIds: [] };
  const migrationCount = count(database, "SELECT COUNT(*) AS count FROM schema_migrations");
  const adminCount = count(database, "SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN' AND is_active = 1");

  return {
    leads: {
      total: count(database, "SELECT COUNT(*) AS count FROM lead_index WHERE deleted_at IS NULL"),
      new: workflowCount("NEW"),
      inProgress: workflowCount("IN_PROGRESS"),
      needsClarification: workflowCount("NEEDS_CLARIFICATION"),
      closed: workflowCount("CLOSED"),
      today: count(database, "SELECT COUNT(*) AS count FROM lead_index WHERE created_at >= ? AND deleted_at IS NULL", today.toISOString()),
      sevenDays: count(database, "SELECT COUNT(*) AS count FROM lead_index WHERE created_at >= ? AND deleted_at IS NULL", daysAgo(7)),
      thirtyDays: count(database, "SELECT COUNT(*) AS count FROM lead_index WHERE created_at >= ? AND deleted_at IS NULL", daysAgo(30)),
      quoteForm: sourceCount("quote-form"),
      engineeringAssistant: sourceCount("engineering-assistant"),
      withAttachments: count(database, "SELECT COUNT(*) AS count FROM lead_index WHERE files_count > 0 AND deleted_at IS NULL"),
      missingConsent: count(database, "SELECT COUNT(*) AS count FROM lead_index WHERE consent_audit_status IN ('missing', 'deferred') AND deleted_at IS NULL"),
      consentDeferred: count(database, "SELECT COUNT(*) AS count FROM lead_index WHERE consent_audit_status = 'deferred' AND deleted_at IS NULL"),
      deliveryStored: count(database, "SELECT COUNT(*) AS count FROM lead_index WHERE delivery_status = 'stored' AND deleted_at IS NULL"),
      smtpDeferred: count(database, "SELECT COUNT(*) AS count FROM lead_index WHERE source = 'quote-form' AND delivery_status = 'stored' AND deleted_at IS NULL"),
      corruptJson: count(database, "SELECT COUNT(*) AS count FROM lead_index WHERE integrity_status LIKE '%CORRUPT%' AND deleted_at IS NULL"),
      missingAttachment: count(database, "SELECT COUNT(*) AS count FROM lead_index WHERE integrity_status LIKE '%MISSING_ATTACHMENT%' AND deleted_at IS NULL"),
      expiringSevenDays: count(database, "SELECT COUNT(*) AS count FROM lead_index WHERE expires_at > ? AND expires_at <= ? AND deleted_at IS NULL", now.toISOString(), inSevenDays),
      expired: count(database, "SELECT COUNT(*) AS count FROM lead_index WHERE expires_at <= ? AND deleted_at IS NULL", now.toISOString()),
      retentionOverride: count(database, "SELECT COUNT(*) AS count FROM lead_workflow WHERE retention_override_until IS NOT NULL"),
      legalHold: count(database, "SELECT COUNT(*) AS count FROM lead_workflow WHERE legal_hold_active = 1"),
    },
    integrity: {
      orphanConsent: null,
      orphanQuarantine: null,
      symlinkFindings: null,
      latest: latestIntegrity ? {
        id: latestIntegrity.id,
        startedAt: latestIntegrity.started_at,
        completedAt: latestIntegrity.completed_at,
        status: latestIntegrity.status,
        findingsCount: latestIntegrity.findings_count,
      } : null,
      auditChain: { valid: audit.events > 0 ? audit.valid : null, events: audit.events },
      lastSyncAt: latestSync.value,
    },
    users: {
      active: count(database, "SELECT COUNT(*) AS count FROM users WHERE is_active = 1"),
      locked: count(database, "SELECT COUNT(*) AS count FROM users WHERE locked_until > ?", now.toISOString()),
      failedLogins24h: count(database, "SELECT COUNT(*) AS count FROM login_attempts WHERE success = 0 AND attempted_at >= ?", daysAgo(1)),
    },
    legalOperations: {
      subjectToday: count(database, "SELECT COUNT(*) AS count FROM subject_requests WHERE id IS NOT NULL AND received_at >= ?", today.toISOString()),
      subjectInProgress: count(database, "SELECT COUNT(*) AS count FROM subject_requests WHERE id IS NOT NULL AND stage4_status NOT IN ('COMPLETED','REJECTED_WITH_REASON','CLOSED')"),
      subjectDueSoon: count(database, "SELECT COUNT(*) AS count FROM subject_requests WHERE id IS NOT NULL AND stage4_status NOT IN ('COMPLETED','REJECTED_WITH_REASON','CLOSED') AND COALESCE(extended_due_at,due_at) > ? AND COALESCE(extended_due_at,due_at) <= ?", now.toISOString(), inSevenDays),
      subjectOverdue: count(database, "SELECT COUNT(*) AS count FROM subject_requests WHERE id IS NOT NULL AND stage4_status NOT IN ('COMPLETED','REJECTED_WITH_REASON','CLOSED') AND COALESCE(extended_due_at,due_at) <= ?", now.toISOString()),
      subjectIdentity: count(database, "SELECT COUNT(*) AS count FROM subject_requests WHERE id IS NOT NULL AND stage4_identity_status NOT IN ('VERIFIED','NOT_REQUIRED')"),
      subjectApproval: count(database, "SELECT COUNT(*) AS count FROM subject_requests WHERE id IS NOT NULL AND stage4_status = 'APPROVAL_REQUIRED'"),
      authorityOpen: count(database, "SELECT COUNT(*) AS count FROM authority_requests WHERE status NOT IN ('COMPLETED','REJECTED_WITH_REASON','CLOSED')"),
      activeHolds: count(database, "SELECT COUNT(*) AS count FROM legal_holds WHERE stage4_status IN ('ACTIVE','REVIEW_REQUIRED')"),
      exportsReady: count(database, "SELECT COUNT(*) AS count FROM exports WHERE stage4_status IN ('READY','DOWNLOADED','TRANSFERRED')"),
      incidentsOpen: count(database, "SELECT COUNT(*) AS count FROM incidents WHERE stage4_status != 'CLOSED'"),
    },
    infrastructure: [
      { key: "node-loopback", label: "Node.js loopback", status: "ready", detail: "Подтверждено 08.08.2026" },
      { key: "tcp-3000", label: "TCP/3000", status: "ready", detail: "Внешний доступ закрыт" },
      { key: "tcp-3011", label: "TCP/3011", status: "ready", detail: "Внешний доступ закрыт" },
      { key: "pm2", label: "PM2", status: "ready", detail: "steelprodukt online на приёмке" },
      { key: "local-backup", label: "Локальная зашифрованная backup", status: "ready", detail: "23 файла проверены восстановлением" },
      { key: "external-backup", label: "Независимая backup", status: "warning", detail: "Отсутствует" },
      { key: "admin-enabled", label: "PD_ADMIN_ENABLED", status: config.enabled ? "ready" : "disabled", detail: config.enabled ? "Включено" : "Выключено" },
      { key: "migration", label: "Production DB migration", status: migrationCount > 0 ? "ready" : "unknown", detail: migrationCount > 0 ? "Применена" : "Не подтверждена" },
      { key: "admin-user", label: "Production ADMIN", status: adminCount > 0 ? "ready" : "unknown", detail: adminCount > 0 ? "Создан" : "Не создан" },
    ],
    backupOverall: { status: "warning", label: "Частичная готовность" },
  } as const;
}
