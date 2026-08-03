import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProductionEnvironment,
  ProductionEnvironmentError,
  validateProductionEnvironment,
} from "@/lib/config/production-env";

function validProductionEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://www.steelprodukt.ru",
    NEXT_PUBLIC_YM_COUNTER_ID: "111263638",
    NEXT_PUBLIC_YM_WEBVISOR: "false",
    SMTP_HOST: "smtp.example.ru",
    SMTP_PORT: "587",
    SMTP_SECURE: "false",
    SMTP_USER: "site@example.ru",
    SMTP_PASSWORD: "not-a-real-secret",
    SMTP_FROM: "site@example.ru",
    SMTP_ENVELOPE_FROM: "site@example.ru",
    QUOTE_RECIPIENT: "sales@example.ru",
    QUOTE_STORAGE_PATH: "/var/lib/steelprodukt/quote-leads",
    ASSISTANT_LEAD_STORAGE_PATH: "/var/lib/steelprodukt/assistant-leads",
    UPLOAD_QUARANTINE_PATH: "/var/lib/steelprodukt/quarantine",
    CONSENT_AUDIT_STORAGE_PATH: "/var/lib/steelprodukt/consent-audit",
    LEAD_RETENTION_DAYS: "90",
    CONSENT_AUDIT_RETENTION_DAYS: "1095",
    IP_HASH_SALT: "a-long-random-ip-hash-salt-placeholder-123456789",
    CONSENT_AUDIT_SALT: "a-different-long-audit-salt-placeholder-987654321",
    TRUST_NGINX_PROXY: "true",
    CLAMAV_ENABLED: "false",
    CLAMAV_COMMAND: "clamscan",
  };
}

test("accepts the complete production environment without exposing values", () => {
  const environment = validProductionEnvironment();
  assert.deepEqual(validateProductionEnvironment(environment, { force: true }), []);
  assert.doesNotThrow(() => assertProductionEnvironment(environment, { force: true }));
});

test("reports missing variables by key before a quote is accepted", () => {
  const environment = validProductionEnvironment();
  delete environment.IP_HASH_SALT;
  delete environment.CONSENT_AUDIT_SALT;
  const issues = validateProductionEnvironment(environment, { force: true });
  assert.deepEqual(issues.map((issue) => issue.key), ["IP_HASH_SALT", "CONSENT_AUDIT_SALT"]);
  assert.throws(
    () => assertProductionEnvironment(environment, { force: true }),
    (error: unknown) => error instanceof ProductionEnvironmentError
      && error.code === "CONFIGURATION_ERROR"
      && !error.message.includes("a-long-random"),
  );
});

test("rejects a wrong counter, public storage, weak salts and untrusted proxy mode", () => {
  const environment = validProductionEnvironment();
  environment.NEXT_PUBLIC_YM_COUNTER_ID = "123";
  environment.QUOTE_STORAGE_PATH = "/var/www/html/public/quotes";
  environment.IP_HASH_SALT = "short";
  environment.TRUST_NGINX_PROXY = "false";
  const keys = validateProductionEnvironment(environment, { force: true }).map((issue) => issue.key);
  assert.deepEqual(keys, [
    "NEXT_PUBLIC_YM_COUNTER_ID",
    "QUOTE_STORAGE_PATH",
    "IP_HASH_SALT",
    "TRUST_NGINX_PROXY",
  ]);
});

test("uses no production-only requirements during local development unless forced", () => {
  assert.deepEqual(validateProductionEnvironment({ NODE_ENV: "test" }), []);
});
