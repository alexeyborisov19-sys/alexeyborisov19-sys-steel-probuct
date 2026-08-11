import { existsSync, lstatSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { verifyAccessEventChain } from "@/lib/pd-admin/audit/chain";
import { readPdAdminConfig } from "@/lib/pd-admin/config";
import { closePdDatabase, migrationStatus, openPdDatabase } from "@/lib/pd-admin/db/database";
import { syncLeadIndex } from "@/lib/pd-admin/indexing/lead-index";

type Finding = { code: string; severity: "warning" | "error" };

function protectedMode(path: string, expected: number) {
  if (!existsSync(path)) return false;
  const node = lstatSync(path);
  return !node.isSymbolicLink() && (node.mode & 0o777) === expected;
}

function publicJsonCount(root: string) {
  if (!existsSync(root)) return 0;
  let count = 0;
  const queue = [root];
  let visited = 0;
  while (queue.length && visited < 10_000) {
    const directory = queue.pop();
    if (!directory) break;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      visited += 1;
      if (entry.isSymbolicLink()) continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) queue.push(path);
      else if (entry.isFile() && entry.name.endsWith(".json") && /^SP-(?:AI-)?\d{8}-/i.test(entry.name)) count += 1;
    }
  }
  return count;
}

async function main() {
  const config = readPdAdminConfig();
  if (!config.enabled) {
    console.info(JSON.stringify({ status: "disabled", findings: 0, message: "PD administration is not active." }));
    return;
  }
  if (!config.searchHmacKey || !config.auditChainKey) {
    console.error("PD integrity check cannot run because protected keys are unavailable.");
    process.exitCode = 1;
    return;
  }
  const findings: Finding[] = [];
  const databaseDirectory = resolve(config.databasePath, "..");
  if (!protectedMode(databaseDirectory, 0o700)) findings.push({ code: "ADMIN_DIRECTORY_MODE", severity: "error" });
  if (existsSync(config.databasePath) && !protectedMode(config.databasePath, 0o600)) {
    findings.push({ code: "DATABASE_FILE_MODE", severity: "error" });
  }
  if (publicJsonCount(resolve(process.cwd(), "public")) > 0) {
    findings.push({ code: "PUBLIC_LEAD_RECORD", severity: "error" });
  }
  if (!config.backupPath || !config.backupEncryptionKeyFile) {
    findings.push({ code: "BACKUP_NOT_CONFIGURED", severity: "warning" });
  }

  let database;
  try {
    database = openPdDatabase({ applyMigrations: false });
    if (migrationStatus(database).some((migration) => migration.state === "pending")) {
      throw new Error("PD schema migration is pending");
    }
    const sqliteResult = database.prepare("PRAGMA integrity_check").get() as { integrity_check?: string } | undefined;
    if (sqliteResult?.integrity_check !== "ok") findings.push({ code: "SQLITE_INTEGRITY", severity: "error" });
    const foreignKeys = database.prepare("PRAGMA foreign_keys").get() as { foreign_keys?: number } | undefined;
    if (foreignKeys?.foreign_keys !== 1) findings.push({ code: "FOREIGN_KEYS_DISABLED", severity: "error" });
    const indexResult = await syncLeadIndex({
      database,
      mode: "dry-run",
      quoteRoot: process.env.QUOTE_STORAGE_PATH || ".data/quote-leads",
      assistantRoot: process.env.ASSISTANT_LEAD_STORAGE_PATH || ".data/assistant-leads",
      consentRoot: process.env.CONSENT_AUDIT_STORAGE_PATH || ".data/consent-audit",
      quarantineRoot: process.env.UPLOAD_QUARANTINE_PATH || ".data/quarantine",
      hmacKey: config.searchHmacKey,
      hmacKeyVersion: config.searchHmacKeyVersion,
    });
    for (const [code, count] of Object.entries(indexResult.findings)) {
      if (count > 0) findings.push({ code, severity: code === "MISSING_CONSENT_AUDIT" ? "warning" : "error" });
    }
    const audit = verifyAccessEventChain(database, config.auditChainKey);
    if (!audit.valid) findings.push({ code: "ACCESS_AUDIT_CHAIN", severity: "error" });
  } catch {
    findings.push({ code: "INTEGRITY_CHECK_FAILED", severity: "error" });
  } finally {
    if (database) closePdDatabase(database, config.databasePath);
  }

  const errors = findings.filter((finding) => finding.severity === "error").length;
  console.info(JSON.stringify({
    status: errors ? "failed" : "completed",
    findings: findings.length,
    errors,
    codes: findings.map((finding) => finding.code),
    databaseBytes: existsSync(config.databasePath) ? statSync(config.databasePath).size : 0,
  }));
  if (errors) process.exitCode = 1;
}

main().catch(() => {
  console.error("PD integrity check failed without exposing records, secrets or protected paths.");
  process.exitCode = 1;
});
