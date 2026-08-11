import { randomUUID } from "node:crypto";
import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { assertPdPermission } from "@/lib/pd-admin/auth/permissions";
import { recordAccessEvent, verifyAccessEventChain } from "@/lib/pd-admin/audit/chain";
import { syncLeadIndex } from "@/lib/pd-admin/indexing/lead-index";

export function listIntegrityRuns(context: PdAuthContext) {
  assertPdPermission(context.user.role, "VIEW_INTEGRITY");
  const rows = context.database.prepare(`
    SELECT id, started_at, completed_at, status, findings_count, report_sha256
    FROM integrity_runs ORDER BY started_at DESC LIMIT 100
  `).all() as Array<{
    id: string;
    started_at: string;
    completed_at: string | null;
    status: string;
    findings_count: number;
    report_sha256: string | null;
  }>;
  if (!context.config.auditChainKey) throw new Error("Audit configuration unavailable");
  recordAccessEvent(context.database, {
    userId: context.user.id,
    sessionId: context.session.id,
    action: "INTEGRITY_HISTORY_VIEWED",
    targetType: "INTEGRITY_RUN",
    legalBasis: "SECURITY_INTEGRITY_CONTROL",
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: { count: rows.length, code: "HISTORY" },
  }, context.config.auditChainKey);
  return rows;
}

export async function runIntegrityCheck(context: PdAuthContext) {
  assertPdPermission(context.user.role, "RUN_INTEGRITY_CHECK");
  if (!context.config.searchHmacKey || !context.config.auditChainKey) throw new Error("Integrity configuration unavailable");
  const id = randomUUID();
  const startedAt = new Date().toISOString();
  context.database.prepare(`
    INSERT INTO integrity_runs(id, started_at, status, findings_count, executed_by)
    VALUES (?, ?, 'RUNNING', 0, ?)
  `).run(id, startedAt, context.user.id);
  let status = "COMPLETED";
  let findingsCount = 0;
  try {
    const sqlite = context.database.prepare("PRAGMA integrity_check").get() as { integrity_check?: string };
    if (sqlite.integrity_check !== "ok") findingsCount += 1;
    const index = await syncLeadIndex({
      database: context.database,
      mode: "dry-run",
      quoteRoot: process.env.QUOTE_STORAGE_PATH || ".data/quote-leads",
      assistantRoot: process.env.ASSISTANT_LEAD_STORAGE_PATH || ".data/assistant-leads",
      consentRoot: process.env.CONSENT_AUDIT_STORAGE_PATH || ".data/consent-audit",
      quarantineRoot: process.env.UPLOAD_QUARANTINE_PATH || ".data/quarantine",
      hmacKey: context.config.searchHmacKey,
      hmacKeyVersion: context.config.searchHmacKeyVersion,
    });
    findingsCount += Object.values(index.findings).reduce((sum, value) => sum + value, 0);
    if (!verifyAccessEventChain(context.database, context.config.auditChainKey).valid) findingsCount += 1;
    if (findingsCount > 0) status = "COMPLETED_WITH_FINDINGS";
  } catch {
    status = "FAILED";
    findingsCount += 1;
  }
  const completedAt = new Date().toISOString();
  context.database.prepare(`
    UPDATE integrity_runs SET completed_at = ?, status = ?, findings_count = ? WHERE id = ?
  `).run(completedAt, status, findingsCount, id);
  recordAccessEvent(context.database, {
    userId: context.user.id,
    sessionId: context.session.id,
    action: "INTEGRITY_CHECK_RUN",
    targetType: "INTEGRITY_RUN",
    targetId: id,
    legalBasis: "SECURITY_INTEGRITY_CONTROL",
    result: status === "FAILED" ? "FAILED" : "SUCCESS",
    ipHash: context.ipHash,
    metadata: { internalId: id, count: findingsCount, status },
  }, context.config.auditChainKey);
  return { id, startedAt, completedAt, status, findingsCount };
}
