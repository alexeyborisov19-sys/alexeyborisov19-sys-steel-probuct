export type MetrikaCommand = ((id: number, command: string, ...args: unknown[]) => void) & { a?: unknown[]; l?: number };
export type MetrikaRuntime = { ym?: MetrikaCommand; steelPendingGoals?: unknown[]; dataLayer?: unknown[] };

// Official teardown API: https://yandex.ru/support/metrica/ru/code/counter-spa-setup
export function createMetrikaLifecycle(counterIds: readonly number[], options: Record<string, unknown>) {
  let initialized = false;

  function stop(runtime: MetrikaRuntime) {
    runtime.steelPendingGoals = [];
    if (Array.isArray(runtime.dataLayer)) runtime.dataLayer.length = 0;
    // A downloaded tag must never replay commands queued before revocation.
    if (Array.isArray(runtime.ym?.a)) runtime.ym.a.length = 0;
    if (!initialized) return;
    initialized = false;
    for (const id of counterIds) {
      try { runtime.ym?.(id, "destruct"); } catch { /* Optional vendor failures cannot prevent refusal. */ }
    }
  }

  function start(runtime: MetrikaRuntime, permitted: boolean) {
    if (!permitted) {
      stop(runtime);
      return false;
    }
    if (!counterIds.length || typeof runtime.ym !== "function") return false;
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
