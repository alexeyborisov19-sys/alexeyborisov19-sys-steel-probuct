import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { assertPdPermission } from "@/lib/pd-admin/auth/permissions";
import { recordAccessEvent } from "@/lib/pd-admin/audit/chain";
import { auditIdPattern, readProtectedJson, requestIdPattern } from "@/lib/pd-admin/storage/safe-files";

type ConsentRecord = {
  auditId?: unknown;
  event?: unknown;
  requestId?: unknown;
  createdAt?: unknown;
  clientTimestamp?: unknown;
  personalData?: unknown;
  personalDataConsentVersion?: unknown;
  privacyVersion?: unknown;
  marketing?: unknown;
  marketingConsentVersion?: unknown;
  retentionDays?: unknown;
};

export type ConsentSummary = {
  auditId: string;
  requestId: string;
  event: string;
  createdAt: string;
  personalDataConsentVersion: string;
  privacyVersion: string;
  marketing: boolean;
};

function consentRoot() {
  return resolve(process.env.CONSENT_AUDIT_STORAGE_PATH || ".data/consent-audit");
}

function stringValue(value: unknown, maximum = 200) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

function sanitizeConsent(record: ConsentRecord, auditId: string): ConsentSummary | null {
  const requestId = stringValue(record.requestId, 64);
  const createdAt = stringValue(record.createdAt, 64);
  if (!requestIdPattern.test(requestId) || !Number.isFinite(Date.parse(createdAt))) return null;
  return {
    auditId,
    requestId,
    event: stringValue(record.event, 80),
    createdAt,
    personalDataConsentVersion: stringValue(record.personalDataConsentVersion, 64),
    privacyVersion: stringValue(record.privacyVersion, 64),
    marketing: record.marketing === true,
  };
}

export async function listConsentRecords(context: PdAuthContext, page = 1) {
  assertPdPermission(context.user.role, "VIEW_CONSENT");
  const entries = await readdir(consentRoot(), { withFileTypes: true }).catch(() => []);
  const ids = entries
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.slice(0, -5))
    .filter((id) => auditIdPattern.test(id))
    .sort()
    .reverse();
  const safePage = Math.max(1, Math.floor(page));
  const selected = ids.slice((safePage - 1) * 30, safePage * 30);
  const items: ConsentSummary[] = [];
  for (const id of selected) {
    try {
      const record = await readProtectedJson<ConsentRecord>(consentRoot(), id, { idPattern: auditIdPattern });
      const summary = sanitizeConsent(record, id);
      if (summary) items.push(summary);
    } catch {
      // Corrupt consent files are surfaced by integrity checks; list rendering continues.
    }
  }
  if (!context.config.auditChainKey) throw new Error("Audit configuration unavailable");
  recordAccessEvent(context.database, {
    userId: context.user.id,
    sessionId: context.session.id,
    action: "CONSENT_LIST_VIEWED",
    targetType: "CONSENT_AUDIT",
    legalBasis: "CONSENT_REGISTER_REVIEW",
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: { count: items.length, code: "REGISTER_PAGE" },
  }, context.config.auditChainKey);
  return { items, page: safePage, pageSize: 30, total: ids.length };
}

export async function getConsentRecord(context: PdAuthContext, auditId: string) {
  assertPdPermission(context.user.role, "VIEW_CONSENT");
  if (!auditIdPattern.test(auditId)) return null;
  const record = await readProtectedJson<ConsentRecord>(consentRoot(), auditId, { idPattern: auditIdPattern });
  const summary = sanitizeConsent(record, auditId);
  if (!summary) return null;
  if (!context.config.auditChainKey) throw new Error("Audit configuration unavailable");
  recordAccessEvent(context.database, {
    userId: context.user.id,
    sessionId: context.session.id,
    action: "CONSENT_VIEWED",
    targetType: "CONSENT_AUDIT",
    targetId: auditId,
    legalBasis: "CONSENT_VERIFICATION",
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: { requestId: summary.requestId, internalId: auditId, role: context.user.role },
  }, context.config.auditChainKey);
  return {
    ...summary,
    clientTimestamp: stringValue(record.clientTimestamp, 64) || null,
    personalData: record.personalData === true,
    marketingConsentVersion: stringValue(record.marketingConsentVersion, 64) || null,
    retentionDays: typeof record.retentionDays === "number" ? record.retentionDays : null,
  };
}
