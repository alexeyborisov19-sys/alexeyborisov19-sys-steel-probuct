import { readdir } from "node:fs/promises";
import { basename } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { contactHmac } from "@/lib/pd-admin/contacts";
import {
  auditIdPattern,
  PdSafeFileError,
  readProtectedJson,
  requestIdPattern,
  resolveProtectedFile,
  storageIdPattern,
} from "@/lib/pd-admin/storage/safe-files";

type LeadFile = {
  requestId?: unknown;
  createdAt?: unknown;
  source?: unknown;
  phone?: unknown;
  email?: unknown;
  retentionDays?: unknown;
  consentAudit?: unknown;
  delivery?: unknown;
  files?: unknown;
};

type ConsentFile = {
  auditId?: unknown;
  requestId?: unknown;
};

export type LeadIndexMode = "full" | "incremental" | "dry-run" | "specific";

export type LeadIndexFindingCode =
  | "CORRUPT_JSON"
  | "INVALID_ID"
  | "MISSING_ATTACHMENT"
  | "MISSING_CONSENT_AUDIT"
  | "ORPHAN_ATTACHMENT_DIRECTORY"
  | "ORPHAN_CONSENT_AUDIT"
  | "SYMLINK_IGNORED";

export type LeadIndexResult = {
  mode: LeadIndexMode;
  examined: number;
  indexed: number;
  unchanged: number;
  findings: Record<LeadIndexFindingCode, number>;
};

export type LeadIndexOptions = {
  database: DatabaseSync;
  mode: LeadIndexMode;
  requestId?: string;
  quoteRoot: string;
  assistantRoot: string;
  consentRoot: string;
  quarantineRoot: string;
  hmacKey: string;
  hmacKeyVersion: number;
  now?: Date;
};

const findingCodes: LeadIndexFindingCode[] = [
  "CORRUPT_JSON",
  "INVALID_ID",
  "MISSING_ATTACHMENT",
  "MISSING_CONSENT_AUDIT",
  "ORPHAN_ATTACHMENT_DIRECTORY",
  "ORPHAN_CONSENT_AUDIT",
  "SYMLINK_IGNORED",
];

function emptyFindings() {
  return Object.fromEntries(findingCodes.map((code) => [code, 0])) as Record<LeadIndexFindingCode, number>;
}

function addFinding(findings: Record<LeadIndexFindingCode, number>, code: LeadIndexFindingCode) {
  findings[code] += 1;
}

function expiration(createdAt: string, retentionDays: number) {
  return new Date(Date.parse(createdAt) + retentionDays * 86_400_000).toISOString();
}

function validateLeadIdentity(record: LeadFile, requestId: string, expectedSource: string) {
  return record.requestId === requestId && record.source === expectedSource;
}

function fileMetadata(record: LeadFile) {
  if (!Array.isArray(record.files)) return [];
  return record.files.filter((item): item is { storageId: string } =>
    Boolean(item && typeof item === "object" && storageIdPattern.test(String((item as { storageId?: unknown }).storageId ?? ""))),
  );
}

async function jsonEntries(root: string) {
  try {
    return await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function scanConsentAudit(
  consentRoot: string,
  findings: Record<LeadIndexFindingCode, number>,
) {
  const requestIds = new Set<string>();
  for (const entry of await jsonEntries(consentRoot)) {
    if (entry.isSymbolicLink()) {
      addFinding(findings, "SYMLINK_IGNORED");
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const auditId = basename(entry.name, ".json");
    if (!auditIdPattern.test(auditId)) {
      addFinding(findings, "INVALID_ID");
      continue;
    }
    try {
      const record = await readProtectedJson<ConsentFile>(consentRoot, auditId, { idPattern: auditIdPattern });
      if (record.auditId !== auditId || typeof record.requestId !== "string" || !requestIdPattern.test(record.requestId)) {
        addFinding(findings, "CORRUPT_JSON");
        continue;
      }
      requestIds.add(record.requestId);
    } catch {
      addFinding(findings, "CORRUPT_JSON");
    }
  }
  return requestIds;
}

async function validateAttachments(
  record: LeadFile,
  requestId: string,
  quarantineRoot: string,
  findings: Record<LeadIndexFindingCode, number>,
) {
  let missing = false;
  for (const file of fileMetadata(record)) {
    try {
      await resolveProtectedFile(quarantineRoot, [requestId, file.storageId]);
    } catch (error) {
      missing = true;
      addFinding(findings, error instanceof PdSafeFileError && error.reason === "SYMLINK"
        ? "SYMLINK_IGNORED"
        : "MISSING_ATTACHMENT");
    }
  }
  return { count: fileMetadata(record).length, missing };
}

function upsertLead(
  database: DatabaseSync,
  input: {
    requestId: string;
    source: "quote-form" | "engineering-assistant";
    createdAt: string;
    storagePathType: "quote-leads" | "assistant-leads";
    phoneHmac: string | null;
    emailHmac: string | null;
    hmacKeyVersion: number;
    retentionDays: number;
    expiresAt: string;
    consentAuditStatus: string;
    deliveryStatus: string | null;
    filesCount: number;
    integrityStatus: string;
    indexedAt: string;
  },
) {
  const existing = database.prepare("SELECT id FROM lead_index WHERE request_id = ?").get(input.requestId);
  database.prepare(`
    INSERT INTO lead_index(
      request_id, source, created_at, storage_path_type,
      phone_hmac, phone_hmac_key_version, email_hmac, email_hmac_key_version,
      retention_days, expires_at, consent_audit_status, delivery_status,
      files_count, integrity_status, first_indexed_at, last_indexed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(request_id) DO UPDATE SET
      source = excluded.source,
      created_at = excluded.created_at,
      storage_path_type = excluded.storage_path_type,
      phone_hmac = excluded.phone_hmac,
      phone_hmac_key_version = excluded.phone_hmac_key_version,
      email_hmac = excluded.email_hmac,
      email_hmac_key_version = excluded.email_hmac_key_version,
      retention_days = excluded.retention_days,
      expires_at = excluded.expires_at,
      consent_audit_status = excluded.consent_audit_status,
      delivery_status = excluded.delivery_status,
      files_count = excluded.files_count,
      integrity_status = excluded.integrity_status,
      last_indexed_at = excluded.last_indexed_at
  `).run(
    input.requestId,
    input.source,
    input.createdAt,
    input.storagePathType,
    input.phoneHmac,
    input.phoneHmac ? input.hmacKeyVersion : null,
    input.emailHmac,
    input.emailHmac ? input.hmacKeyVersion : null,
    input.retentionDays,
    input.expiresAt,
    input.consentAuditStatus,
    input.deliveryStatus,
    input.filesCount,
    input.integrityStatus,
    input.indexedAt,
    input.indexedAt,
  );
  database.prepare(`
    INSERT INTO lead_workflow(request_id, internal_status, created_at, updated_at)
    VALUES (?, 'NEW', ?, ?)
    ON CONFLICT(request_id) DO NOTHING
  `).run(input.requestId, input.indexedAt, input.indexedAt);
  return existing ? "updated" : "inserted";
}

export async function syncLeadIndex(options: LeadIndexOptions): Promise<LeadIndexResult> {
  if (options.mode === "specific" && (!options.requestId || !requestIdPattern.test(options.requestId))) {
    throw new Error("A valid requestId is required for specific mode");
  }
  if (!options.hmacKey) throw new Error("PD search HMAC key is required for contact indexing");
  const findings = emptyFindings();
  const consentRequestIds = await scanConsentAudit(options.consentRoot, findings);
  const discoveredLeadIds = new Set<string>();
  const indexedAt = (options.now ?? new Date()).toISOString();
  let examined = 0;
  let indexed = 0;
  let unchanged = 0;

  const sources = [
    { root: options.quoteRoot, source: "quote-form" as const, storage: "quote-leads" as const },
    { root: options.assistantRoot, source: "engineering-assistant" as const, storage: "assistant-leads" as const },
  ];

  for (const source of sources) {
    for (const entry of await jsonEntries(source.root)) {
      if (entry.isSymbolicLink()) {
        addFinding(findings, "SYMLINK_IGNORED");
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const requestId = basename(entry.name, ".json");
      if (options.mode === "specific" && requestId !== options.requestId) continue;
      examined += 1;
      if (!requestIdPattern.test(requestId)) {
        addFinding(findings, "INVALID_ID");
        continue;
      }
      discoveredLeadIds.add(requestId);
      try {
        const record = await readProtectedJson<LeadFile>(source.root, requestId);
        if (!validateLeadIdentity(record, requestId, source.source)) {
          addFinding(findings, "CORRUPT_JSON");
          continue;
        }
        const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
        const retentionDays = Number(record.retentionDays);
        if (!Number.isFinite(Date.parse(createdAt)) || !Number.isInteger(retentionDays) || retentionDays < 1) {
          addFinding(findings, "CORRUPT_JSON");
          continue;
        }
        const consentPresent = consentRequestIds.has(requestId);
        if (!consentPresent) addFinding(findings, "MISSING_CONSENT_AUDIT");
        const attachments = await validateAttachments(record, requestId, options.quarantineRoot, findings);
        const integrity = [
          !consentPresent ? "MISSING_CONSENT_AUDIT" : null,
          attachments.missing ? "MISSING_ATTACHMENT" : null,
        ].filter(Boolean).join("|") || "OK";
        const phone = typeof record.phone === "string" ? record.phone : "";
        const email = typeof record.email === "string" ? record.email : "";
        if (options.mode === "dry-run") {
          unchanged += 1;
          continue;
        }
        upsertLead(options.database, {
          requestId,
          source: source.source,
          storagePathType: source.storage,
          createdAt,
          phoneHmac: contactHmac("phone", phone, options.hmacKey, options.hmacKeyVersion),
          emailHmac: contactHmac("email", email, options.hmacKey, options.hmacKeyVersion),
          hmacKeyVersion: options.hmacKeyVersion,
          retentionDays,
          expiresAt: expiration(createdAt, retentionDays),
          consentAuditStatus: consentPresent ? "recorded" : String(record.consentAudit || "missing"),
          deliveryStatus: typeof record.delivery === "string" ? record.delivery : null,
          filesCount: attachments.count,
          integrityStatus: integrity,
          indexedAt,
        });
        indexed += 1;
      } catch {
        addFinding(findings, "CORRUPT_JSON");
      }
    }
  }

  for (const requestId of consentRequestIds) {
    if (!discoveredLeadIds.has(requestId)) addFinding(findings, "ORPHAN_CONSENT_AUDIT");
  }
  for (const entry of await jsonEntries(options.quarantineRoot)) {
    if (entry.isSymbolicLink()) {
      addFinding(findings, "SYMLINK_IGNORED");
      continue;
    }
    if (entry.isDirectory() && requestIdPattern.test(entry.name) && !discoveredLeadIds.has(entry.name)) {
      addFinding(findings, "ORPHAN_ATTACHMENT_DIRECTORY");
    }
  }

  return { mode: options.mode, examined, indexed, unchanged, findings };
}
