"use client";

import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const staleBuildPattern =
  /ChunkLoadError|Loading chunk|Failed to load chunk|dynamically imported module|CSS_CHUNK_LOAD_FAILED/i;

/**
 * A recovery navigation that fails the same way must not trigger another one:
 * that turns a single missing chunk into an endless reload loop with no way out
 * for the visitor. Allow one automatic attempt, then fall back to the UI below.
 * The stamp expires so a later deploy in a long-lived tab can still self-heal.
 */
const recoveryStampKey = "steelprodukt:stale-build-recovery";
const recoveryWindowMs = 60_000;

function canAutoRecover() {
  try {
    const lastAttempt = Number(window.sessionStorage.getItem(recoveryStampKey));
    return !Number.isFinite(lastAttempt) || Date.now() - lastAttempt > recoveryWindowMs;
  } catch {
    // Storage can throw in restricted browser modes. Without a usable stamp there
    // is no loop guard, so never start an automatic navigation we cannot stop.
    return false;
  }
}

function markAutoRecovery() {
  try {
    window.sessionStorage.setItem(recoveryStampKey, String(Date.now()));
  } catch {
    // canAutoRecover() already refuses to retry when storage is unavailable.
  }
}

/** Bypass cached HTML — location.reload() re-serves the same cached document. */
function hardNavigate(path: string) {
  const target = new URL(path, window.location.origin);
  target.searchParams.set("_sp", String(Date.now()));
  window.location.replace(target.toString());
}

/** Manual escape hatch to a page that is always published. */
function hardNavigateHome() {
  hardNavigate("/");
}

/** Recovery keeps the visitor on the page they actually asked for. */
function hardReloadCurrent() {
  hardNavigate(window.location.pathname);
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("SteelProdukt client error", error);
    const signature = `${error.name} ${error.message}`;
    if (staleBuildPattern.test(signature) && canAutoRecover()) {
      markAutoRecovery();
      hardReloadCurrent();
    }
  }, [error]);

  return (
    <html lang="ru">
      <body className="grid min-h-screen place-items-center bg-[#101112] p-6 text-white">
        <main className="w-full max-w-xl border border-white/15 bg-[#151719] p-8 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-steel-orange">Сталь Продукт</p>
          <h1 className="mt-4 text-3xl font-bold">Страница не загрузилась</h1>
          <p className="mt-4 leading-relaxed text-white/65">
            Откройте страницу заново или перейдите на главную.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              className="bg-steel-orange-deep px-5 py-3 text-xs font-bold uppercase text-white transition hover:bg-steel-orange-deeper"
              type="button"
              onClick={hardReloadCurrent}
            >
              Обновить страницу
            </button>
            <button
              className="border border-white/25 px-5 py-3 text-xs font-bold uppercase text-white transition hover:border-white/50"
              type="button"
              onClick={hardNavigateHome}
            >
              На главную
            </button>
            <button
              className="border border-white/25 px-5 py-3 text-xs font-bold uppercase text-white transition hover:border-white/50"
              type="button"
              onClick={() => reset()}
            >
              Повторить
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
