import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  recordAccessEvent,
  recordAccessEventInTransaction,
  type AccessEventInput,
} from "@/lib/pd-admin/audit/chain";
import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { assertPdPermission, hasPdPermission, type PdRole } from "@/lib/pd-admin/auth/permissions";
import { contactHmac } from "@/lib/pd-admin/contacts";
import {
  openProtectedAttachment,
  readProtectedJson,
  requestIdPattern,
  safeDownloadName,
  storageIdPattern,
} from "@/lib/pd-admin/storage/safe-files";
import { isStepUpActive } from "@/lib/pd-admin/auth/session";

const PAGE_SIZE = 30;
const TEXT_SEARCH_MAX_FILES = 500;
const TEXT_SEARCH_MAX_MS = 2_000;

export const workflowStatuses = [
  "NEW",
  "IN_PROGRESS",
  "NEEDS_CLARIFICATION",
  "PROPOSAL_SENT",
  "CONTRACT",
  "CLOSED",
  "PENDING_DELETION",
  "DELETED",
] as const;
export type WorkflowStatus = (typeof workflowStatuses)[number];
const stage3MutableWorkflowStatuses = new Set<WorkflowStatus>([
  "NEW",
  "IN_PROGRESS",
  "NEEDS_CLARIFICATION",
  "PROPOSAL_SENT",
  "CONTRACT",
  "CLOSED",
]);

type ProtectedLead = {
  requestId?: unknown;
  createdAt?: unknown;
  source?: unknown;
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  company?: unknown;
  message?: unknown;
  summary?: unknown;
  engineeringState?: unknown;
  files?: unknown;
  consent?: unknown;
  consentAudit?: unknown;
  delivery?: unknown;
  retentionDays?: unknown;
};

export type LeadSummary = {
  requestId: string;
  source: "quote-form" | "engineering-assistant";
  createdAt: string;
  internalStatus: WorkflowStatus;
  assignedUserId: string | null;
  assignedDisplayName: string | null;
  filesCount: number;
  consentAuditStatus: string;
  deliveryStatus: string | null;
  integrityStatus: string;
  expiresAt: string;
  legalHoldActive: boolean;
  retentionOverrideUntil: string | null;
};

type LeadIndexDbRow = {
  request_id: string;
  source: "quote-form" | "engineering-assistant";
  created_at: string;
  internal_status: WorkflowStatus;
  assigned_user_id: string | null;
  assigned_display_name: string | null;
  files_count: number;
  consent_audit_status: string;
  delivery_status: string | null;
  integrity_status: string;
  expires_at: string;
  legal_hold_active: number;
  retention_override_until: string | null;
  storage_path_type: "quote-leads" | "assistant-leads";
};

const managerTransitions: Record<WorkflowStatus, ReadonlySet<WorkflowStatus>> = {
  NEW: new Set(["IN_PROGRESS", "NEEDS_CLARIFICATION"]),
  IN_PROGRESS: new Set(["NEEDS_CLARIFICATION", "PROPOSAL_SENT", "CLOSED"]),
  NEEDS_CLARIFICATION: new Set(["IN_PROGRESS", "CLOSED"]),
  PROPOSAL_SENT: new Set(["IN_PROGRESS", "CONTRACT", "CLOSED"]),
  CONTRACT: new Set(["CLOSED"]),
  CLOSED: new Set(),
  PENDING_DELETION: new Set(),
  DELETED: new Set(),
};

function leadRoot(storagePathType: LeadIndexDbRow["storage_path_type"]) {
  return resolve(storagePathType === "quote-leads"
    ? process.env.QUOTE_STORAGE_PATH || ".data/quote-leads"
    : process.env.ASSISTANT_LEAD_STORAGE_PATH || ".data/assistant-leads");
}

function rowToSummary(row: LeadIndexDbRow): LeadSummary {
  return {
    requestId: row.request_id,
    source: row.source,
    createdAt: row.created_at,
    internalStatus: row.internal_status,
    assignedUserId: row.assigned_user_id,
    assignedDisplayName: row.assigned_display_name,
    filesCount: row.files_count,
    consentAuditStatus: row.consent_audit_status,
    deliveryStatus: row.delivery_status,
    integrityStatus: row.integrity_status,
    expiresAt: row.expires_at,
    legalHoldActive: row.legal_hold_active === 1,
    retentionOverrideUntil: row.retention_override_until,
  };
}

function baseLeadQuery() {
  return `
    SELECT li.request_id, li.source, li.created_at, li.files_count,
      li.consent_audit_status, li.delivery_status, li.integrity_status, li.expires_at,
      li.storage_path_type, lw.internal_status, lw.assigned_user_id,
      u.display_name AS assigned_display_name, lw.legal_hold_active,
      lw.retention_override_until
    FROM lead_index li
    JOIN lead_workflow lw ON lw.request_id = li.request_id
    LEFT JOIN users u ON u.id = lw.assigned_user_id
  `;
}

function requireReason(value: string) {
  const reason = value.normalize("NFKC").trim();
  if (reason.length < 8 || reason.length > 240) throw new Error("LEGAL_BASIS_REQUIRED");
  return reason;
}

function maskName(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "Не указано";
  return `${text.slice(0, 1)}${"•".repeat(Math.min(8, Math.max(3, text.length - 1)))}`;
}

function maskPhone(value: unknown) {
  const text = typeof value === "string" ? value.replace(/\D/g, "") : "";
  return text ? `+••• ••• •• ${text.slice(-4)}` : "Не указано";
}

function maskEmail(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  const [local, domain] = text.split("@");
  if (!local || !domain) return "Не указано";
  return `${local.slice(0, 1)}•••@${domain}`;
}

function stringValue(value: unknown, maximum = 8_000) {
  return typeof value === "string" ? value.slice(0, maximum) : null;
}

function attachmentMetadata(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.storageId !== "string") return [];
    return [{
      storageId: row.storageId,
      safeName: stringValue(row.safeName, 120) || "attachment",
      browserMime: stringValue(row.browserMime, 160) || "application/octet-stream",
      size: typeof row.size === "number" ? row.size : 0,
      antivirus: stringValue(row.antivirus, 32) || "not-configured",
      safety: stringValue(row.safety, 32) || "unverified",
    }];
  });
}

function assertManagerAssignment(role: PdRole, userId: string, assignedUserId: string | null) {
  if (role === "MANAGER" && assignedUserId !== userId) throw new Error("MANAGER_NOT_ASSIGNED");
}

function readLeadIndexRow(database: DatabaseSync, requestId: string) {
  if (!requestIdPattern.test(requestId)) return null;
  return database.prepare(`${baseLeadQuery()} WHERE li.request_id = ? AND li.deleted_at IS NULL`)
    .get(requestId) as LeadIndexDbRow | undefined;
}

function auditedLeadMutation<T>(
  context: PdAuthContext,
  event: AccessEventInput,
  mutation: () => T,
) {
  if (!context.config.auditChainKey) throw new Error("Audit configuration unavailable");
  context.database.exec("BEGIN IMMEDIATE");
  try {
    const result = mutation();
    recordAccessEventInTransaction(context.database, event, context.config.auditChainKey);
    context.database.exec("COMMIT");
    return result;
  } catch (error) {
    context.database.exec("ROLLBACK");
    throw error;
  }
}

export function listLeads(
  context: PdAuthContext,
  input: { page?: number; requestId?: string; status?: string; source?: string; integrity?: string } = {},
) {
  assertPdPermission(context.user.role, "VIEW_MASKED_LEADS");
  const database = context.database;
  const page = Math.max(1, Math.min(10_000, Math.floor(input.page || 1)));
  const clauses = ["li.deleted_at IS NULL"];
  const values: Array<string | number> = [];
  if (input.requestId) {
    if (requestIdPattern.test(input.requestId)) {
      clauses.push("li.request_id = ?");
      values.push(input.requestId);
    } else {
      clauses.push("1 = 0");
    }
  }
  if (workflowStatuses.includes(input.status as WorkflowStatus)) {
    clauses.push("lw.internal_status = ?");
    values.push(input.status as string);
  }
  if (["quote-form", "engineering-assistant"].includes(input.source || "")) {
    clauses.push("li.source = ?");
    values.push(input.source as string);
  }
  if (input.integrity) {
    clauses.push("li.integrity_status = ?");
    values.push(input.integrity.slice(0, 100));
  }
  const where = ` WHERE ${clauses.join(" AND ")}`;
  const total = Number((database.prepare(`SELECT COUNT(*) AS count FROM lead_index li JOIN lead_workflow lw ON lw.request_id = li.request_id${where}`)
    .get(...values) as { count: number }).count);
  const rows = database.prepare(`${baseLeadQuery()}${where} ORDER BY li.created_at DESC LIMIT ? OFFSET ?`)
    .all(...values, PAGE_SIZE, (page - 1) * PAGE_SIZE) as LeadIndexDbRow[];
  if (!context.config.auditChainKey) throw new Error("Audit configuration unavailable");
  recordAccessEvent(database, {
    userId: context.user.id,
    sessionId: context.session.id,
    action: "LEAD_LIST_VIEWED",
    targetType: "LEAD_INDEX",
    legalBasis: "LEAD_REGISTER_REVIEW",
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: { count: rows.length, code: input.requestId ? "REQUEST_ID_FILTER" : "REGISTER_PAGE" },
  }, context.config.auditChainKey);
  return { items: rows.map(rowToSummary), page, pageSize: PAGE_SIZE, total };
}

export async function getMaskedLead(context: PdAuthContext, requestId: string) {
  assertPdPermission(context.user.role, "VIEW_MASKED_LEADS");
  const row = readLeadIndexRow(context.database, requestId);
  if (!row) return null;
  const record = await readProtectedJson<ProtectedLead>(leadRoot(row.storage_path_type), requestId);
  if (!context.config.auditChainKey) throw new Error("Audit configuration unavailable");
  recordAccessEvent(context.database, {
    userId: context.user.id,
    sessionId: context.session.id,
    action: "LEAD_VIEW_MASKED",
    targetType: "LEAD",
    targetId: requestId,
    legalBasis: "LEAD_PROCESSING",
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: { requestId, role: context.user.role },
  }, context.config.auditChainKey);
  const canViewFull = hasPdPermission(context.user.role, "VIEW_FULL_LEAD")
    && (context.user.role !== "MANAGER" || row.assigned_user_id === context.user.id);
  return {
    summary: rowToSummary(row),
    masked: {
      name: maskName(record.name),
      phone: maskPhone(record.phone),
      email: maskEmail(record.email),
      company: maskName(record.company),
    },
    canReveal: hasPdPermission(context.user.role, "REVEAL_CONTACTS")
      && (context.user.role !== "MANAGER" || row.assigned_user_id === context.user.id),
    canViewAttachments: hasPdPermission(context.user.role, "VIEW_ATTACHMENTS")
      && (context.user.role !== "MANAGER" || row.assigned_user_id === context.user.id),
    attachments: hasPdPermission(context.user.role, "VIEW_ATTACHMENTS")
      && (context.user.role !== "MANAGER" || row.assigned_user_id === context.user.id)
      ? attachmentMetadata(record.files)
      : [],
    comments: canViewFull ? context.database.prepare(`
      SELECT sc.id, sc.body, sc.created_at, sc.updated_at, sc.author_user_id, u.display_name AS author_name
      FROM staff_comments sc JOIN users u ON u.id = sc.author_user_id
      WHERE sc.request_id = ? AND sc.deleted_at IS NULL
      ORDER BY sc.created_at
    `).all(requestId) as Array<{
      id: string;
      body: string;
      created_at: string;
      updated_at: string;
      author_user_id: string;
      author_name: string;
    }> : [],
  };
}

export async function revealLead(context: PdAuthContext, requestId: string, legalBasis: string) {
  assertPdPermission(context.user.role, "REVEAL_CONTACTS");
  const basis = requireReason(legalBasis);
  const row = readLeadIndexRow(context.database, requestId);
  if (!row) return null;
  assertManagerAssignment(context.user.role, context.user.id, row.assigned_user_id);
  const record = await readProtectedJson<ProtectedLead>(leadRoot(row.storage_path_type), requestId);
  if (!context.config.auditChainKey) throw new Error("Audit configuration unavailable");
  recordAccessEvent(context.database, {
    userId: context.user.id,
    sessionId: context.session.id,
    action: "LEAD_REVEALED",
    targetType: "LEAD",
    targetId: requestId,
    legalBasis: basis,
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: { requestId, role: context.user.role },
  }, context.config.auditChainKey);
  return {
    requestId,
    name: stringValue(record.name, 120),
    phone: stringValue(record.phone, 80),
    email: stringValue(record.email, 160),
    company: stringValue(record.company, 160),
    message: stringValue(record.message, 8_000),
    summary: stringValue(record.summary, 8_000),
  };
}

export function searchContact(context: PdAuthContext, input: { kind: "phone" | "email"; value: string; legalBasis: string }) {
  assertPdPermission(context.user.role, "SEARCH_CONTACT");
  const basis = requireReason(input.legalBasis);
  if (!context.config.searchHmacKey) throw new Error("Search configuration unavailable");
  const digest = contactHmac(input.kind, input.value, context.config.searchHmacKey, context.config.searchHmacKeyVersion);
  if (!digest) throw new Error("INVALID_CONTACT");
  const column = input.kind === "phone" ? "phone_hmac" : "email_hmac";
  const versionColumn = input.kind === "phone" ? "phone_hmac_key_version" : "email_hmac_key_version";
  const rows = context.database.prepare(`${baseLeadQuery()} WHERE li.${column} = ? AND li.${versionColumn} = ? AND li.deleted_at IS NULL ORDER BY li.created_at DESC LIMIT 50`)
    .all(digest, context.config.searchHmacKeyVersion) as LeadIndexDbRow[];
  if (!context.config.auditChainKey) throw new Error("Audit configuration unavailable");
  recordAccessEvent(context.database, {
    userId: context.user.id,
    sessionId: context.session.id,
    action: "CONTACT_SEARCH",
    targetType: "LEAD_INDEX",
    legalBasis: basis,
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: { count: rows.length, role: context.user.role, code: input.kind.toUpperCase() },
  }, context.config.auditChainKey);
  return rows.map(rowToSummary);
}

export async function searchLeadText(
  context: PdAuthContext,
  input: { value: string; field: "name" | "company"; legalBasis: string },
) {
  assertPdPermission(context.user.role, "SEARCH_TEXT");
  const basis = requireReason(input.legalBasis);
  const needle = input.value.normalize("NFKC").trim().toLocaleLowerCase("ru");
  if (needle.length < 2 || needle.length > 120) throw new Error("INVALID_SEARCH");
  const started = Date.now();
  const candidates = context.database.prepare(`${baseLeadQuery()} WHERE li.deleted_at IS NULL ORDER BY li.created_at DESC LIMIT ?`)
    .all(TEXT_SEARCH_MAX_FILES) as LeadIndexDbRow[];
  const results: LeadSummary[] = [];
  for (const row of candidates) {
    if (Date.now() - started > TEXT_SEARCH_MAX_MS) break;
    try {
      const record = await readProtectedJson<ProtectedLead>(leadRoot(row.storage_path_type), row.request_id);
      const value = stringValue(record[input.field], 160)?.normalize("NFKC").toLocaleLowerCase("ru") || "";
      if (value.includes(needle)) results.push(rowToSummary(row));
      if (results.length >= 50) break;
    } catch {
      // A corrupt record is already represented by integrity_status and does not stop bounded search.
    }
  }
  if (!context.config.auditChainKey) throw new Error("Audit configuration unavailable");
  recordAccessEvent(context.database, {
    userId: context.user.id,
    sessionId: context.session.id,
    action: "TEXT_SEARCH",
    targetType: "LEAD_FILES",
    legalBasis: basis,
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: { count: results.length, role: context.user.role, code: input.field.toUpperCase() },
  }, context.config.auditChainKey);
  return results;
}

export function updateWorkflow(context: PdAuthContext, requestId: string, status: string) {
  assertPdPermission(context.user.role, "CHANGE_WORKFLOW");
  if (!stage3MutableWorkflowStatuses.has(status as WorkflowStatus)) throw new Error("INVALID_STATUS");
  const row = readLeadIndexRow(context.database, requestId);
  if (!row) return false;
  assertManagerAssignment(context.user.role, context.user.id, row.assigned_user_id);
  if (context.user.role === "MANAGER" && !managerTransitions[row.internal_status].has(status as WorkflowStatus)) {
    throw new Error("INVALID_TRANSITION");
  }
  const now = new Date().toISOString();
  return auditedLeadMutation(context, {
    occurredAt: now,
    userId: context.user.id,
    sessionId: context.session.id,
    action: "WORKFLOW_CHANGED",
    targetType: "LEAD",
    targetId: requestId,
    legalBasis: "LEAD_PROCESSING",
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: { requestId, status },
  }, () => {
    context.database.prepare(`
      UPDATE lead_workflow SET internal_status = ?, updated_at = ?, updated_by = ?
      WHERE request_id = ?
    `).run(status, now, context.user.id, requestId);
    return true;
  });
}

export function assignLead(context: PdAuthContext, requestId: string, userId: string | null) {
  assertPdPermission(context.user.role, "ASSIGN_LEAD");
  const row = readLeadIndexRow(context.database, requestId);
  if (!row) return false;
  if (userId) {
    const manager = context.database.prepare("SELECT id FROM users WHERE id = ? AND is_active = 1 AND role = 'MANAGER'")
      .get(userId);
    if (!manager) throw new Error("INVALID_ASSIGNEE");
  }
  const now = new Date().toISOString();
  return auditedLeadMutation(context, {
    occurredAt: now,
    userId: context.user.id,
    sessionId: context.session.id,
    action: "LEAD_ASSIGNED",
    targetType: "LEAD",
    targetId: requestId,
    legalBasis: "LEAD_PROCESSING",
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: { requestId, internalId: userId, code: userId ? "ASSIGNED" : "UNASSIGNED" },
  }, () => {
    context.database.prepare("UPDATE lead_workflow SET assigned_user_id = ?, updated_at = ?, updated_by = ? WHERE request_id = ?")
      .run(userId, now, context.user.id, requestId);
    return true;
  });
}

export function updateRetentionOverride(
  context: PdAuthContext,
  requestId: string,
  input: { until: string | null; reason: string },
) {
  assertPdPermission(context.user.role, "CHANGE_RETENTION");
  if (!isStepUpActive(context.session.stepUpUntil)) throw new Error("STEP_UP_REQUIRED");
  const row = readLeadIndexRow(context.database, requestId);
  if (!row) return false;
  const reason = requireReason(input.reason);
  let until: string | null = null;
  if (input.until) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.until)) throw new Error("INVALID_RETENTION");
    until = new Date(`${input.until}T23:59:59.999Z`).toISOString();
    if (Date.parse(until) <= Date.now()) throw new Error("INVALID_RETENTION");
  }
  const now = new Date().toISOString();
  return auditedLeadMutation(context, {
    occurredAt: now,
    userId: context.user.id,
    sessionId: context.session.id,
    action: until ? "RETENTION_OVERRIDE_SET" : "RETENTION_OVERRIDE_CLEARED",
    targetType: "LEAD",
    targetId: requestId,
    legalBasis: reason,
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: { requestId, status: until ? "ACTIVE" : "CLEARED" },
  }, () => {
    context.database.prepare(`
      UPDATE lead_workflow
      SET retention_override_until = ?, retention_override_reason = ?, updated_at = ?, updated_by = ?
      WHERE request_id = ?
    `).run(until, until ? reason : null, now, context.user.id, requestId);
    return true;
  });
}

export function addLeadComment(context: PdAuthContext, requestId: string, body: string) {
  assertPdPermission(context.user.role, "ADD_COMMENT");
  const row = readLeadIndexRow(context.database, requestId);
  if (!row) return null;
  assertManagerAssignment(context.user.role, context.user.id, row.assigned_user_id);
  const comment = body.normalize("NFKC").trim();
  if (comment.length < 2 || comment.length > 4_000) throw new Error("INVALID_COMMENT");
  const id = randomUUID();
  const now = new Date().toISOString();
  return auditedLeadMutation(context, {
    occurredAt: now,
    userId: context.user.id,
    sessionId: context.session.id,
    action: "COMMENT_ADDED",
    targetType: "LEAD",
    targetId: requestId,
    legalBasis: "LEAD_PROCESSING",
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: { requestId, internalId: id },
  }, () => {
    context.database.prepare(`
      INSERT INTO staff_comments(id, request_id, author_user_id, body, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, requestId, context.user.id, comment, now, now);
    return { id, createdAt: now };
  });
}

export function editOwnLeadComment(
  context: PdAuthContext,
  requestId: string,
  commentId: string,
  body: string,
) {
  assertPdPermission(context.user.role, "EDIT_OWN_COMMENT");
  const row = readLeadIndexRow(context.database, requestId);
  if (!row) return false;
  assertManagerAssignment(context.user.role, context.user.id, row.assigned_user_id);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commentId)) {
    throw new Error("INVALID_COMMENT");
  }
  const comment = body.normalize("NFKC").trim();
  if (comment.length < 2 || comment.length > 4_000) throw new Error("INVALID_COMMENT");
  const existing = context.database.prepare(`
    SELECT id FROM staff_comments
    WHERE id = ? AND request_id = ? AND author_user_id = ? AND deleted_at IS NULL
  `).get(commentId, requestId, context.user.id);
  if (!existing) return false;
  const now = new Date().toISOString();
  return auditedLeadMutation(context, {
    occurredAt: now,
    userId: context.user.id,
    sessionId: context.session.id,
    action: "COMMENT_EDITED",
    targetType: "LEAD",
    targetId: requestId,
    legalBasis: "LEAD_PROCESSING",
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: { requestId, internalId: commentId },
  }, () => {
    context.database.prepare("UPDATE staff_comments SET body = ?, updated_at = ? WHERE id = ?")
      .run(comment, now, commentId);
    return true;
  });
}

export function activeManagers(database: DatabaseSync) {
  return database.prepare("SELECT id, display_name FROM users WHERE is_active = 1 AND role = 'MANAGER' ORDER BY display_name")
    .all() as Array<{ id: string; display_name: string }>;
}

export async function attachmentForDownload(
  context: PdAuthContext,
  requestId: string,
  storageId: string,
) {
  assertPdPermission(context.user.role, "DOWNLOAD_ATTACHMENT");
  if (!storageIdPattern.test(storageId)) return null;
  const row = readLeadIndexRow(context.database, requestId);
  if (!row) return null;
  assertManagerAssignment(context.user.role, context.user.id, row.assigned_user_id);
  const record = await readProtectedJson<ProtectedLead>(leadRoot(row.storage_path_type), requestId);
  const metadata = attachmentMetadata(record.files).find((item) => item.storageId === storageId);
  if (!metadata) return null;
  if (metadata.antivirus === "blocked") {
    if (context.user.role === "MANAGER" || !isStepUpActive(context.session.stepUpUntil)) {
      throw new Error("STEP_UP_REQUIRED");
    }
  }
  const opened = await openProtectedAttachment(
    resolve(process.env.UPLOAD_QUARANTINE_PATH || ".data/quarantine"),
    requestId,
    storageId,
  );
  if (!context.config.auditChainKey) {
    await opened.handle.close();
    throw new Error("Audit configuration unavailable");
  }
  recordAccessEvent(context.database, {
    userId: context.user.id,
    sessionId: context.session.id,
    action: "ATTACHMENT_DOWNLOADED",
    targetType: "ATTACHMENT",
    targetId: storageId,
    legalBasis: "LEAD_PROCESSING",
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: {
      requestId,
      internalId: storageId,
      bytes: metadata.size,
      status: metadata.antivirus,
    },
  }, context.config.auditChainKey);
  return {
    ...opened,
    downloadName: safeDownloadName(metadata.safeName),
    browserMime: metadata.browserMime,
    antivirus: metadata.antivirus,
  };
}

export async function listQuarantineOrphans(quarantineRoot: string) {
  const entries = await readdir(resolve(quarantineRoot), { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory() && requestIdPattern.test(entry.name)).length;
}
