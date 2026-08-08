import { verifyAccessEventChain } from "@/lib/pd-admin/audit/chain";
import { readPdAdminConfig } from "@/lib/pd-admin/config";
import { closePdDatabase, openPdDatabase } from "@/lib/pd-admin/db/database";

const config = readPdAdminConfig();
if (!config.enabled) {
  console.info(JSON.stringify({ status: "disabled", valid: null, events: 0 }));
} else if (!config.auditChainKey) {
  console.error("PD audit verification key is not configured.");
  process.exitCode = 1;
} else {
  let database;
  try {
    database = openPdDatabase();
    const result = verifyAccessEventChain(database, config.auditChainKey);
    console.info(JSON.stringify({ valid: result.valid, events: result.events, invalidEvents: result.invalidIds.length }));
    if (!result.valid) process.exitCode = 1;
  } catch {
    console.error("PD audit verification failed without exposing record contents.");
    process.exitCode = 1;
  } finally {
    if (database) closePdDatabase(database, config.databasePath);
  }
}
