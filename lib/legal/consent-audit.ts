import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

export type ConsentAuditInput = {
  event: "quote_request_consent" | "assistant_lead_consent";
  requestId: string;
  recordedAt: string;
  clientTimestamp: string | null;
  personalDataConsentVersion: string;
  privacyVersion: string;
  marketing: boolean;
  marketingConsentVersion: string | null;
  ownerKey: string;
  phone: string;
  email: string;
};

const DEFAULT_CONSENT_RETENTION_DAYS = 1_095;

function assertPrivateStorage(path: string) {
  const publicRoot = resolve(process.cwd(), "public");
  const pathFromPublic = relative(publicRoot, path);
  if (pathFromPublic === "" || (!pathFromPublic.startsWith(`..${sep}`) && pathFromPublic !== "..")) {
    throw new Error("Consent audit storage must be outside public");
  }
}

function hashContact(phone: string, email: string) {
  const configuredSalt = process.env.CONSENT_AUDIT_SALT || process.env.IP_HASH_SALT;
  if (process.env.NODE_ENV === "production" && !configuredSalt) {
    throw new Error("CONSENT_AUDIT_SALT or IP_HASH_SALT is required in production");
  }
  const salt = configuredSalt || "steelprodukt-consent-local";
  return createHash("sha256")
    .update(`${salt}|${phone.replace(/\D/g, "")}|${email.toLowerCase()}`)
    .digest("hex");
}

export async function recordConsentAudit(input: ConsentAuditInput) {
  const storageRoot = resolve(process.env.CONSENT_AUDIT_STORAGE_PATH || ".data/consent-audit");
  assertPrivateStorage(storageRoot);
  await mkdir(storageRoot, { recursive: true, mode: 0o700 });

  const record = {
    auditId: randomUUID(),
    event: input.event,
    requestId: input.requestId,
    createdAt: input.recordedAt,
    clientTimestamp: input.clientTimestamp,
    personalData: true,
    personalDataConsentVersion: input.personalDataConsentVersion,
    privacyVersion: input.privacyVersion,
    marketing: input.marketing,
    marketingConsentVersion: input.marketingConsentVersion,
    ownerHash: input.ownerKey,
    contactHash: hashContact(input.phone, input.email),
    retentionDays: Number(
      process.env.CONSENT_AUDIT_RETENTION_DAYS || DEFAULT_CONSENT_RETENTION_DAYS,
    ),
  };

  await writeFile(
    resolve(storageRoot, `${record.auditId}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600, flag: "wx" },
  );
}
