import { readPdAdminConfig } from "@/lib/pd-admin/config";
import { closePdDatabase, migrationStatus, openPdDatabase } from "@/lib/pd-admin/db/database";
import { syncLeadIndex, type LeadIndexMode } from "@/lib/pd-admin/indexing/lead-index";

function argumentValue(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const modeArgument = argumentValue("--mode") ?? (process.argv.includes("--dry-run") ? "dry-run" : "incremental");
  const allowedModes = new Set<LeadIndexMode>(["full", "incremental", "dry-run", "specific"]);
  if (!allowedModes.has(modeArgument as LeadIndexMode)) {
    console.error("Invalid sync mode. Use full, incremental, dry-run or specific.");
    process.exitCode = 1;
    return;
  }
  const mode = modeArgument as LeadIndexMode;
  const requestId = argumentValue("--request-id");
  const config = readPdAdminConfig();
  if (!config.enabled || !config.searchHmacKey) {
    console.error("PD administration or contact indexing is not configured.");
    process.exitCode = 1;
    return;
  }
  let database;
  try {
    database = openPdDatabase({ applyMigrations: false });
    if (migrationStatus(database).some((migration) => migration.state === "pending")) {
      throw new Error("PD schema migration is pending");
    }
    const result = await syncLeadIndex({
      database,
      mode,
      requestId,
      quoteRoot: process.env.QUOTE_STORAGE_PATH || ".data/quote-leads",
      assistantRoot: process.env.ASSISTANT_LEAD_STORAGE_PATH || ".data/assistant-leads",
      consentRoot: process.env.CONSENT_AUDIT_STORAGE_PATH || ".data/consent-audit",
      quarantineRoot: process.env.UPLOAD_QUARANTINE_PATH || ".data/quarantine",
      hmacKey: config.searchHmacKey,
      hmacKeyVersion: config.searchHmacKeyVersion,
    });
    console.info(JSON.stringify(result));
  } catch {
    console.error("PD index synchronization failed without exposing lead contents or paths.");
    process.exitCode = 1;
  } finally {
    if (database) closePdDatabase(database, config.databasePath);
  }
}

main().catch(() => {
  console.error("PD index synchronization failed without exposing lead contents or paths.");
  process.exitCode = 1;
});
