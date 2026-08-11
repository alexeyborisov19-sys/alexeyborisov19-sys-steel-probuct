import type { DatabaseSync } from "node:sqlite";
import { hasPdPermission, type PdPermission, type PdRole } from "@/lib/pd-admin/auth/permissions";
import { findSessionByToken, touchSession, type StoredSession } from "@/lib/pd-admin/auth/session-store";
import { verifyCsrfToken } from "@/lib/pd-admin/auth/session";
import { readPdAdminConfig, type PdAdminConfig } from "@/lib/pd-admin/config";
import { closePdDatabase, openPdDatabase } from "@/lib/pd-admin/db/database";

export type PdAuthenticatedUser = {
  id: string;
  username: string;
  displayName: string;
  role: PdRole;
  mustChangePassword: boolean;
  passwordVersion: number;
};

export type PdAuthContext = {
  config: PdAdminConfig;
  database: DatabaseSync;
  databasePath: string;
  user: PdAuthenticatedUser;
  session: StoredSession;
  csrfToken: string;
  ipHash: string;
  close: () => void;
};

export class PdAuthenticationError extends Error {
  readonly code = "PD_AUTH_REQUIRED";
}

export class PdPasswordChangeRequiredError extends Error {
  readonly code = "PD_PASSWORD_CHANGE_REQUIRED";
}

export class PdPermissionError extends Error {
  readonly code = "PD_FORBIDDEN";
}

export function authenticatePdSession(input: {
  sessionToken?: string;
  csrfToken?: string;
  ipHash: string;
  userAgentHash: string;
  permission?: PdPermission;
  allowPasswordChange?: boolean;
  now?: Date;
  environment?: NodeJS.ProcessEnv;
}): PdAuthContext {
  const config = readPdAdminConfig(input.environment ?? process.env);
  if (!config.enabled || !config.sessionHashKey) throw new PdAuthenticationError();
  if (!input.sessionToken || !input.csrfToken) throw new PdAuthenticationError();
  // HTTP requests never apply schema changes. Production migrations are a
  // separate, reviewed deployment step performed by `npm run pd:migrate`.
  const database = openPdDatabase({ environment: input.environment, applyMigrations: false });
  try {
    const session = findSessionByToken(database, input.sessionToken, config.sessionHashKey, input.now);
    if (
      !session
      || session.userAgentHash !== input.userAgentHash
      || !verifyCsrfToken(input.csrfToken, session.csrfSecretHash, config.sessionHashKey)
    ) {
      throw new PdAuthenticationError();
    }
    const row = database.prepare(`
      SELECT id, username, display_name, role, is_active, must_change_password, password_version
      FROM users WHERE id = ?
    `).get(session.userId) as {
      id: string;
      username: string;
      display_name: string;
      role: PdRole;
      is_active: number;
      must_change_password: number;
      password_version: number;
    } | undefined;
    if (!row?.is_active) throw new PdAuthenticationError();
    const user: PdAuthenticatedUser = {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      mustChangePassword: row.must_change_password === 1,
      passwordVersion: row.password_version,
    };
    if (user.mustChangePassword && !input.allowPasswordChange) {
      throw new PdPasswordChangeRequiredError();
    }
    if (input.permission && !hasPdPermission(user.role, input.permission)) {
      throw new PdPermissionError();
    }
    touchSession(database, session.id, config.sessionIdleMinutes, input.now);
    return {
      config,
      database,
      databasePath: config.databasePath,
      user,
      session,
      csrfToken: input.csrfToken,
      ipHash: input.ipHash,
      close: () => closePdDatabase(database, config.databasePath),
    };
  } catch (error) {
    closePdDatabase(database, config.databasePath);
    throw error;
  }
}
