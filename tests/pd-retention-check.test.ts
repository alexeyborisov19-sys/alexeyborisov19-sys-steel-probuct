import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openPdDatabase, closePdDatabase } from "@/lib/pd-admin/db/database";
import { pdTestKey } from "./helpers/pd-test-key";

test("daily retention check indexes missing leads and flags expiry without deleting source data", () => {
  const root = mkdtempSync(join(tmpdir(), "pd-daily-"));
  const databasePath = join(root, "admin", "personal-data.sqlite");
  const env = { ...process.env, NODE_ENV: "test" as const, PD_ADMIN_ENABLED: "true", PD_ADMIN_DB_PATH: databasePath,
    PD_EXPORT_PATH: join(root, "exports"), PD_SEARCH_HMAC_KEY: pdTestKey("daily-search"),
    PD_SESSION_HASH_KEY: pdTestKey("daily-session"), PD_AUDIT_CHAIN_KEY: pdTestKey("daily-audit"),
    QUOTE_STORAGE_PATH: join(root, "quote"), ASSISTANT_LEAD_STORAGE_PATH: join(root, "assistant"),
    CONSENT_AUDIT_STORAGE_PATH: join(root, "consent"), UPLOAD_QUARANTINE_PATH: join(root, "quarantine") };
  for (const directory of [env.QUOTE_STORAGE_PATH, env.ASSISTANT_LEAD_STORAGE_PATH, env.CONSENT_AUDIT_STORAGE_PATH, env.UPLOAD_QUARANTINE_PATH]) mkdirSync(directory);
  const database = openPdDatabase({ databasePath, environment: env });
  closePdDatabase(database, databasePath);
  const source = join(env.QUOTE_STORAGE_PATH, "SP-20200101-1234ABCD.json");
  writeFileSync(source, JSON.stringify({ requestId: "SP-20200101-1234ABCD", createdAt: "2020-01-01T00:00:00.000Z", source: "quote-form", name: "PRIVATE SENTINEL", email: "private@example.test", phone: "+79990000000", message: "PRIVATE SENTINEL", files: [], retentionDays: 90, delivery: "stored" }));
  try {
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/pd-retention-check.ts"], { env, encoding: "utf8", timeout: 30000 });
    assert.equal(result.status, 2, result.stderr);
    assert.ok(existsSync(source));
    const report = JSON.parse(readFileSync(join(root, "admin", "retention-monitor.json"), "utf8"));
    assert.equal(report.expired, 1);
    assert.equal(report.indexed, 1);
    assert.equal(report.deletionPerformed, false);
    assert.equal(report.status, "REVIEW_REQUIRED");
    assert.doesNotMatch(result.stdout, /PRIVATE SENTINEL|private@example/);
    assert.doesNotMatch(JSON.stringify(report), /PRIVATE SENTINEL|private@example/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
