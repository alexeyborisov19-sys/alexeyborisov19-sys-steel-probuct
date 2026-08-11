import { isAbsolute, relative, resolve, sep } from "node:path";

export const PD_ADMIN_DB_PATH = "/var/lib/steelprodukt/admin/personal-data.sqlite";
export const PD_EXPORT_PATH = "/var/lib/steelprodukt/exports";

export type PdAdminConfig = {
  enabled: boolean;
  databasePath: string;
  searchHmacKey: string | null;
  searchHmacKeyVersion: number;
  sessionHashKey: string | null;
  auditChainKey: string | null;
  exportPath: string;
  exportTtlHours: number;
  sessionIdleMinutes: number;
  sessionAbsoluteHours: number;
  stepUpMinutes: number;
  maximumLoginAttempts: number;
  loginLockMinutes: number;
  backupPath: string | null;
  backupEncryptionKeyFile: string | null;
};

export type PdAdminConfigIssue = {
  key: string;
  message: string;
};

export class PdAdminConfigurationError extends Error {
  readonly code = "PD_CONFIGURATION_ERROR";

  constructor(readonly issues: PdAdminConfigIssue[]) {
    super(`Personal-data administration configuration is invalid: ${issues.map((issue) => issue.key).join(", ")}`);
    this.name = "PdAdminConfigurationError";
  }
}

function isInside(parent: string, candidate: string) {
  const fromParent = relative(resolve(parent), resolve(candidate));
  return fromParent === "" || (!fromParent.startsWith(`..${sep}`) && fromParent !== "..");
}

export function isPrivatePath(path: string, cwd = process.cwd()) {
  if (!isAbsolute(path)) return false;
  return !isInside(resolve(cwd, "public"), path) && !isInside(resolve(cwd, ".next"), path);
}

function positiveInteger(value: string | undefined, fallback: number) {
  if (value === undefined || value === "") return fallback;
  return /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : Number.NaN;
}

function secretBytes(value: string) {
  if (/^[a-f\d]+$/i.test(value) && value.length % 2 === 0) return value.length / 2;
  if (/^[A-Za-z\d+/_-]+={0,2}$/.test(value)) {
    try {
      return Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64").byteLength;
    } catch {
      return 0;
    }
  }
  return Buffer.byteLength(value, "utf8");
}

export function validatePdAdminEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  options: { production?: boolean; cwd?: string } = {},
) {
  const production = options.production ?? environment.NODE_ENV === "production";
  const cwd = options.cwd ?? process.cwd();
  const issues: PdAdminConfigIssue[] = [];
  const add = (key: string, message: string) => issues.push({ key, message });
  const enabled = environment.PD_ADMIN_ENABLED === "true";

  if (environment.PD_ADMIN_ENABLED && !["true", "false"].includes(environment.PD_ADMIN_ENABLED)) {
    add("PD_ADMIN_ENABLED", "must be true or false");
  }

  const databasePath = environment.PD_ADMIN_DB_PATH || PD_ADMIN_DB_PATH;
  const exportPath = environment.PD_EXPORT_PATH || PD_EXPORT_PATH;
  for (const [key, path] of [
    ["PD_ADMIN_DB_PATH", databasePath],
    ["PD_EXPORT_PATH", exportPath],
  ] as const) {
    if (!isPrivatePath(path, cwd)) add(key, "must be an absolute private path outside public and .next");
  }
  if (production && databasePath !== PD_ADMIN_DB_PATH) {
    add("PD_ADMIN_DB_PATH", `must equal ${PD_ADMIN_DB_PATH} in production`);
  }
  if (production && exportPath !== PD_EXPORT_PATH) {
    add("PD_EXPORT_PATH", `must equal ${PD_EXPORT_PATH} in production`);
  }

  const integerSettings = [
    ["PD_SEARCH_HMAC_KEY_VERSION", environment.PD_SEARCH_HMAC_KEY_VERSION, 1],
    ["PD_EXPORT_TTL_HOURS", environment.PD_EXPORT_TTL_HOURS, 24],
    ["PD_SESSION_IDLE_MINUTES", environment.PD_SESSION_IDLE_MINUTES, 30],
    ["PD_SESSION_ABSOLUTE_HOURS", environment.PD_SESSION_ABSOLUTE_HOURS, 8],
    ["PD_STEP_UP_MINUTES", environment.PD_STEP_UP_MINUTES, 10],
    ["PD_MAX_LOGIN_ATTEMPTS", environment.PD_MAX_LOGIN_ATTEMPTS, 5],
    ["PD_LOGIN_LOCK_MINUTES", environment.PD_LOGIN_LOCK_MINUTES, 15],
  ] as const;
  for (const [key, value, fallback] of integerSettings) {
    if (!Number.isFinite(positiveInteger(value, fallback))) add(key, "must be a positive integer");
  }

  const backupPath = environment.PD_BACKUP_PATH?.trim();
  const backupKeyFile = environment.PD_BACKUP_ENCRYPTION_KEY_FILE?.trim();
  if (backupPath && !isPrivatePath(backupPath, cwd)) {
    add("PD_BACKUP_PATH", "must be an absolute private path outside public and .next");
  }
  if (backupKeyFile && !isPrivatePath(backupKeyFile, cwd)) {
    add("PD_BACKUP_ENCRYPTION_KEY_FILE", "must be an absolute private path outside public and .next");
  }

  if (enabled) {
    for (const key of ["PD_SEARCH_HMAC_KEY", "PD_SESSION_HASH_KEY", "PD_AUDIT_CHAIN_KEY"] as const) {
      const value = environment[key]?.trim();
      if (!value) add(key, "is required when PD_ADMIN_ENABLED=true");
      else if (secretBytes(value) < 32) add(key, "must contain at least 32 bytes of secret material");
    }
    const secrets = [
      environment.PD_SEARCH_HMAC_KEY,
      environment.PD_SESSION_HASH_KEY,
      environment.PD_AUDIT_CHAIN_KEY,
    ].filter(Boolean);
    if (new Set(secrets).size !== secrets.length) {
      add("PD_AUDIT_CHAIN_KEY", "administrative secrets must be different from one another");
    }
  }

  return issues;
}

export function readPdAdminConfig(
  environment: NodeJS.ProcessEnv = process.env,
  options: { production?: boolean; cwd?: string } = {},
): PdAdminConfig {
  const issues = validatePdAdminEnvironment(environment, options);
  if (issues.length) throw new PdAdminConfigurationError(issues);

  return {
    enabled: environment.PD_ADMIN_ENABLED === "true",
    databasePath: environment.PD_ADMIN_DB_PATH || PD_ADMIN_DB_PATH,
    searchHmacKey: environment.PD_SEARCH_HMAC_KEY?.trim() || null,
    searchHmacKeyVersion: positiveInteger(environment.PD_SEARCH_HMAC_KEY_VERSION, 1),
    sessionHashKey: environment.PD_SESSION_HASH_KEY?.trim() || null,
    auditChainKey: environment.PD_AUDIT_CHAIN_KEY?.trim() || null,
    exportPath: environment.PD_EXPORT_PATH || PD_EXPORT_PATH,
    exportTtlHours: positiveInteger(environment.PD_EXPORT_TTL_HOURS, 24),
    sessionIdleMinutes: positiveInteger(environment.PD_SESSION_IDLE_MINUTES, 30),
    sessionAbsoluteHours: positiveInteger(environment.PD_SESSION_ABSOLUTE_HOURS, 8),
    stepUpMinutes: positiveInteger(environment.PD_STEP_UP_MINUTES, 10),
    maximumLoginAttempts: positiveInteger(environment.PD_MAX_LOGIN_ATTEMPTS, 5),
    loginLockMinutes: positiveInteger(environment.PD_LOGIN_LOCK_MINUTES, 15),
    backupPath: environment.PD_BACKUP_PATH?.trim() || null,
    backupEncryptionKeyFile: environment.PD_BACKUP_ENCRYPTION_KEY_FILE?.trim() || null,
  };
}

export function assertPdAdminEnabled(environment: NodeJS.ProcessEnv = process.env) {
  const config = readPdAdminConfig(environment);
  if (!config.enabled) {
    const error = new Error("Personal-data administration is disabled");
    error.name = "PdAdminDisabledError";
    throw error;
  }
  return config;
}
