import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { assertPdPermission } from "@/lib/pd-admin/auth/permissions";
import { recordAccessEvent, verifyAccessEventChain } from "@/lib/pd-admin/audit/chain";

export function listAccessEvents(context: PdAuthContext, page = 1) {
  assertPdPermission(context.user.role, "VIEW_ACCESS_LOG");
  if (!context.config.auditChainKey) throw new Error("Audit configuration unavailable");
  recordAccessEvent(context.database, {
    userId: context.user.id,
    sessionId: context.session.id,
    action: "ACCESS_LOG_VIEWED",
    targetType: "ACCESS_LOG",
    legalBasis: "SECURITY_AUDIT_REVIEW",
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: { code: "REGISTER_PAGE" },
  }, context.config.auditChainKey);
  const safePage = Math.max(1, Math.floor(page));
  const pageSize = 50;
  const total = Number((context.database.prepare("SELECT COUNT(*) AS count FROM access_events").get() as { count: number }).count);
  const rows = context.database.prepare(`
    SELECT ae.id, ae.occurred_at, ae.action, ae.target_type, ae.target_id,
      ae.legal_basis, ae.result, ae.metadata_json, u.display_name, u.role
    FROM access_events ae
    LEFT JOIN users u ON u.id = ae.user_id
    ORDER BY ae.id DESC LIMIT ? OFFSET ?
  `).all(pageSize, (safePage - 1) * pageSize) as Array<{
    id: number;
    occurred_at: string;
    action: string;
    target_type: string;
    target_id: string | null;
    legal_basis: string | null;
    result: string;
    metadata_json: string;
    display_name: string | null;
    role: string | null;
  }>;
  return {
    page: safePage,
    pageSize,
    total,
    items: rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      legalBasis: row.legal_basis,
      result: row.result,
      actor: row.display_name,
      role: row.role,
      metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    })),
  };
}

export function verifyAuditForUser(context: PdAuthContext) {
  assertPdPermission(context.user.role, "VERIFY_ACCESS_LOG");
  if (!context.config.auditChainKey) throw new Error("Audit configuration unavailable");
  const result = verifyAccessEventChain(context.database, context.config.auditChainKey);
  recordAccessEvent(context.database, {
    userId: context.user.id,
    sessionId: context.session.id,
    action: "AUDIT_CHAIN_VERIFIED",
    targetType: "ACCESS_LOG",
    legalBasis: "SECURITY_INTEGRITY_CONTROL",
    result: result.valid ? "SUCCESS" : "FAILED",
    ipHash: context.ipHash,
    metadata: { count: result.events, status: result.valid ? "VALID" : "INVALID" },
  }, context.config.auditChainKey);
  return result;
}
