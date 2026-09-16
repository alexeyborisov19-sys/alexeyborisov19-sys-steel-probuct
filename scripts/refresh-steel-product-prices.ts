/**
 * Supplier price refresh for the systemd timer.
 *
 * It calls the refresh directly instead of posting to the application's own
 * loopback endpoint. That removes a shared secret which existed only so the
 * server could authenticate itself to itself, and it makes the refresh work
 * whether or not the site happens to be up.
 *
 * Reading stays safe alongside the running app: the snapshot is written to a
 * temporary file and renamed into place, and the app re-reads the basis from
 * disk on every calculation rather than caching it.
 *
 * Run with the react-server condition so the server-only guards resolve:
 *   node --conditions react-server --import tsx scripts/refresh-steel-product-prices.ts --commit
 */
const args = new Set(process.argv.slice(2));
const allowed = new Set(["--commit", "--dry-run"]);
for (const arg of args) {
  if (!allowed.has(arg)) {
    console.error(`Unknown argument: ${arg}`);
    process.exit(2);
  }
}
if (args.has("--commit") && args.has("--dry-run")) {
  console.error("Choose either --commit or --dry-run, not both.");
  process.exit(2);
}

const commit = args.has("--commit");

let refreshAtlantikPriceSnapshot: typeof import("@/lib/server/instant-quote/refresh-atlantik-prices").refreshAtlantikPriceSnapshot;
try {
  ({ refreshAtlantikPriceSnapshot } = await import("@/lib/server/instant-quote/refresh-atlantik-prices"));
} catch (error) {
  // Keep failure output generic: it must not disclose private paths.
  console.error(`Supplier price refresh is not runnable in this environment: ${error instanceof Error ? error.name : "unknown error"}`);
  process.exit(2);
}

try {
  const result = await refreshAtlantikPriceSnapshot(new Date(), { persist: commit });
  console.log(JSON.stringify({
    ok: true,
    mode: commit ? "commit" : "dry-run",
    sourceId: result.sourceId,
    sourceDate: result.sourceDate,
    fetchedAt: result.fetchedAt,
    rowCount: result.rowCount,
    materialCounts: result.materialCounts,
    contentChanged: result.contentChanged,
    persisted: result.persisted,
  }));
} catch {
  // Never dump the upstream page, parser internals or private storage paths.
  console.error("Supplier price refresh failed.");
  process.exit(1);
}
