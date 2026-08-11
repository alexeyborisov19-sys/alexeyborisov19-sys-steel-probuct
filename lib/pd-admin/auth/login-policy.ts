import type { DatabaseSync } from "node:sqlite";
import { hashAdministrativeFingerprint } from "@/lib/pd-admin/auth/session-store";

export type LoginDecision =
  | { allowed: true; userId: string | null }
  | { allowed: false; reason: "ACCOUNT_LOCKED" | "IP_TEMPORARILY_BLOCKED"; retryAfterSeconds: number };

type UserLockRow = {
  id: string;
  locked_until: string | null;
};

export function evaluateLoginAttempt(
  database: DatabaseSync,
  input: {
    username: string;
    ipAddress: string;
    hashKey: string;
    maxAttempts: number;
    lockMinutes: number;
    now?: Date;
  },
): LoginDecision {
  const now = input.now ?? new Date();
  const username = input.username.normalize("NFKC").trim().toLowerCase();
  const ipHash = hashAdministrativeFingerprint(input.ipAddress, input.hashKey, "ip");
  const user = database.prepare(
    "SELECT id, locked_until FROM users WHERE username = ? AND is_active = 1",
  ).get(username) as UserLockRow | undefined;
  const accountLockedUntil = user?.locked_until ? Date.parse(user.locked_until) : 0;
  if (accountLockedUntil > now.getTime()) {
    return {
      allowed: false,
      reason: "ACCOUNT_LOCKED",
      retryAfterSeconds: Math.ceil((accountLockedUntil - now.getTime()) / 1_000),
    };
  }

  const windowStartedAt = new Date(now.getTime() - input.lockMinutes * 60_000).toISOString();
  const recentIpFailures = database.prepare(`
    SELECT COUNT(*) AS count
    FROM login_attempts
    WHERE ip_hash = ? AND attempted_at >= ? AND success = 0
  `).get(ipHash, windowStartedAt) as { count: number };
  if (recentIpFailures.count >= input.maxAttempts) {
    return {
      allowed: false,
      reason: "IP_TEMPORARILY_BLOCKED",
      retryAfterSeconds: input.lockMinutes * 60,
    };
  }

  return { allowed: true, userId: user?.id ?? null };
}

export function recordLoginAttempt(
  database: DatabaseSync,
  input: {
    username: string;
    ipAddress: string;
    hashKey: string;
    success: boolean;
    failureReason?: "UNKNOWN_USER" | "INVALID_PASSWORD" | "ACCOUNT_INACTIVE" | "ACCOUNT_LOCKED" | "IP_BLOCKED";
    userId?: string | null;
    maxAttempts: number;
    lockMinutes: number;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const usernameHash = hashAdministrativeFingerprint(input.username, input.hashKey, "username");
  const ipHash = hashAdministrativeFingerprint(input.ipAddress, input.hashKey, "ip");
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare(`
      INSERT INTO login_attempts(
        username_hash, ip_hash, attempted_at, success, failure_reason, user_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      usernameHash,
      ipHash,
      now.toISOString(),
      input.success ? 1 : 0,
      input.success ? null : input.failureReason ?? "INVALID_PASSWORD",
      input.userId ?? null,
    );

    if (input.userId && input.success) {
      database.prepare(`
        UPDATE users
        SET failed_login_count = 0, locked_until = NULL, last_login_at = ?, updated_at = ?
        WHERE id = ?
      `).run(now.toISOString(), now.toISOString(), input.userId);
    } else if (input.userId) {
      const row = database.prepare(
        "SELECT failed_login_count FROM users WHERE id = ?",
      ).get(input.userId) as { failed_login_count: number } | undefined;
      const failures = (row?.failed_login_count ?? 0) + 1;
      const lockedUntil = failures >= input.maxAttempts
        ? new Date(now.getTime() + input.lockMinutes * 60_000).toISOString()
        : null;
      database.prepare(`
        UPDATE users
        SET failed_login_count = ?, locked_until = ?, updated_at = ?
        WHERE id = ?
      `).run(failures, lockedUntil, now.toISOString(), input.userId);
    }
    database.exec("COMMIT");
    return { usernameHash, ipHash };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
