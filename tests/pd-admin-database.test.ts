import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { recordAccessEvent, verifyAccessEventChain } from "@/lib/pd-admin/audit/chain";
import { persistSession } from "@/lib/pd-admin/auth/session-store";
import { closePdDatabase, migrationStatus, openPdDatabase } from "@/lib/pd-admin/db/database";
import { pdTestKey } from "./helpers/pd-test-key";

const searchKey = pdTestKey("database-search");
const sessionKey = pdTestKey("database-session");
const auditKey = pdTestKey("database-audit");

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

async function databaseFixture() {
  const root = await mkdtemp(join(tmpdir(), "steelprodukt-pd-db-"));
  const path = join(root, "personal-data.sqlite");
  const database = openPdDatabase({ databasePath: path, environment: environment(path) });
  return { root, path, database };
}

test("SQLite migrations apply once with WAL, foreign keys and private modes", async () => {
  const fixture = await databaseFixture();
  try {
    const appliedBeforeReopen = migrationStatus(fixture.database);
    assert.ok(appliedBeforeReopen.length >= 2);
    assert.equal(appliedBeforeReopen.every((item) => item.state === "applied"), true);
    openPdDatabase({ databasePath: fixture.path, environment: environment(fixture.path) }).close();
    assert.equal(
      Number((fixture.database.prepare("SELECT count(*) count FROM schema_migrations").get() as { count: number }).count),
      appliedBeforeReopen.length,
    );
    assert.equal((fixture.database.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys, 1);
    assert.equal((fixture.database.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode, "wal");
    assert.equal((await stat(fixture.root)).mode & 0o777, 0o700);
    assert.equal((await stat(fixture.path)).mode & 0o777, 0o600);
  } finally {
    closePdDatabase(fixture.database, fixture.path);
  }
});

test("session persistence stores only token and CSRF hashes", async () => {
  const fixture = await databaseFixture();
  try {
    const now = "2026-08-08T00:00:00.000Z";
    fixture.database.prepare(`
      INSERT INTO users(
        id, username, display_name, password_hash, password_algorithm,
        password_version, role, created_at, updated_at
      ) VALUES ('user-1', 'admin', 'Administrator', 'encoded', 'scrypt', 1, 'ADMIN', ?, ?)
    `).run(now, now);
    const session = persistSession(fixture.database, {
      userId: "user-1",
      ipHash: "ip-hash",
      userAgentHash: "ua-hash",
      hashKey: sessionKey,
      idleMinutes: 30,
      absoluteHours: 8,
      now: new Date(now),
    });
    const row = fixture.database.prepare("SELECT token_hash, csrf_secret_hash FROM sessions WHERE id = ?").get(session.id) as {
      token_hash: string;
      csrf_secret_hash: string;
    };
    assert.equal(row.token_hash, session.tokenHash);
    assert.equal(row.csrf_secret_hash, session.csrfSecretHash);
    assert.equal(JSON.stringify(row).includes(session.token), false);
    assert.equal(JSON.stringify(row).includes(session.csrfToken), false);
  } finally {
    closePdDatabase(fixture.database, fixture.path);
  }
});

test("access-event HMAC chain verifies and detects historical modification", async () => {
  const fixture = await databaseFixture();
  try {
    recordAccessEvent(fixture.database, {
      occurredAt: "2026-08-08T00:00:00.000Z",
      action: "VIEW_LEAD",
      targetType: "LEAD",
      targetId: "SP-20260808-1234ABCD",
      legalBasis: "CUSTOMER_REQUEST_PROCESSING",
      result: "SUCCESS",
      ipHash: "ip-hash",
      metadata: { requestId: "SP-20260808-1234ABCD", role: "ADMIN" },
    }, auditKey);
    recordAccessEvent(fixture.database, {
      occurredAt: "2026-08-08T00:01:00.000Z",
      action: "SEARCH_CONTACT",
      targetType: "LEAD_INDEX",
      legalBasis: "SUBJECT_REQUEST",
      result: "SUCCESS",
      ipHash: "ip-hash",
      metadata: { count: 1, role: "PERSONAL_DATA_OFFICER" },
    }, auditKey);
    assert.deepEqual(verifyAccessEventChain(fixture.database, auditKey), { valid: true, events: 2, invalidIds: [] });
    fixture.database.prepare("UPDATE access_events SET result = 'ALTERED' WHERE id = 1").run();
    const tampered = verifyAccessEventChain(fixture.database, auditKey);
    assert.equal(tampered.valid, false);
    assert.deepEqual(tampered.invalidIds, [1]);
  } finally {
    closePdDatabase(fixture.database, fixture.path);
  }
});

test("access-event metadata rejects unapproved personal-data fields", async () => {
  const fixture = await databaseFixture();
  try {
    assert.throws(() => recordAccessEvent(fixture.database, {
      action: "VIEW_LEAD",
      targetType: "LEAD",
      result: "SUCCESS",
      ipHash: "ip-hash",
      metadata: { email: "not-allowed@example.test" } as never,
    }, auditKey));
    assert.equal((fixture.database.prepare("SELECT count(*) count FROM access_events").get() as { count: number }).count, 0);
  } finally {
    closePdDatabase(fixture.database, fixture.path);
  }
});
