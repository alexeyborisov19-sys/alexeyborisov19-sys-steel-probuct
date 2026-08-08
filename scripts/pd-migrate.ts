import { closePdDatabase, migrationStatus, openPdDatabase } from "@/lib/pd-admin/db/database";
import { readPdAdminConfig } from "@/lib/pd-admin/config";

const statusOnly = process.argv.includes("--status");
const config = readPdAdminConfig();

if (!config.enabled) {
  console.error("PD administration is disabled. Migration was not run.");
  process.exitCode = 1;
} else {
  let database;
  try {
    database = openPdDatabase({ applyMigrations: !statusOnly });
    const statuses = migrationStatus(database);
    console.info(JSON.stringify({
      mode: statusOnly ? "status" : "migrate",
      applied: statuses.filter((status) => status.state === "applied").length,
      pending: statuses.filter((status) => status.state === "pending").length,
      versions: statuses.map((status) => ({ version: status.version, state: status.state })),
    }));
  } catch {
    console.error("PD migration failed. Review protected server logs without printing secrets or records.");
    process.exitCode = 1;
  } finally {
    if (database) closePdDatabase(database, config.databasePath);
  }
}
