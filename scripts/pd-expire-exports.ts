import { expireExportArchivesAsSystem } from "@/lib/pd-admin/export/service";
import { readPdAdminConfig } from "@/lib/pd-admin/config";
import { closePdDatabase, migrationStatus, openPdDatabase } from "@/lib/pd-admin/db/database";

const config = readPdAdminConfig();
if (!config.enabled) {
  console.info(JSON.stringify({ status: "disabled", examined: 0, deleted: 0 }));
} else if (!config.auditChainKey) {
  console.error("PD export expiry audit configuration is unavailable."); process.exitCode = 1;
} else {
  let database;
  try {
    database = openPdDatabase({ applyMigrations: false });
    if (migrationStatus(database).some((migration) => migration.state === "pending")) throw new Error("PD schema migration is pending");
    console.info(JSON.stringify({ status: "completed", ...expireExportArchivesAsSystem(database, config.exportPath, config.auditChainKey) }));
  } catch {
    console.error("PD export expiry failed without exposing protected paths or record contents."); process.exitCode = 1;
  } finally { if (database) closePdDatabase(database, config.databasePath); }
}
