import { randomUUID } from "node:crypto";
import type { PdAuthContext } from "@/lib/pd-admin/auth/context";
import { assertPdPermission, pdRoles, type PdRole } from "@/lib/pd-admin/auth/permissions";
import { hashPassword, passwordAlgorithm, passwordVersion } from "@/lib/pd-admin/auth/password";
import { isStepUpActive } from "@/lib/pd-admin/auth/session";
import { revokeAllUserSessions } from "@/lib/pd-admin/auth/session-store";
import { recordAccessEvent, recordAccessEventInTransaction } from "@/lib/pd-admin/audit/chain";

export type SafeUser = {
  id: string;
  username: string;
  displayName: string;
  role: PdRole;
  isActive: boolean;
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
  passwordChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  role: PdRole;
  is_active: number;
  must_change_password: number;
  failed_login_count: number;
  locked_until: string | null;
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

function safeUser(row: UserRow): SafeUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active === 1,
    mustChangePassword: row.must_change_password === 1,
    failedLoginCount: row.failed_login_count,
    lockedUntil: row.locked_until,
    passwordChangedAt: row.password_changed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

function userSelect() {
  return `SELECT id, username, display_name, role, is_active, must_change_password,
    failed_login_count, locked_until, password_changed_at, created_at, updated_at, last_login_at
    FROM users`;
}

function requireStepUp(context: PdAuthContext) {
  if (!isStepUpActive(context.session.stepUpUntil)) throw new Error("STEP_UP_REQUIRED");
}

function activeAdminCount(context: PdAuthContext) {
  return Number((context.database.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN' AND is_active = 1")
    .get() as { count: number }).count);
}

function userAccessEvent(context: PdAuthContext, action: string, targetId: string, code: string, role?: PdRole) {
  return {
    userId: context.user.id,
    sessionId: context.session.id,
    action,
    targetType: "USER",
    targetId,
    legalBasis: "ADMINISTRATIVE_ACCESS_CONTROL",
    result: "SUCCESS",
    ipHash: context.ipHash,
    metadata: { internalId: targetId, code, role: role ?? context.user.role },
  } as const;
}

function auditUserAction(context: PdAuthContext, action: string, targetId: string, code: string, role?: PdRole) {
  if (!context.config.auditChainKey) throw new Error("Audit configuration unavailable");
  recordAccessEvent(context.database, userAccessEvent(context, action, targetId, code, role), context.config.auditChainKey);
}

function auditedUserMutation<T>(
  context: PdAuthContext,
  event: ReturnType<typeof userAccessEvent>,
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

export function listUsers(context: PdAuthContext) {
  assertPdPermission(context.user.role, "MANAGE_USERS");
  const rows = context.database.prepare(`${userSelect()} ORDER BY display_name, username`).all() as UserRow[];
  auditUserAction(context, "USER_LIST_VIEWED", context.user.id, "REGISTER_PAGE");
  return rows.map(safeUser);
}

export function getUser(context: PdAuthContext, id: string) {
  assertPdPermission(context.user.role, "MANAGE_USERS");
  const row = context.database.prepare(`${userSelect()} WHERE id = ?`).get(id) as UserRow | undefined;
  if (row) auditUserAction(context, "USER_VIEWED", id, "USER_CARD");
  return row ? safeUser(row) : null;
}

export function createUser(context: PdAuthContext, input: {
  username: string;
  displayName: string;
  role: string;
  temporaryPassword: string;
}) {
  assertPdPermission(context.user.role, "MANAGE_USERS");
  requireStepUp(context);
  const username = input.username.normalize("NFKC").trim().toLowerCase();
  const displayName = input.displayName.normalize("NFKC").trim();
  if (!/^[a-z][a-z0-9._-]{2,63}$/.test(username)) throw new Error("INVALID_USERNAME");
  if (displayName.length < 2 || displayName.length > 120) throw new Error("INVALID_DISPLAY_NAME");
  if (!pdRoles.includes(input.role as PdRole)) throw new Error("INVALID_ROLE");
  const passwordHash = hashPassword(input.temporaryPassword);
  const id = randomUUID();
  const now = new Date().toISOString();
  return auditedUserMutation(
    context,
    userAccessEvent(context, "USER_CREATED", id, "TEMPORARY_PASSWORD", input.role as PdRole),
    () => {
      context.database.prepare(`
        INSERT INTO users(
          id, username, display_name, password_hash, password_algorithm, password_version,
          role, is_active, must_change_password, failed_login_count, created_at, updated_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 0, ?, ?, ?)
      `).run(
        id, username, displayName, passwordHash, passwordAlgorithm, passwordVersion,
        input.role, now, now, context.user.id,
      );
      return { id };
    },
  );
}

export function updateUser(context: PdAuthContext, id: string, input: {
  action: "change-role" | "deactivate" | "activate" | "unlock" | "reset-password" | "revoke-sessions";
  role?: string;
  temporaryPassword?: string;
}) {
  assertPdPermission(context.user.role, "MANAGE_USERS");
  requireStepUp(context);
  const target = context.database.prepare("SELECT id, role, is_active FROM users WHERE id = ?")
    .get(id) as { id: string; role: PdRole; is_active: number } | undefined;
  if (!target) return false;
  const now = new Date();

  if (input.action === "change-role") {
    assertPdPermission(context.user.role, "CHANGE_ROLES");
    if (!pdRoles.includes(input.role as PdRole)) throw new Error("INVALID_ROLE");
    const nextRole = input.role as PdRole;
    if (target.role === "ADMIN" && nextRole !== "ADMIN" && target.is_active && activeAdminCount(context) <= 1) {
      throw new Error("LAST_ADMIN");
    }
    return auditedUserMutation(context, userAccessEvent(context, "USER_ROLE_CHANGED", id, "ROLE_CHANGED", nextRole), () => {
      context.database.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?")
        .run(nextRole, now.toISOString(), id);
      return true;
    });
  }
  if (input.action === "deactivate") {
    if (id === context.user.id) throw new Error("SELF_DEACTIVATION");
    if (target.role === "ADMIN" && target.is_active && activeAdminCount(context) <= 1) throw new Error("LAST_ADMIN");
    return auditedUserMutation(context, userAccessEvent(context, "USER_DEACTIVATED", id, "SESSIONS_REVOKED", target.role), () => {
      context.database.prepare("UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?")
        .run(now.toISOString(), id);
      revokeAllUserSessions(context.database, id, "USER_DEACTIVATED", now);
      return true;
    });
  }
  if (input.action === "activate") {
    return auditedUserMutation(context, userAccessEvent(context, "USER_ACTIVATED", id, "ACTIVE", target.role), () => {
      context.database.prepare("UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?")
        .run(now.toISOString(), id);
      return true;
    });
  }
  if (input.action === "unlock") {
    return auditedUserMutation(context, userAccessEvent(context, "USER_UNLOCKED", id, "LOCK_CLEARED", target.role), () => {
      context.database.prepare("UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?")
        .run(now.toISOString(), id);
      return true;
    });
  }
  if (input.action === "reset-password") {
    if (!input.temporaryPassword) throw new Error("PASSWORD_REQUIRED");
    const passwordHash = hashPassword(input.temporaryPassword);
    return auditedUserMutation(context, userAccessEvent(context, "USER_PASSWORD_RESET", id, "MUST_CHANGE_PASSWORD", target.role), () => {
      context.database.prepare(`
        UPDATE users SET password_hash = ?, password_algorithm = ?, password_version = ?,
          must_change_password = 1, password_changed_at = ?, updated_at = ? WHERE id = ?
      `).run(passwordHash, passwordAlgorithm, passwordVersion, now.toISOString(), now.toISOString(), id);
      revokeAllUserSessions(context.database, id, "PASSWORD_RESET", now);
      return true;
    });
  }
  if (input.action === "revoke-sessions") {
    assertPdPermission(context.user.role, "REVOKE_SESSIONS");
    return auditedUserMutation(context, userAccessEvent(context, "USER_SESSIONS_REVOKED", id, "ALL_SESSIONS", target.role), () => {
      revokeAllUserSessions(context.database, id, "ADMIN_REVOKED_SESSIONS", now);
      return true;
    });
  }
  return false;
}
