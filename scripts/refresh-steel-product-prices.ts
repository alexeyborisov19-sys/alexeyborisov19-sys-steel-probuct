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
      // One rule for every failure here: name it. The operator reads this
      // either from the installer's dry run or from the server journal, and
      // nothing in it reaches a customer.
      console.error(`Supplier price refresh is not runnable here: ${describeFailure(error)}`);
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
    // Never dump the upstream page, parser internals or private storage paths —
    // but do name the failure. Every cause used to print the same one sentence:
    // an unreachable supplier, a price list whose layout changed, an unreadable
    // basis. The commit run was kept silent on the reasoning that nobody reads
    // its output when it fails, and that was wrong — it goes to the server
    // journal, and the timer installer prints the last lines of it. Silence hid
    // the one thing the operator needs and protected nobody: this never reaches
    // a customer, and paths are stripped from the message either way.
    console.error(`Supplier price refresh failed: ${describeFailure(error)}`);
    if (commit) return 1;

    // The refresh stops finding rows when the supplier changes the layout of
    // its price list, and the count of rows it did not find cannot say which
    // part changed. The shape of the document can, and carries no prices —
    // every digit in the samples is replaced by 9.
    await loaded.inspectAtlantikSource().then(
      (shape) => console.error(`Source shape: ${JSON.stringify(shape, null, 2)}`),
      (inspectError: unknown) => console.error(`Source shape unavailable: ${describeFailure(inspectError)}`),
    );
    return 1;
  }
}

main().then(
  (code) => { process.exitCode = code; },
  (error: unknown) => {
    // Anything thrown outside main's own try, and just as much in need of a
    // reason: this is what the server journal shows when the timer unit fails.
    console.error(`Supplier price refresh failed: ${describeFailure(error)}`);
    process.exitCode = 1;
  },
);
