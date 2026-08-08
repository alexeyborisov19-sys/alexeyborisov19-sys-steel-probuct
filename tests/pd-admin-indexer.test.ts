import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { contactHmac } from "@/lib/pd-admin/contacts";
import { closePdDatabase, openPdDatabase } from "@/lib/pd-admin/db/database";
import { syncLeadIndex } from "@/lib/pd-admin/indexing/lead-index";

const searchKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const sessionKey = "1123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const auditKey = "2123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "steelprodukt-pd-index-"));
  const paths = {
    quote: join(root, "quote-leads"),
    assistant: join(root, "assistant-leads"),
    consent: join(root, "consent-audit"),
    quarantine: join(root, "quarantine"),
  };
  await Promise.all(Object.values(paths).map((path) => mkdir(path, { mode: 0o700 })));
  const databasePath = join(root, "admin", "personal-data.sqlite");
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    PD_ADMIN_ENABLED: "true",
    PD_ADMIN_DB_PATH: databasePath,
    PD_EXPORT_PATH: join(root, "exports"),
    PD_SEARCH_HMAC_KEY: searchKey,
    PD_SESSION_HASH_KEY: sessionKey,
    PD_AUDIT_CHAIN_KEY: auditKey,
  };
  const database = openPdDatabase({ databasePath, environment });
  return { root, paths, databasePath, database };
}

test("indexer stores only contact HMACs and is idempotent", async () => {
  const context = await fixture();
  const requestId = "SP-20260808-1234ABCD";
  const rawPhone = "+7 (910) 780-37-23";
  const rawEmail = "Buyer@Example.RU";
  await writeFile(join(context.paths.quote, `${requestId}.json`), JSON.stringify({
    requestId,
    createdAt: "2026-08-08T00:00:00.000Z",
    source: "quote-form",
    name: "Not copied",
    company: "Not copied",
    phone: rawPhone,
    email: rawEmail,
    message: "Not copied",
    files: [],
    consentAudit: "recorded",
    delivery: "stored",
    retentionDays: 90,
  }), { mode: 0o600 });
  const auditId = "123e4567-e89b-42d3-a456-426614174000";
  await writeFile(join(context.paths.consent, `${auditId}.json`), JSON.stringify({
    auditId,
    requestId,
  }), { mode: 0o600 });

  try {
    const options = {
      database: context.database,
      mode: "incremental" as const,
      quoteRoot: context.paths.quote,
      assistantRoot: context.paths.assistant,
      consentRoot: context.paths.consent,
      quarantineRoot: context.paths.quarantine,
      hmacKey: searchKey,
      hmacKeyVersion: 1,
      now: new Date("2026-08-08T01:00:00.000Z"),
    };
    const first = await syncLeadIndex(options);
    const second = await syncLeadIndex(options);
    assert.equal(first.indexed, 1);
    assert.equal(second.indexed, 1);
    assert.equal((context.database.prepare("SELECT count(*) count FROM lead_index").get() as { count: number }).count, 1);
    const row = context.database.prepare(`
      SELECT phone_hmac, email_hmac FROM lead_index WHERE request_id = ?
    `).get(requestId) as { phone_hmac: string; email_hmac: string };
    assert.equal(row.phone_hmac, contactHmac("phone", rawPhone, searchKey, 1));
    assert.equal(row.email_hmac, contactHmac("email", rawEmail, searchKey, 1));
    const serialized = JSON.stringify({ first, second, row });
    assert.equal(serialized.includes(rawPhone), false);
    assert.equal(serialized.includes(rawEmail), false);
    assert.equal(serialized.includes(searchKey), false);
    assert.equal("name_normalized" in row, false);
  } finally {
    closePdDatabase(context.database, context.databasePath);
  }
});

test("corrupted lead JSON does not stop the indexer", async () => {
  const context = await fixture();
  await writeFile(join(context.paths.quote, "SP-20260808-1234ABCD.json"), "{broken", { mode: 0o600 });
  try {
    const result = await syncLeadIndex({
      database: context.database,
      mode: "dry-run",
      quoteRoot: context.paths.quote,
      assistantRoot: context.paths.assistant,
      consentRoot: context.paths.consent,
      quarantineRoot: context.paths.quarantine,
      hmacKey: searchKey,
      hmacKeyVersion: 1,
    });
    assert.equal(result.examined, 1);
    assert.equal(result.findings.CORRUPT_JSON, 1);
  } finally {
    closePdDatabase(context.database, context.databasePath);
  }
});

test("indexer refuses contact processing without its production HMAC key", async () => {
  const context = await fixture();
  try {
    await assert.rejects(syncLeadIndex({
      database: context.database,
      mode: "dry-run",
      quoteRoot: context.paths.quote,
      assistantRoot: context.paths.assistant,
      consentRoot: context.paths.consent,
      quarantineRoot: context.paths.quarantine,
      hmacKey: "",
      hmacKeyVersion: 1,
    }));
  } finally {
    closePdDatabase(context.database, context.databasePath);
  }
});
