import { createHmac } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  createSessionSecrets,
  hashSessionToken,
  isSessionActive,
  type NewSession,
} from "@/lib/pd-admin/auth/session";

export type StoredSession = {
  id: string;
  userId: string;
  csrfSecretHash: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  absoluteExpiresAt: string;
  stepUpUntil: string | null;
  revokedAt: string | null;
  ipHash: string;
  userAgentHash: string;
};

export function hashAdministrativeFingerprint(value: string, key: string, purpose: "ip" | "user-agent" | "username") {
  return createHmac("sha256", key)
    .update(`steelprodukt:pd-auth:${purpose}:${value.normalize("NFKC").trim().toLowerCase()}`)
    .digest("hex");
}

export function persistSession(
  database: DatabaseSync,
  input: {
    userId: string;
    ipHash: string;
    userAgentHash: string;
    hashKey: string;
    idleMinutes: number;
    absoluteHours: number;
    now?: Date;
  },
): NewSession {
  const session = createSessionSecrets(
    input.hashKey,
    input.now,
    input.idleMinutes,
    input.absoluteHours,
  );
  database.prepare(`
    INSERT INTO sessions(
      id, user_id, token_hash, csrf_secret_hash, created_at, last_seen_at,
      expires_at, absolute_expires_at, ip_hash, user_agent_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    session.id,
    input.userId,
    session.tokenHash,
    session.csrfSecretHash,
    session.createdAt,
    session.lastSeenAt,
    session.expiresAt,
    session.absoluteExpiresAt,
    input.ipHash,
    input.userAgentHash,
  );
  return session;
}

export function findSessionByToken(database: DatabaseSync, token: string, hashKey: string, now = new Date()) {
  const row = database.prepare(`
    SELECT id, user_id, csrf_secret_hash, created_at, last_seen_at, expires_at,
      absolute_expires_at, step_up_until, revoked_at, ip_hash, user_agent_hash
    FROM sessions
    WHERE token_hash = ?
  `).get(hashSessionToken(token, hashKey)) as {
    id: string;
    user_id: string;
    csrf_secret_hash: string;
    created_at: string;
    last_seen_at: string;
    expires_at: string;
    absolute_expires_at: string;
    step_up_until: string | null;
    revoked_at: string | null;
    ip_hash: string;
    user_agent_hash: string;
  } | undefined;
  if (!row) return null;
  const session: StoredSession = {
    id: row.id,
    userId: row.user_id,
    csrfSecretHash: row.csrf_secret_hash,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    absoluteExpiresAt: row.absolute_expires_at,
    stepUpUntil: row.step_up_until,
    revokedAt: row.revoked_at,
    ipHash: row.ip_hash,
    userAgentHash: row.user_agent_hash,
  };
  return isSessionActive(session, now) ? session : null;
}

export function touchSession(database: DatabaseSync, sessionId: string, idleMinutes: number, now = new Date()) {
  const expiresAt = new Date(now.getTime() + idleMinutes * 60_000).toISOString();
  database.prepare(`
    UPDATE sessions
    SET last_seen_at = ?, expires_at = MIN(absolute_expires_at, ?)
    WHERE id = ? AND revoked_at IS NULL
  `).run(now.toISOString(), expiresAt, sessionId);
}

export function revokeSession(database: DatabaseSync, sessionId: string, reason: string, now = new Date()) {
  database.prepare(`
    UPDATE sessions SET revoked_at = ?, revoke_reason = ?
    WHERE id = ? AND revoked_at IS NULL
  `).run(now.toISOString(), reason.slice(0, 160), sessionId);
}

export function revokeAllUserSessions(database: DatabaseSync, userId: string, reason: string, now = new Date()) {
  return database.prepare(`
    UPDATE sessions SET revoked_at = ?, revoke_reason = ?
    WHERE user_id = ? AND revoked_at IS NULL
  `).run(now.toISOString(), reason.slice(0, 160), userId).changes;
}

export function revokeOtherUserSessions(
  database: DatabaseSync,
  userId: string,
  currentSessionId: string,
  reason: string,
  now = new Date(),
) {
  return database.prepare(`
    UPDATE sessions SET revoked_at = ?, revoke_reason = ?
    WHERE user_id = ? AND id <> ? AND revoked_at IS NULL
  `).run(now.toISOString(), reason.slice(0, 160), userId, currentSessionId).changes;
}

export function markSessionStepUp(database: DatabaseSync, sessionId: string, stepUpUntil: string) {
  database.prepare("UPDATE sessions SET step_up_until = ? WHERE id = ? AND revoked_at IS NULL")
    .run(stepUpUntil, sessionId);
}

export type VisibleSession = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  absoluteExpiresAt: string;
  stepUpUntil: string | null;
  revokedAt: string | null;
  current: boolean;
};

export function listUserSessions(database: DatabaseSync, userId: string, currentSessionId: string) {
  const rows = database.prepare(`
    SELECT id, created_at, last_seen_at, expires_at, absolute_expires_at,
      step_up_until, revoked_at
    FROM sessions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(userId) as Array<{
    id: string;
    created_at: string;
    last_seen_at: string;
    expires_at: string;
    absolute_expires_at: string;
    step_up_until: string | null;
    revoked_at: string | null;
  }>;
  return rows.map<VisibleSession>((row) => ({
    id: row.id,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    absoluteExpiresAt: row.absolute_expires_at,
    stepUpUntil: row.step_up_until,
    revokedAt: row.revoked_at,
    current: row.id === currentSessionId,
  }));
}
