export type MetrikaCommand = ((id: number, command: string, ...args: unknown[]) => void) & { a?: unknown[] };
export type MetrikaRuntime = { ym?: MetrikaCommand; steelPendingGoals?: unknown[] };

/** Controls only the configured site's counters, not the visitor's other data.
 * Official API: https://yandex.ru/support/metrica/ru/code/counter-spa-setup */
export function createMetrikaLifecycle(counterIds: readonly number[], options: Record<string, unknown>) {
  let initialized = false;

  function stop(runtime: MetrikaRuntime) {
    runtime.steelPendingGoals = [];
    if (!initialized) return;
    initialized = false;
    // The bootstrap queue can still contain init/hit/goal commands while tag.js
    // is downloading. Do not replay those commands after a withdrawn consent.
    if (Array.isArray(runtime.ym?.a)) runtime.ym.a.length = 0;
    for (const id of counterIds) {
      try { runtime.ym?.(id, "destruct"); } catch { /* A vendor failure cannot prevent opt-out. */ }
    }
  }

  function start(runtime: MetrikaRuntime, permitted: boolean) {
    if (!permitted) {
      stop(runtime);
      return false;
    }
    if (!counterIds.length || !runtime.ym) return false;
    if (initialized) return true;
    initialized = true;
    try {
      for (const id of counterIds) runtime.ym(id, "init", options);
      return true;
    } catch {
      stop(runtime);
      return false;
    }
  }

  return { start, stop };
}
