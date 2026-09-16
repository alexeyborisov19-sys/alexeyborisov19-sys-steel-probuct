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
 *   node --conditions react-server --import tsx \
 *        --import ./scripts/repo-alias-hook.mjs \
 *        scripts/refresh-steel-product-prices.ts --commit
 *
 * The alias hook resolves the project's "@/..." imports, which Next normally
 * resolves from tsconfig and a plain node process does not know about.
 *
 * The work sits in main() rather than at the top level on purpose: the project
 * declares no module type, so tsx transpiles this to CommonJS, where top-level
 * await does not exist.
 */

/**
 * Error name, message and immediate cause, with absolute filesystem paths and
 * URLs removed. Node reports a failed fetch as a bare "fetch failed" and keeps
 * the real reason on the cause, so the cause is the part worth having.
 */
function describeFailure(error: unknown) {
  const redact = (value: string) => value.replace(/(?:\/[\w.@~-]+){2,}/g, "<path>").slice(0, 300);
  if (!(error instanceof Error)) return redact(String(error));
  const cause = error.cause instanceof Error ? ` (${error.cause.name}: ${error.cause.message})` : "";
  return redact(`${error.name}: ${error.message}${cause}`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const allowed = new Set(["--commit", "--dry-run"]);
  for (const arg of args) {
    if (!allowed.has(String(arg))) {
      console.error(`Unknown argument: ${String(arg)}`);
      return 2;
    }
  }
  if (args.has("--commit") && args.has("--dry-run")) {
    console.error("Choose either --commit or --dry-run, not both.");
    return 2;
  }

  const commit = args.has("--commit");

  // Loaded dynamically so an environment that cannot resolve the server
  // modules reports that plainly instead of failing at parse time.
  const loaded = await import("@/lib/server/instant-quote/refresh-atlantik-prices")
    .catch((error: unknown) => {
      // A dry run is the diagnostic mode: it writes nothing and is run by an
      // operator who needs to see why. A commit run stays terse, because its
      // output is not being read by anyone who can act on it.
      console.error(commit
        ? `Supplier price refresh is not runnable here: ${error instanceof Error ? error.name : "unknown error"}`
        : `Supplier price refresh is not runnable here: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
      return null;
    });
  if (loaded == null) return 2;

  try {
    const result = await loaded.refreshAtlantikPriceSnapshot(new Date(), { persist: commit });
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
    return 0;
  } catch (error) {
    // Never dump the upstream page, parser internals or private storage paths.
    // A dry run is the diagnostic mode, though: it writes nothing and is read
    // by the operator installing the timer, so it names what failed. Before
    // this every cause — an unreachable supplier, a price list whose layout
    // changed, an unreadable basis — printed the same one sentence, and the
    // dry run could not do the one thing it exists for.
    console.error(commit
      ? "Supplier price refresh failed."
      : `Supplier price refresh failed: ${describeFailure(error)}`);
    return 1;
  }
}

main().then(
  (code) => { process.exitCode = code; },
  () => {
    console.error("Supplier price refresh failed.");
    process.exitCode = 1;
  },
);
