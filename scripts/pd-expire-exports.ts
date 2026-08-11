import { expireExportArchivesAsSystem } from "@/lib/pd-admin/export/service";
import { readPdAdminConfig } from "@/lib/pd-admin/config";
import { closePdDatabase, migrationStatus, openPdDatabase } from "@/lib/pd-admin/db/database";

const argumentsList = new Set(process.argv.slice(2));
const unknownArguments = [...argumentsList].filter((argument) => !["--dry-run", "--apply"].includes(argument));
if (unknownArguments.length || (argumentsList.has("--dry-run") && argumentsList.has("--apply"))) {
  console.error("Использование: npm run pd:exports:expire -- [--dry-run|--apply]");
  process.exit(2);
}
const mode = argumentsList.has("--apply") ? "apply" : "dry-run";
const config = readPdAdminConfig();
if (!config.enabled) {
  console.info(JSON.stringify({ status: "disabled", mode, examined: 0, eligible: 0, deleted: 0, failed: 0 }));
} else if (!config.auditChainKey) {
  console.error("PD export expiry audit configuration is unavailable."); process.exitCode = 1;
} else {
  let database;
  try {
    database = openPdDatabase({ applyMigrations: false });
    if (migrationStatus(database).some((migration) => migration.state === "pending")) throw new Error("PD schema migration is pending");
    console.info(JSON.stringify({ status: "completed", ...expireExportArchivesAsSystem(database, config.exportPath, config.auditChainKey, { mode }) }));
  } catch {
    console.error("PD export expiry failed without exposing protected paths or record contents."); process.exitCode = 1;
  } finally { if (database) closePdDatabase(database, config.databasePath); }
}
