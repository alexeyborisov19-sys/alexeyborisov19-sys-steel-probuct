import { dirname, join } from "node:path";
import { renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { readPdAdminConfig } from "@/lib/pd-admin/config";
import { closePdDatabase, migrationStatus, openPdDatabase } from "@/lib/pd-admin/db/database";
import { syncLeadIndex } from "@/lib/pd-admin/indexing/lead-index";
import { recordAccessEvent } from "@/lib/pd-admin/audit/chain";

async function main() {
  const config = readPdAdminConfig();
  if (!config.enabled || !config.searchHmacKey || !config.auditChainKey) throw new Error("Configuration unavailable");
  const database = openPdDatabase({ applyMigrations: false });
  try {
    if (migrationStatus(database).some((row) => row.state === "pending")) throw new Error("Migration pending");
    const sync = await syncLeadIndex({
      database, mode: "incremental", hmacKey: config.searchHmacKey, hmacKeyVersion: config.searchHmacKeyVersion,
      quoteRoot: process.env.QUOTE_STORAGE_PATH || ".data/quote-leads",
      assistantRoot: process.env.ASSISTANT_LEAD_STORAGE_PATH || ".data/assistant-leads",
      consentRoot: process.env.CONSENT_AUDIT_STORAGE_PATH || ".data/consent-audit",
      quarantineRoot: process.env.UPLOAD_QUARANTINE_PATH || ".data/quarantine",
    });
    const now = new Date();
    const count = (end: Date) => Number((database.prepare("SELECT COUNT(*) AS n FROM lead_index WHERE deleted_at IS NULL AND expires_at <= ?").get(end.toISOString()) as { n: number }).n);
    const expired = count(now);
    const integrityFindings = Object.values(sync.findings).reduce((total, value) => total + value, 0);
    const report = { checkedAt: now.toISOString(), examined: sync.examined, indexed: sync.indexed,
      expired, expiresWithin7Days: count(new Date(now.getTime() + 7 * 86_400_000)) - expired,
      findings: sync.findings, deletionPerformed: false, status: expired ? "REVIEW_REQUIRED" : integrityFindings ? "INTEGRITY_REVIEW_REQUIRED" : "NO_EXPIRED_LEADS" };
    recordAccessEvent(database, { action: "RETENTION_DAILY_CHECK", targetType: "SYSTEM", result: report.status,
      legalBasis: "RETENTION_CONTROL", ipHash: "SYSTEM", metadata: { count: expired, items: sync.examined, status: report.status } }, config.auditChainKey);
    const target = join(dirname(config.databasePath), "retention-monitor.json");
    const temporary = target + "." + randomUUID();
    writeFileSync(temporary, JSON.stringify(report, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    renameSync(temporary, target);
    console.info(JSON.stringify(report));
    // An expired item needs actual review; do not silently report a healthy timer.
    if (expired || integrityFindings) process.exitCode = 2;
  } finally { closePdDatabase(database, config.databasePath); }
}

main().catch(() => { console.error("PD retention check failed; inspect protected configuration."); process.exitCode = 1; });
