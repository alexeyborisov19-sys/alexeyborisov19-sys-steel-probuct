import assert from "node:assert/strict";
import test from "node:test";
import { assertPdMutationRequest } from "@/lib/pd-admin/auth/csrf";
import { hashPassword, verifyPassword } from "@/lib/pd-admin/auth/password";
import { hasPdPermission, permissionsForRole } from "@/lib/pd-admin/auth/permissions";
import { evaluateLoginAttempt, recordLoginAttempt } from "@/lib/pd-admin/auth/login-policy";
import {
  createSessionSecrets,
  createStepUpExpiry,
  isStepUpActive,
  sessionCookieOptions,
} from "@/lib/pd-admin/auth/session";
import { contactHmac, normalizeEmail, normalizePhone } from "@/lib/pd-admin/contacts";
import { validatePdAdminEnvironment } from "@/lib/pd-admin/config";
import { closePdDatabase, openPdDatabase } from "@/lib/pd-admin/db/database";
import { pdSafeError } from "@/lib/pd-admin/http/safe-response";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pdTestKey } from "./helpers/pd-test-key";

const hmacKey = pdTestKey("foundation-search");
const sessionKey = pdTestKey("foundation-session");

test("production refuses unsafe administrative database and export paths", () => {
  const issues = validatePdAdminEnvironment({
    NODE_ENV: "production",
    PD_ADMIN_ENABLED: "false",
    PD_ADMIN_DB_PATH: `${process.cwd()}/public/personal-data.sqlite`,
    PD_EXPORT_PATH: `${process.cwd()}/public/exports`,
  }, { production: true });
  assert.deepEqual(issues.map((issue) => issue.key), ["PD_ADMIN_DB_PATH", "PD_EXPORT_PATH", "PD_ADMIN_DB_PATH", "PD_EXPORT_PATH"]);
});

test("production requires separate strong administrative keys only when enabled", () => {
  assert.equal(validatePdAdminEnvironment({ NODE_ENV: "test", PD_ADMIN_ENABLED: "false" }, { production: false }).length, 0);
  const issues = validatePdAdminEnvironment({
    NODE_ENV: "test",
    PD_ADMIN_ENABLED: "true",
    PD_ADMIN_DB_PATH: "/tmp/pd-admin.sqlite",
    PD_EXPORT_PATH: "/tmp/pd-exports",
    PD_SEARCH_HMAC_KEY: "short",
    PD_SESSION_HASH_KEY: sessionKey,
    PD_AUDIT_CHAIN_KEY: sessionKey,
  }, { production: false });
  assert.deepEqual(issues.map((issue) => issue.key), [
    "PD_SEARCH_HMAC_KEY",
    "PD_AUDIT_CHAIN_KEY",
  ]);
  assert.ok(issues.every((issue) => !issue.message.includes(sessionKey)));
});

test("phone and email normalization produce stable versioned HMAC indexes", () => {
  assert.equal(normalizePhone("+7 (910) 780-37-23"), "79107803723");
  assert.equal(normalizePhone("8 910 780 37 23"), "79107803723");
  assert.equal(normalizeEmail(" Info@STEELPRODUKT.RU "), "info@steelprodukt.ru");
  assert.equal(
    contactHmac("phone", "+7 (910) 780-37-23", hmacKey, 1),
    contactHmac("phone", "8 910 780 37 23", hmacKey, 1),
  );
  assert.notEqual(
    contactHmac("email", "info@steelprodukt.ru", hmacKey, 1),
    contactHmac("email", "info@steelprodukt.ru", hmacKey, 2),
  );
});

test("RBAC keeps dangerous operations away from manager and auditor", () => {
  assert.equal(hasPdPermission("MANAGER", "VIEW_FULL_LEAD"), true);
  assert.equal(hasPdPermission("MANAGER", "MANAGE_USERS"), false);
  assert.equal(hasPdPermission("MANAGER", "APPROVE_DELETION"), false);
  assert.equal(hasPdPermission("AUDITOR", "CHANGE_WORKFLOW"), false);
  assert.equal(hasPdPermission("PERSONAL_DATA_OFFICER", "CREATE_EXPORT_PREVIEW"), true);
  assert.equal(hasPdPermission("PERSONAL_DATA_OFFICER", "CHANGE_ROLES"), false);
  assert.equal(permissionsForRole("ADMIN").length > permissionsForRole("PERSONAL_DATA_OFFICER").length, true);
});

test("scrypt password hashes are salted, versioned and verifiable", () => {
  const password = "Strong-Temporary-Password-2026!";
  const first = hashPassword(password);
  const second = hashPassword(password);
  assert.match(first, /^scrypt\$1\$/);
  assert.notEqual(first, second);
  assert.equal(verifyPassword(password, first), true);
  assert.equal(verifyPassword("Wrong-Password-2026!", first), false);
  assert.equal(first.includes(password), false);
});

test("session stores hashes separately and cookie is hardened", () => {
  const session = createSessionSecrets(sessionKey, new Date("2026-08-08T00:00:00.000Z"), 30, 8);
  assert.equal(session.token.length > 32, true);
  assert.notEqual(session.token, session.tokenHash);
  assert.notEqual(session.csrfToken, session.csrfSecretHash);
  const cookie = sessionCookieOptions(1800, true);
  assert.deepEqual(cookie, {
    name: "__Host-steelprodukt-pd-session",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 1800,
  });
});

test("CSRF requires canonical origin and a token tied to the session", () => {
  const session = createSessionSecrets(sessionKey);
  const allowed = new Request("https://www.steelprodukt.ru/api/internal/personal-data/leads", {
    method: "POST",
    headers: {
      origin: "https://www.steelprodukt.ru",
      "sec-fetch-site": "same-origin",
      "x-steelprodukt-csrf": session.csrfToken,
    },
  });
  assert.doesNotThrow(() => assertPdMutationRequest(allowed, session.csrfSecretHash, sessionKey));
  const rejected = new Request(allowed, { headers: { origin: "https://attacker.example" } });
  assert.throws(() => assertPdMutationRequest(rejected, session.csrfSecretHash, sessionKey));
});

test("step-up expires at the configured boundary", () => {
  const now = new Date("2026-08-08T00:00:00.000Z");
  const until = createStepUpExpiry(10, now);
  assert.equal(isStepUpActive(until, new Date("2026-08-08T00:09:59.000Z")), true);
  assert.equal(isStepUpActive(until, new Date("2026-08-08T00:10:00.000Z")), false);
});

test("login failures are hashed and temporarily lock both account and source", () => {
  const root = mkdtempSync(join(tmpdir(), "steelprodukt-pd-login-"));
  const databasePath = join(root, "personal-data.sqlite");
  const database = openPdDatabase({
    databasePath,
    environment: {
      NODE_ENV: "test",
      PD_ADMIN_ENABLED: "true",
      PD_SEARCH_HMAC_KEY: hmacKey,
      PD_SESSION_HASH_KEY: sessionKey,
      PD_AUDIT_CHAIN_KEY: pdTestKey("foundation-audit"),
    },
  });
  const now = new Date("2026-08-08T00:00:00.000Z");
  database.prepare(`
    INSERT INTO users(
      id, username, display_name, password_hash, password_algorithm,
      password_version, role, created_at, updated_at
    ) VALUES ('user-1', 'admin', 'Administrator', 'hash', 'scrypt', 1, 'ADMIN', ?, ?)
  `).run(now.toISOString(), now.toISOString());
  for (let attempt = 0; attempt < 3; attempt += 1) {
    recordLoginAttempt(database, {
      username: "admin",
      ipAddress: "203.0.113.10",
      hashKey: sessionKey,
      success: false,
      failureReason: "INVALID_PASSWORD",
      userId: "user-1",
      maxAttempts: 3,
      lockMinutes: 15,
      now,
    });
  }
  const decision = evaluateLoginAttempt(database, {
    username: "admin",
    ipAddress: "203.0.113.10",
    hashKey: sessionKey,
    maxAttempts: 3,
    lockMinutes: 15,
    now,
  });
  assert.equal(decision.allowed, false);
  assert.equal("reason" in decision ? decision.reason : null, "ACCOUNT_LOCKED");
  const attempt = database.prepare("SELECT username_hash, ip_hash FROM login_attempts LIMIT 1").get() as {
    username_hash: string;
    ip_hash: string;
  };
  assert.notEqual(attempt.username_hash, "admin");
  assert.notEqual(attempt.ip_hash, "203.0.113.10");
  closePdDatabase(database, databasePath);
});

test("safe internal errors do not expose arbitrary messages or paths", async () => {
  const response = pdSafeError("/var/lib/steelprodukt/private", 500);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.deepEqual(await response.json(), { ok: false, code: "INTERNAL_ERROR" });
});
