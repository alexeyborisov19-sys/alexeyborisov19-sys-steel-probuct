import { isAbsolute } from "node:path";
import { validatePdAdminEnvironment } from "@/lib/pd-admin/config";

export type ProductionEnvironmentIssue = {
  key: string;
  message: string;
};

export class ProductionEnvironmentError extends Error {
  readonly code = "CONFIGURATION_ERROR";

  constructor(readonly issues: ProductionEnvironmentIssue[]) {
    super(`Production environment is invalid: ${issues.map((issue) => issue.key).join(", ")}`);
    this.name = "ProductionEnvironmentError";
  }
}

const requiredVariables = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_YM_COUNTER_ID",
  "NEXT_PUBLIC_YM_WEBVISOR",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
  "SMTP_ENVELOPE_FROM",
  "QUOTE_RECIPIENT",
  "QUOTE_STORAGE_PATH",
  "ASSISTANT_LEAD_STORAGE_PATH",
  "UPLOAD_QUARANTINE_PATH",
  "CONSENT_AUDIT_STORAGE_PATH",
  "LEAD_RETENTION_DAYS",
  "CONSENT_AUDIT_RETENTION_DAYS",
  "IP_HASH_SALT",
  "CONSENT_AUDIT_SALT",
  "TRUST_NGINX_PROXY",
  "CLAMAV_ENABLED",
  "CLAMAV_COMMAND",
] as const;

const expectedStoragePaths: Record<string, string> = {
  QUOTE_STORAGE_PATH: "/var/lib/steelprodukt/quote-leads",
  ASSISTANT_LEAD_STORAGE_PATH: "/var/lib/steelprodukt/assistant-leads",
  UPLOAD_QUARANTINE_PATH: "/var/lib/steelprodukt/quarantine",
  CONSENT_AUDIT_STORAGE_PATH: "/var/lib/steelprodukt/consent-audit",
};

function isPositiveInteger(value: string | undefined) {
  return Boolean(value && /^\d+$/.test(value) && Number(value) > 0);
}

function isBoolean(value: string | undefined) {
  return value === "true" || value === "false";
}

function isEmail(value: string | undefined) {
  return Boolean(value && /^\S+@\S+\.\S+$/.test(value));
}

function isMailbox(value: string | undefined) {
  if (!value || /[\r\n]/.test(value)) return false;
  if (isEmail(value)) return true;
  const displayAddress = value.match(/^[^<>]*<([^<>]+)>$/);
  return Boolean(displayAddress && isEmail(displayAddress[1].trim()));
}

export function validateProductionEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  options: { force?: boolean } = {},
) {
  if (!options.force && environment.NODE_ENV !== "production") return [];

  const issues: ProductionEnvironmentIssue[] = [];
  const add = (key: string, message: string) => issues.push({ key, message });

  for (const key of requiredVariables) {
    if (!environment[key]?.trim()) add(key, "required variable is missing");
  }

  if (environment.NEXT_PUBLIC_SITE_URL && environment.NEXT_PUBLIC_SITE_URL !== "https://www.steelprodukt.ru") {
    add("NEXT_PUBLIC_SITE_URL", "must use the canonical production origin");
  }
  if (environment.NEXT_PUBLIC_YM_COUNTER_ID && environment.NEXT_PUBLIC_YM_COUNTER_ID !== "111263638") {
    add("NEXT_PUBLIC_YM_COUNTER_ID", "must equal the approved Yandex Metrica counter");
  }
  if (environment.NEXT_PUBLIC_YM_WEBVISOR && !isBoolean(environment.NEXT_PUBLIC_YM_WEBVISOR)) {
    add("NEXT_PUBLIC_YM_WEBVISOR", "must be true or false");
  }

  if (environment.SMTP_PORT && (!/^\d+$/.test(environment.SMTP_PORT) || Number(environment.SMTP_PORT) > 65_535)) {
    add("SMTP_PORT", "must be a valid TCP port");
  }
  if (environment.SMTP_SECURE && !isBoolean(environment.SMTP_SECURE)) {
    add("SMTP_SECURE", "must be true or false");
  }
  if (environment.SMTP_FROM && !isMailbox(environment.SMTP_FROM)) {
    add("SMTP_FROM", "must be a valid mailbox or display-name mailbox");
  }
  for (const key of ["SMTP_ENVELOPE_FROM", "QUOTE_RECIPIENT"] as const) {
    if (environment[key] && !isEmail(environment[key])) add(key, "must be a valid e-mail address");
  }

  for (const [key, expectedPath] of Object.entries(expectedStoragePaths)) {
    const configuredPath = environment[key];
    if (configuredPath && (!isAbsolute(configuredPath) || configuredPath !== expectedPath)) {
      add(key, `must equal ${expectedPath}`);
    }
  }
  if (environment.LEAD_RETENTION_DAYS && !isPositiveInteger(environment.LEAD_RETENTION_DAYS)) {
    add("LEAD_RETENTION_DAYS", "must be a positive integer");
  }
  if (environment.CONSENT_AUDIT_RETENTION_DAYS && !isPositiveInteger(environment.CONSENT_AUDIT_RETENTION_DAYS)) {
    add("CONSENT_AUDIT_RETENTION_DAYS", "must be a positive integer");
  }

  for (const key of ["IP_HASH_SALT", "CONSENT_AUDIT_SALT"] as const) {
    const salt = environment[key];
    if (salt && salt.length < 32) add(key, "must contain at least 32 characters");
  }
  if (
    environment.IP_HASH_SALT
    && environment.CONSENT_AUDIT_SALT
    && environment.IP_HASH_SALT === environment.CONSENT_AUDIT_SALT
  ) {
    add("CONSENT_AUDIT_SALT", "must be different from IP_HASH_SALT");
  }

  if (environment.TRUST_NGINX_PROXY && environment.TRUST_NGINX_PROXY !== "true") {
    add("TRUST_NGINX_PROXY", "must be true behind the production Nginx proxy");
  }
  if (environment.CLAMAV_ENABLED && !isBoolean(environment.CLAMAV_ENABLED)) {
    add("CLAMAV_ENABLED", "must be true or false");
  }

  for (const issue of validatePdAdminEnvironment(environment, { production: true })) {
    add(issue.key, issue.message);
  }

  return issues;
}

export function assertProductionEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  options: { force?: boolean } = {},
) {
  const issues = validateProductionEnvironment(environment, options);
  if (issues.length) throw new ProductionEnvironmentError(issues);
}
