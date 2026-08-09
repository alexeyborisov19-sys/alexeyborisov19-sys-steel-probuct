import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { recordAccessEvent, recordAccessEventInTransaction } from "@/lib/pd-admin/audit/chain";
import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { evaluateLoginAttempt, recordLoginAttempt } from "@/lib/pd-admin/auth/login-policy";
import { hashPassword, passwordAlgorithm, passwordVersion, verifyPassword } from "@/lib/pd-admin/auth/password";
import { createStepUpExpiry, type NewSession } from "@/lib/pd-admin/auth/session";
import {
  hashAdministrativeFingerprint,
  markSessionStepUp,
  persistSession,
  revokeAllUserSessions,
  revokeSession,
} from "@/lib/pd-admin/auth/session-store";
import { readPdAdminConfig } from "@/lib/pd-admin/config";
import { closePdDatabase, openPdDatabase } from "@/lib/pd-admin/db/database";

const genericLoginMessage = "Не удалось выполнить вход. Проверьте данные или повторите позже";
const dummyPasswordHash = hashPassword("Never-Valid-Administrative-Password-2026!");

type LoginUserRow = {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  role: "ADMIN" | "PERSONAL_DATA_OFFICER" | "MANAGER" | "AUDITOR";
  is_active: number;
  must_change_password: number;
};

export class PdLoginFailedError extends Error {
  readonly code = "PD_LOGIN_FAILED";

  constructor() {
    super(genericLoginMessage);
  }
}

function normalizedUsername(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().slice(0, 64);
}

function loginAuditEvent(
  input: {
    userId?: string | null;
    sessionId?: string | null;
    ipHash: string;
    action: "LOGIN_SUCCESS" | "LOGIN_FAILED";
    code: string;
  },
) {
  return {
    userId: input.userId ?? null,
    sessionId: input.sessionId ?? null,
    action: input.action,
    targetType: "AUTHENTICATION",
    targetId: input.userId ?? null,
    legalBasis: "ADMINISTRATIVE_ACCESS_CONTROL",
    result: input.action === "LOGIN_SUCCESS" ? "SUCCESS" : "REJECTED",
    ipHash: input.ipHash,
    metadata: { code: input.code },
  } as const;
}

function recordLoginAudit(
  database: DatabaseSync,
  input: Parameters<typeof loginAuditEvent>[0] & { auditKey: string },
) {
  recordAccessEvent(database, loginAuditEvent(input), input.auditKey);
}

export function loginAdministrativeUser(input: {
  username: string;
  password: string;
  ipAddress: string;
  userAgent: string;
  now?: Date;
}): { session: NewSession; mustChangePassword: boolean } {
  const config = readPdAdminConfig();
  if (!config.enabled || !config.sessionHashKey || !config.auditChainKey) throw new PdLoginFailedError();
  const username = normalizedUsername(input.username);
  const now = input.now ?? new Date();
  const ipHash = hashAdministrativeFingerprint(input.ipAddress, config.sessionHashKey, "ip");
  const userAgentHash = hashAdministrativeFingerprint(input.userAgent.slice(0, 512), config.sessionHashKey, "user-agent");
  // Authentication must fail closed when the reviewed schema is unavailable;
  // it must never migrate production as a side effect of a login attempt.
  const database = openPdDatabase({ applyMigrations: false });
  try {
    const decision = evaluateLoginAttempt(database, {
      username,
      ipAddress: input.ipAddress,
      hashKey: config.sessionHashKey,
      maxAttempts: config.maximumLoginAttempts,
      lockMinutes: config.loginLockMinutes,
      now,
    });
    const user = database.prepare(`
      SELECT id, username, display_name, password_hash, role, is_active, must_change_password
      FROM users WHERE username = ?
    `).get(username) as LoginUserRow | undefined;

    if (!decision.allowed) {
      recordLoginAttempt(database, {
        username,
        ipAddress: input.ipAddress,
        hashKey: config.sessionHashKey,
        success: false,
        failureReason: decision.reason === "ACCOUNT_LOCKED" ? "ACCOUNT_LOCKED" : "IP_BLOCKED",
        userId: null,
        maxAttempts: config.maximumLoginAttempts,
        lockMinutes: config.loginLockMinutes,
        now,
      });
      recordLoginAudit(database, {
        auditKey: config.auditChainKey,
        userId: user?.id,
        ipHash,
        action: "LOGIN_FAILED",
        code: decision.reason,
      });
      throw new PdLoginFailedError();
    }

    const passwordMatches = verifyPassword(input.password, user?.password_hash ?? dummyPasswordHash);
    if (!user || !user.is_active || !passwordMatches) {
      const reason = !user ? "UNKNOWN_USER" : !user.is_active ? "ACCOUNT_INACTIVE" : "INVALID_PASSWORD";
      recordLoginAttempt(database, {
        username,
        ipAddress: input.ipAddress,
        hashKey: config.sessionHashKey,
        success: false,
        failureReason: reason,
        userId: user?.is_active ? user.id : null,
        maxAttempts: config.maximumLoginAttempts,
        lockMinutes: config.loginLockMinutes,
        now,
      });
      recordLoginAudit(database, {
        auditKey: config.auditChainKey,
        userId: user?.id,
        ipHash,
        action: "LOGIN_FAILED",
        code: reason,
      });
      throw new PdLoginFailedError();
    }

    recordLoginAttempt(database, {
      username,
      ipAddress: input.ipAddress,
      hashKey: config.sessionHashKey,
      success: true,
      userId: user.id,
      maxAttempts: config.maximumLoginAttempts,
      lockMinutes: config.loginLockMinutes,
      now,
    });
    database.exec("BEGIN IMMEDIATE");
    let session: NewSession;
    try {
      session = persistSession(database, {
        userId: user.id,
        ipHash,
        userAgentHash,
        hashKey: config.sessionHashKey,
        idleMinutes: config.sessionIdleMinutes,
        absoluteHours: config.sessionAbsoluteHours,
        now,
      });
      recordAccessEventInTransaction(database, loginAuditEvent({
        userId: user.id,
        sessionId: session.id,
        ipHash,
        action: "LOGIN_SUCCESS",
        code: user.must_change_password ? "PASSWORD_CHANGE_REQUIRED" : "AUTHENTICATED",
      }), config.auditChainKey);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    return { session, mustChangePassword: user.must_change_password === 1 };
  } finally {
    closePdDatabase(database, config.databasePath);
  }
}

function replacementSession(context: PdAuthContext, now = new Date()) {
  if (!context.config.sessionHashKey) throw new Error("Session configuration unavailable");
  return persistSession(context.database, {
    userId: context.user.id,
    ipHash: context.ipHash,
    userAgentHash: context.session.userAgentHash,
    hashKey: context.config.sessionHashKey,
    idleMinutes: context.config.sessionIdleMinutes,
    absoluteHours: context.config.sessionAbsoluteHours,
    now,
  });
}

export function changeAdministrativePassword(
  context: PdAuthContext,
  input: { currentPassword: string; newPassword: string; confirmPassword: string; now?: Date },
) {
  if (!context.config.auditChainKey || !context.config.sessionHashKey) throw new Error("Audit configuration unavailable");
  const now = input.now ?? new Date();
  const decision = evaluateLoginAttempt(context.database, {
    username: context.user.username,
    ipAddress: context.ipHash,
    hashKey: context.config.sessionHashKey,
    maxAttempts: context.config.maximumLoginAttempts,
    lockMinutes: context.config.loginLockMinutes,
    now,
  });
  if (!decision.allowed) throw new Error("INVALID_PASSWORD");
  const row = context.database.prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(context.user.id) as { password_hash: string } | undefined;
  if (!row || !verifyPassword(input.currentPassword, row.password_hash)) {
    recordLoginAttempt(context.database, {
      username: context.user.username,
      ipAddress: context.ipHash,
      hashKey: context.config.sessionHashKey,
      success: false,
      failureReason: "INVALID_PASSWORD",
      userId: context.user.id,
      maxAttempts: context.config.maximumLoginAttempts,
      lockMinutes: context.config.loginLockMinutes,
      now,
    });
    throw new Error("INVALID_PASSWORD");
  }
  if (input.newPassword !== input.confirmPassword || input.newPassword === input.currentPassword) {
    throw new Error("INVALID_NEW_PASSWORD");
  }
  const encoded = hashPassword(input.newPassword);
  context.database.exec("BEGIN IMMEDIATE");
  try {
    context.database.prepare(`
      UPDATE users SET password_hash = ?, password_algorithm = ?, password_version = ?,
        must_change_password = 0, failed_login_count = 0, locked_until = NULL,
        password_changed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(encoded, passwordAlgorithm, passwordVersion, now.toISOString(), now.toISOString(), context.user.id);
    revokeAllUserSessions(context.database, context.user.id, "PASSWORD_CHANGED", now);
    const session = replacementSession(context, now);
    recordAccessEventInTransaction(context.database, {
      occurredAt: now.toISOString(),
      userId: context.user.id,
      sessionId: session.id,
      action: "PASSWORD_CHANGED",
      targetType: "USER",
      targetId: context.user.id,
      legalBasis: "ADMINISTRATIVE_ACCESS_CONTROL",
      result: "SUCCESS",
      ipHash: context.ipHash,
      metadata: { code: "SESSIONS_ROTATED" },
    }, context.config.auditChainKey);
    context.database.exec("COMMIT");
    return session;
  } catch (error) {
    context.database.exec("ROLLBACK");
    throw error;
  }
}

export function stepUpAdministrativeSession(
  context: PdAuthContext,
  password: string,
  now = new Date(),
) {
  if (!context.config.auditChainKey || !context.config.sessionHashKey) throw new Error("Audit configuration unavailable");
  const decision = evaluateLoginAttempt(context.database, {
    username: context.user.username,
    ipAddress: context.ipHash,
    hashKey: context.config.sessionHashKey,
    maxAttempts: context.config.maximumLoginAttempts,
    lockMinutes: context.config.loginLockMinutes,
    now,
  });
  if (!decision.allowed) {
    recordAccessEvent(context.database, {
      occurredAt: now.toISOString(),
      userId: context.user.id,
      sessionId: context.session.id,
      action: "STEP_UP_FAILED",
      targetType: "SESSION",
      targetId: context.session.id,
      legalBasis: "ADMINISTRATIVE_ACCESS_CONTROL",
      result: "REJECTED",
      ipHash: context.ipHash,
      metadata: { code: decision.reason },
    }, context.config.auditChainKey);
    throw new Error("INVALID_PASSWORD");
  }
  const row = context.database.prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(context.user.id) as { password_hash: string } | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    recordLoginAttempt(context.database, {
      username: context.user.username,
      ipAddress: context.ipHash,
      hashKey: context.config.sessionHashKey,
      success: false,
      failureReason: "INVALID_PASSWORD",
      userId: context.user.id,
      maxAttempts: context.config.maximumLoginAttempts,
      lockMinutes: context.config.loginLockMinutes,
      now,
    });
    recordAccessEvent(context.database, {
      occurredAt: now.toISOString(),
      userId: context.user.id,
      sessionId: context.session.id,
      action: "STEP_UP_FAILED",
      targetType: "SESSION",
      targetId: context.session.id,
      legalBasis: "ADMINISTRATIVE_ACCESS_CONTROL",
      result: "REJECTED",
      ipHash: context.ipHash,
      metadata: { code: "INVALID_PASSWORD" },
    }, context.config.auditChainKey);
    throw new Error("INVALID_PASSWORD");
  }
  context.database.prepare("UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?")
    .run(now.toISOString(), context.user.id);
  context.database.exec("BEGIN IMMEDIATE");
  try {
    revokeSession(context.database, context.session.id, "STEP_UP_ROTATION", now);
    const session = replacementSession(context, now);
    const stepUpUntil = createStepUpExpiry(context.config.stepUpMinutes, now);
    markSessionStepUp(context.database, session.id, stepUpUntil);
    recordAccessEventInTransaction(context.database, {
      occurredAt: now.toISOString(),
      userId: context.user.id,
      sessionId: session.id,
      action: "STEP_UP_SUCCESS",
      targetType: "SESSION",
      targetId: session.id,
      legalBasis: "ADMINISTRATIVE_ACCESS_CONTROL",
      result: "SUCCESS",
      ipHash: context.ipHash,
      metadata: { code: "SESSION_ROTATED" },
    }, context.config.auditChainKey);
    context.database.exec("COMMIT");
    return { session, stepUpUntil };
  } catch (error) {
    context.database.exec("ROLLBACK");
    throw error;
  }
}

export function createTemporaryUserId() {
  return randomUUID();
}

export { genericLoginMessage };
