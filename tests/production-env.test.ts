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
    NEXT_PUBLIC_YM_COUNTER_ID: "112542227",
    NEXT_PUBLIC_YM_WEBVISOR: "true",
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
    PD_ADMIN_ENABLED: "false",
    PD_ADMIN_DB_PATH: "/var/lib/steelprodukt/admin/personal-data.sqlite",
    PD_EXPORT_PATH: "/var/lib/steelprodukt/exports",
  };
}

test("accepts the complete production environment without exposing values", () => {
  const environment = validProductionEnvironment();
  assert.deepEqual(validateProductionEnvironment(environment, { force: true }), []);
  assert.doesNotThrow(() => assertProductionEnvironment(environment, { force: true }));
});

test("accepts a display name for SMTP_FROM but keeps the envelope address strict", () => {
  const environment = validProductionEnvironment();
  environment.SMTP_FROM = "Steel Product <site@example.ru>";
  assert.deepEqual(validateProductionEnvironment(environment, { force: true }), []);

  environment.SMTP_ENVELOPE_FROM = "Steel Product <site@example.ru>";
  assert.deepEqual(
    validateProductionEnvironment(environment, { force: true }).map((issue) => issue.key),
    ["SMTP_ENVELOPE_FROM"],
  );
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

test("rejects legacy Metrica settings, public storage, weak salts and untrusted proxy mode", () => {
  const environment = validProductionEnvironment();
  environment.NEXT_PUBLIC_YM_COUNTER_ID = "111263638";
  environment.NEXT_PUBLIC_YM_WEBVISOR = "false";
  environment.QUOTE_STORAGE_PATH = "/var/www/html/public/quotes";
  environment.IP_HASH_SALT = "short";
  environment.TRUST_NGINX_PROXY = "false";
  const keys = validateProductionEnvironment(environment, { force: true }).map((issue) => issue.key);
  assert.deepEqual(keys, [
    "NEXT_PUBLIC_YM_COUNTER_ID",
    "NEXT_PUBLIC_YM_WEBVISOR",
    "QUOTE_STORAGE_PATH",
    "IP_HASH_SALT",
    "TRUST_NGINX_PROXY",
  ]);
});

test("the metal uplift override is optional but must be a sane percentage", () => {
  const base = validProductionEnvironment();
  // Unset: production uses the owner-approved default.
  assert.deepEqual(validateProductionEnvironment(base, { force: true }), []);

  for (const accepted of ["0", "5", "7,5", "100"]) {
    assert.deepEqual(
      validateProductionEnvironment({ ...base, STEEL_PRODUCT_METAL_UPLIFT_PCT: accepted }, { force: true }),
      [],
      `${accepted} should be accepted`,
    );
  }

  for (const rejected of ["-1", "101", "abc"]) {
    const keys = validateProductionEnvironment(
      { ...base, STEEL_PRODUCT_METAL_UPLIFT_PCT: rejected },
      { force: true },
    ).map((issue) => issue.key);
    assert.deepEqual(keys, ["STEEL_PRODUCT_METAL_UPLIFT_PCT"], `${rejected} should be reported`);
  }
});

test("the price-refresh token is optional but must be long enough when present", () => {
  const base = validProductionEnvironment();
  // Unset: the quote form must still work, because an unset token only means
  // the supplier price refresh is not installed.
  assert.deepEqual(validateProductionEnvironment(base, { force: true }), []);
  assert.deepEqual(
    validateProductionEnvironment({ ...base, STEEL_PRODUCT_PRICE_REFRESH_TOKEN: "x".repeat(32) }, { force: true }),
    [],
  );

  const keys = validateProductionEnvironment(
    { ...base, STEEL_PRODUCT_PRICE_REFRESH_TOKEN: "too-short" },
    { force: true },
  ).map((issue) => issue.key);
  assert.deepEqual(keys, ["STEEL_PRODUCT_PRICE_REFRESH_TOKEN"]);
});

test("uses no production-only requirements during local development unless forced", () => {
  assert.deepEqual(validateProductionEnvironment({ NODE_ENV: "test" }), []);
});
