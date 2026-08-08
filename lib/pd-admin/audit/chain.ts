import { createHmac, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const metadataKeys = new Set([
  "requestId",
  "internalId",
  "role",
  "count",
  "bytes",
  "status",
  "code",
  "reasonCode",
  "exportId",
  "permission",
  "source",
]);

export type AccessEventInput = {
  occurredAt?: string;
  userId?: string | null;
  sessionId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  legalBasis?: string | null;
  result: string;
  ipHash: string;
  metadata?: Record<string, JsonValue>;
};

function canonicalize(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

function safeMetadata(metadata: Record<string, JsonValue> = {}) {
  for (const key of Object.keys(metadata)) {
    if (!metadataKeys.has(key)) throw new Error("Access-event metadata key is not approved");
  }
  return canonicalize(metadata);
}

function eventHash(payload: Record<string, JsonValue>, previousHash: string | null, key: string) {
  if (Buffer.byteLength(key, "utf8") < 32 && !/^[a-f\d]{64,}$/i.test(key)) {
    throw new Error("PD audit chain key is unavailable or too short");
  }
  return createHmac("sha256", key)
    .update(canonicalize({ ...payload, previousHash }))
    .digest("hex");
}

export function recordAccessEvent(database: DatabaseSync, input: AccessEventInput, auditChainKey: string) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const previous = database.prepare("SELECT event_hash FROM access_events ORDER BY id DESC LIMIT 1").get() as {
      event_hash: string;
    } | undefined;
    const previousHash = previous?.event_hash ?? null;
    const metadataJson = safeMetadata(input.metadata);
    const payload: Record<string, JsonValue> = {
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      legalBasis: input.legalBasis ?? null,
      result: input.result,
      ipHash: input.ipHash,
      metadataJson,
    };
    const hash = eventHash(payload, previousHash, auditChainKey);
    const result = database.prepare(`
      INSERT INTO access_events(
        occurred_at, user_id, session_id, action, target_type, target_id,
        legal_basis, result, ip_hash, metadata_json, previous_hash, event_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(payload.occurredAt),
      input.userId ?? null,
      input.sessionId ?? null,
      input.action,
      input.targetType,
      input.targetId ?? null,
      input.legalBasis ?? null,
      input.result,
      input.ipHash,
      metadataJson,
      previousHash,
      hash,
    );
    database.exec("COMMIT");
    return { id: Number(result.lastInsertRowid), eventHash: hash };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function verifyAccessEventChain(database: DatabaseSync, auditChainKey: string) {
  const rows = database.prepare(`
    SELECT id, occurred_at, user_id, session_id, action, target_type, target_id,
      legal_basis, result, ip_hash, metadata_json, previous_hash, event_hash
    FROM access_events ORDER BY id
  `).all() as Array<Record<string, string | number | null>>;
  let previousHash: string | null = null;
  const invalidIds: number[] = [];

  for (const row of rows) {
    const payload: Record<string, JsonValue> = {
      occurredAt: String(row.occurred_at),
      userId: row.user_id === null ? null : String(row.user_id),
      sessionId: row.session_id === null ? null : String(row.session_id),
      action: String(row.action),
      targetType: String(row.target_type),
      targetId: row.target_id === null ? null : String(row.target_id),
      legalBasis: row.legal_basis === null ? null : String(row.legal_basis),
      result: String(row.result),
      ipHash: String(row.ip_hash),
      metadataJson: String(row.metadata_json),
    };
    const expected = Buffer.from(eventHash(payload, previousHash, auditChainKey), "hex");
    const actual = Buffer.from(String(row.event_hash), "hex");
    const linkMatches = row.previous_hash === previousHash;
    if (!linkMatches || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      invalidIds.push(Number(row.id));
    }
    previousHash = String(row.event_hash);
  }
  return { valid: invalidIds.length === 0, events: rows.length, invalidIds };
}
