import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createPreAuthChallenge, verifyPreAuthChallenge } from "@/lib/pd-admin/auth/preauth";
import { authenticatePdSession, PdAuthenticationError, type PdAuthContext } from "@/lib/pd-admin/auth/context";
import { hasPdPermission } from "@/lib/pd-admin/auth/permissions";
import { createSessionSecrets } from "@/lib/pd-admin/auth/session";
import { findSessionByToken, listUserSessions, persistSession } from "@/lib/pd-admin/auth/session-store";
import { assertAdministrativeOrigin } from "@/lib/pd-admin/http/request";
import { PdRequestRejectedError } from "@/lib/pd-admin/http/request";
import { PdCsrfError } from "@/lib/pd-admin/auth/csrf";
import { pdRouteError } from "@/lib/pd-admin/http/route-context";
import { closePdDatabase, openPdDatabase } from "@/lib/pd-admin/db/database";
import { dashboardSnapshot } from "@/lib/pd-admin/dashboard/service";
import { readPdAdminConfig } from "@/lib/pd-admin/config";
import { addLeadComment, editOwnLeadComment, updateRetentionOverride, updateWorkflow } from "@/lib/pd-admin/leads/repository";

const searchKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const sessionKey = "1123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const auditKey = "2123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function environment(databasePath: string): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    PD_ADMIN_ENABLED: "true",
    PD_ADMIN_DB_PATH: databasePath,
    PD_EXPORT_PATH: join(databasePath, "..", "exports"),
    PD_SEARCH_HMAC_KEY: searchKey,
    PD_SESSION_HASH_KEY: sessionKey,
    PD_AUDIT_CHAIN_KEY: auditKey,
  };
}

test("Stage 3 RBAC follows the central least-privilege matrix", () => {
  assert.equal(hasPdPermission("ADMIN", "MANAGE_USERS"), true);
  assert.equal(hasPdPermission("ADMIN", "REVOKE_SESSIONS"), true);
  assert.equal(hasPdPermission("PERSONAL_DATA_OFFICER", "SEARCH_TEXT"), true);
  assert.equal(hasPdPermission("PERSONAL_DATA_OFFICER", "CHANGE_RETENTION"), true);
  assert.equal(hasPdPermission("PERSONAL_DATA_OFFICER", "MANAGE_USERS"), false);
  assert.equal(hasPdPermission("MANAGER", "REVEAL_CONTACTS"), true);
  assert.equal(hasPdPermission("MANAGER", "SEARCH_TEXT"), false);
  assert.equal(hasPdPermission("MANAGER", "VIEW_ACCESS_LOG"), false);
  assert.equal(hasPdPermission("MANAGER", "VIEW_INTEGRITY"), false);
  assert.equal(hasPdPermission("AUDITOR", "VIEW_CONSENT"), true);
  assert.equal(hasPdPermission("AUDITOR", "REVEAL_CONTACTS"), false);
  assert.equal(hasPdPermission("AUDITOR", "DOWNLOAD_ATTACHMENT"), false);
  assert.equal(hasPdPermission("AUDITOR", "CHANGE_WORKFLOW"), false);
});

test("pre-auth challenge is signed, expires and rejects tampering", () => {
  const now = new Date("2026-08-09T00:00:00.000Z");
  const challenge = createPreAuthChallenge(sessionKey, now);
  assert.equal(verifyPreAuthChallenge(challenge.token, challenge.cookieValue, sessionKey, new Date("2026-08-09T00:09:59.000Z")), true);
  assert.equal(verifyPreAuthChallenge(`${challenge.token}x`, challenge.cookieValue, sessionKey, now), false);
  assert.equal(verifyPreAuthChallenge(challenge.token, challenge.cookieValue, sessionKey, new Date("2026-08-09T00:10:01.000Z")), false);
});

test("administrative Origin allows local development but enforces canonical production", () => {
  const previous = process.env.NODE_ENV;
  const mutableEnvironment = process.env as Record<string, string | undefined>;
  try {
    mutableEnvironment.NODE_ENV = "test";
    assert.doesNotThrow(() => assertAdministrativeOrigin(new Request("http://127.0.0.1:3010/api/internal/personal-data/auth/login", { method: "POST", headers: { origin: "http://127.0.0.1:3010", "sec-fetch-site": "same-origin" } })));
    mutableEnvironment.NODE_ENV = "production";
    assert.throws(() => assertAdministrativeOrigin(new Request("https://attacker.example/api/internal/personal-data/auth/login", { method: "POST", headers: { origin: "https://attacker.example", "sec-fetch-site": "same-origin", "x-forwarded-proto": "https", "x-forwarded-host": "www.steelprodukt.ru" } })));
    assert.throws(() => assertAdministrativeOrigin(new Request("https://www.steelprodukt.ru/api/internal/personal-data/auth/login", { method: "POST", headers: { origin: "https://www.steelprodukt.ru", "sec-fetch-site": "same-origin", "x-forwarded-proto": "http", "x-forwarded-host": "www.steelprodukt.ru" } })));
    assert.doesNotThrow(() => assertAdministrativeOrigin(new Request("https://www.steelprodukt.ru/api/internal/personal-data/auth/login", { method: "POST", headers: { origin: "https://www.steelprodukt.ru", "sec-fetch-site": "same-origin", "x-forwarded-proto": "https", "x-forwarded-host": "www.steelprodukt.ru" } })));
  } finally {
    if (previous === undefined) delete mutableEnvironment.NODE_ENV;
    else mutableEnvironment.NODE_ENV = previous;
  }
});

test("visible session records never expose token or CSRF hashes", async () => {
  const root = await mkdtemp(join(tmpdir(), "steelprodukt-pd-stage3-"));
  const databasePath = join(root, "personal-data.sqlite");
  const database = openPdDatabase({ databasePath, environment: environment(databasePath) });
  try {
    const now = "2026-08-09T00:00:00.000Z";
    database.prepare(`INSERT INTO users(id, username, display_name, password_hash, password_algorithm, password_version, role, created_at, updated_at) VALUES ('user-1','admin','Admin','hash','scrypt',1,'ADMIN',?,?)`).run(now, now);
    const session = persistSession(database, { userId: "user-1", ipHash: "ip", userAgentHash: "ua", hashKey: sessionKey, idleMinutes: 30, absoluteHours: 8, now: new Date(now) });
    const visible = listUserSessions(database, "user-1", session.id);
    const serialized = JSON.stringify(visible);
    assert.equal(serialized.includes(session.token), false);
    assert.equal(serialized.includes(session.csrfToken), false);
    assert.equal(serialized.includes(session.tokenHash), false);
    assert.equal(serialized.includes(session.csrfSecretHash), false);
  } finally {
    closePdDatabase(database, databasePath);
  }
});

test("session authentication rejects a changed User-Agent fingerprint", async () => {
  const root = await mkdtemp(join(tmpdir(), "steelprodukt-pd-session-binding-"));
  const databasePath = join(root, "personal-data.sqlite");
  const env = environment(databasePath);
  const database = openPdDatabase({ databasePath, environment: env });
  try {
    const now = "2026-08-09T00:00:00.000Z";
    database.prepare(`INSERT INTO users(id, username, display_name, password_hash, password_algorithm, password_version, role, must_change_password, created_at, updated_at) VALUES ('user-1','admin','Admin','hash','scrypt',1,'ADMIN',0,?,?)`).run(now, now);
    const session = persistSession(database, { userId: "user-1", ipHash: "ip", userAgentHash: "expected-ua", hashKey: sessionKey, idleMinutes: 30, absoluteHours: 8, now: new Date(now) });
    assert.throws(() => authenticatePdSession({
      sessionToken: session.token,
      csrfToken: session.csrfToken,
      ipHash: "ip",
      userAgentHash: "changed-ua",
      now: new Date("2026-08-09T00:01:00.000Z"),
      environment: env,
    }), PdAuthenticationError);
  } finally {
    closePdDatabase(database, databasePath);
  }
});

test("comments are editable only by their author without audit leakage and retention requires step-up", async () => {
  const root = await mkdtemp(join(tmpdir(), "steelprodukt-pd-lead-actions-"));
  const databasePath = join(root, "personal-data.sqlite");
  const env = environment(databasePath);
  const config = readPdAdminConfig(env, { production: false });
  const database = openPdDatabase({ databasePath, environment: env });
  try {
    const now = "2026-08-09T00:00:00.000Z";
    database.prepare(`INSERT INTO users(id, username, display_name, password_hash, password_algorithm, password_version, role, must_change_password, created_at, updated_at) VALUES ('user-1','admin','Admin','hash','scrypt',1,'ADMIN',0,?,?)`).run(now, now);
    const secret = persistSession(database, { userId: "user-1", ipHash: "ip", userAgentHash: "ua", hashKey: sessionKey, idleMinutes: 30, absoluteHours: 8, now: new Date(now) });
    const stored = findSessionByToken(database, secret.token, sessionKey, new Date("2026-08-09T00:01:00.000Z"));
    assert.ok(stored);
    database.prepare(`INSERT INTO lead_index(request_id, source, created_at, storage_path_type, retention_days, expires_at, consent_audit_status, delivery_status, files_count, integrity_status, first_indexed_at, last_indexed_at) VALUES ('SP-20260809-ABCDEF12','quote-form',?,'quote-leads',90,'2026-11-07T00:00:00.000Z','recorded','email',0,'OK',?,?)`).run(now, now, now);
    database.prepare(`INSERT INTO lead_workflow(request_id, internal_status, created_at, updated_at) VALUES ('SP-20260809-ABCDEF12','NEW',?,?)`).run(now, now);
    const context: PdAuthContext = {
      config,
      database,
      databasePath,
      user: { id: "user-1", username: "admin", displayName: "Admin", role: "ADMIN", mustChangePassword: false, passwordVersion: 1 },
      session: stored,
      csrfToken: secret.csrfToken,
      ipHash: "ip",
      close: () => undefined,
    };
    const created = addLeadComment(context, "SP-20260809-ABCDEF12", "Первый служебный комментарий");
    assert.ok(created);
    assert.equal(editOwnLeadComment(context, "SP-20260809-ABCDEF12", created.id, "Исправленный служебный комментарий"), true);
    assert.equal((database.prepare("SELECT body FROM staff_comments WHERE id = ?").get(created.id) as { body: string }).body, "Исправленный служебный комментарий");
    database.prepare(`INSERT INTO users(id, username, display_name, password_hash, password_algorithm, password_version, role, must_change_password, created_at, updated_at) VALUES ('user-2','other-admin','Other Admin','hash','scrypt',1,'ADMIN',0,?,?)`).run(now, now);
    const otherSecret = persistSession(database, { userId: "user-2", ipHash: "ip-2", userAgentHash: "ua-2", hashKey: sessionKey, idleMinutes: 30, absoluteHours: 8, now: new Date(now) });
    const otherStored = findSessionByToken(database, otherSecret.token, sessionKey, new Date("2026-08-09T00:01:00.000Z"));
    assert.ok(otherStored);
    const otherContext: PdAuthContext = {
      ...context,
      user: { id: "user-2", username: "other-admin", displayName: "Other Admin", role: "ADMIN", mustChangePassword: false, passwordVersion: 1 },
      session: otherStored,
      csrfToken: otherSecret.csrfToken,
      ipHash: "ip-2",
    };
    assert.equal(editOwnLeadComment(otherContext, "SP-20260809-ABCDEF12", created.id, "Чужое изменение"), false);
    assert.throws(() => updateWorkflow(context, "SP-20260809-ABCDEF12", "DELETED"), /INVALID_STATUS/);
    assert.throws(() => updateRetentionOverride(context, "SP-20260809-ABCDEF12", { until: "2099-12-31", reason: "Договорное основание" }), /STEP_UP_REQUIRED/);
    context.session.stepUpUntil = "2099-12-31T23:59:59.999Z";
    assert.equal(updateRetentionOverride(context, "SP-20260809-ABCDEF12", { until: "2099-12-31", reason: "Договорное основание" }), true);
    const workflow = database.prepare("SELECT retention_override_until, retention_override_reason FROM lead_workflow WHERE request_id = 'SP-20260809-ABCDEF12'").get() as { retention_override_until: string; retention_override_reason: string };
    assert.equal(workflow.retention_override_until, "2099-12-31T23:59:59.999Z");
    assert.equal(workflow.retention_override_reason, "Договорное основание");
    const auditText = JSON.stringify(database.prepare("SELECT action, metadata_json FROM access_events ORDER BY id").all());
    assert.equal(auditText.includes("Исправленный служебный комментарий"), false);
    assert.match(auditText, /COMMENT_EDITED/);
    assert.match(auditText, /RETENTION_OVERRIDE_SET/);
  } finally {
    closePdDatabase(database, databasePath);
  }
});

test("dashboard does not turn unknown integrity findings into green zeroes", async () => {
  const root = await mkdtemp(join(tmpdir(), "steelprodukt-pd-dashboard-"));
  const databasePath = join(root, "personal-data.sqlite");
  const env = environment(databasePath);
  const database = openPdDatabase({ databasePath, environment: env });
  try {
    const snapshot = dashboardSnapshot(database, readPdAdminConfig(env, { production: false }));
    assert.equal(snapshot.integrity.orphanConsent, null);
    assert.equal(snapshot.integrity.orphanQuarantine, null);
    assert.equal(snapshot.integrity.symlinkFindings, null);
    assert.equal(snapshot.integrity.auditChain.valid, null);
    assert.equal(snapshot.backupOverall.label, "Частичная готовность");
  } finally {
    closePdDatabase(database, databasePath);
  }
});

test("internal route group is isolated from public analytics and widgets", async () => {
  const rootLayout = await readFile("app/layout.tsx", "utf8");
  const publicLayout = await readFile("app/(public)/layout.tsx", "utf8");
  const internalLayout = await readFile("app/(internal)/internal/personal-data/layout.tsx", "utf8");
  for (const source of [rootLayout, internalLayout]) {
    assert.doesNotMatch(source, /Analytics|CookieConsent|EngineeringAssistant|SitePreloader|JsonLd/);
  }
  assert.match(publicLayout, /Analytics/);
  assert.match(publicLayout, /CookieConsent/);
  assert.match(publicLayout, /EngineeringAssistant/);
  assert.match(internalLayout, /force-no-store/);
  assert.match(internalLayout, /index: false/);
});

test("administrative HTTP authentication never applies database migrations", async () => {
  const contextSource = await readFile("lib/pd-admin/auth/context.ts", "utf8");
  const serviceSource = await readFile("lib/pd-admin/auth/service.ts", "utf8");
  assert.match(contextSource, /openPdDatabase\(\{[^}]*applyMigrations: false/);
  assert.match(serviceSource, /openPdDatabase\(\{ applyMigrations: false \}\)/);
});

test("Stage 3 source contains no hard-coded administrative secrets", async () => {
  const sources = await Promise.all([
    readFile("app/(internal)/internal/personal-data/layout.tsx", "utf8"),
    readFile("lib/pd-admin/auth/service.ts", "utf8"),
    readFile("components/pd-admin/LoginForm.tsx", "utf8"),
  ]);
  assert.doesNotMatch(sources.join("\n"), /PD_SEARCH_HMAC_KEY\s*=|PD_AUDIT_CHAIN_KEY\s*=|PD_SESSION_HASH_KEY\s*=/);
  const session = createSessionSecrets(sessionKey);
  assert.equal(sources.join("\n").includes(session.token), false);
});

test("internal route errors map CSRF and Origin failures to safe 403 responses", async () => {
  const csrf = pdRouteError(new PdCsrfError());
  const origin = pdRouteError(new PdRequestRejectedError());
  assert.equal(csrf.status, 403);
  assert.equal(origin.status, 403);
  assert.deepEqual(await csrf.json(), { ok: false, code: "CSRF_REJECTED" });
  assert.deepEqual(await origin.json(), { ok: false, code: "CSRF_REJECTED" });
});
