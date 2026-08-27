"use client";

import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const staleBuildPattern =
  /ChunkLoadError|Loading chunk|Failed to load chunk|dynamically imported module|CSS_CHUNK_LOAD_FAILED/i;
const staleBuildReloadKey = "steelprodukt:stale-build-reload";
const staleBuildReloadCooldownMs = 15_000;

/** Full navigation that bypasses the cached document (unlike location.reload). */
function hardNavigateFresh() {
  const url = new URL(window.location.href);
  url.searchParams.set("_sp", String(Date.now()));
  window.location.replace(url.pathname + url.search + url.hash);
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("SteelProdukt client error", error);

    const signature = `${error.name} ${error.message}`;
    const isStaleBuild = staleBuildPattern.test(signature);

    if (!isStaleBuild) return;

    try {
      const lastReloadAt = Number(window.sessionStorage.getItem(staleBuildReloadKey) ?? "0");
      const now = Date.now();
      if (Number.isFinite(lastReloadAt) && now - lastReloadAt < staleBuildReloadCooldownMs) {
        // Already tried a hard refresh recently — fall through to the UI button.
        return;
      }
      window.sessionStorage.setItem(staleBuildReloadKey, String(now));
    } catch {
      // sessionStorage may be unavailable; still attempt a hard navigation.
    }

    hardNavigateFresh();
  }, [error]);

  return (
    <html lang="ru">
      <body className="grid min-h-screen place-items-center bg-[#101112] p-6 text-white">
        <main className="w-full max-w-xl border border-white/15 bg-[#151719] p-8 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-steel-orange">Сталь Продукт</p>
          <h1 className="mt-4 text-3xl font-bold">Не удалось загрузить страницу</h1>
          <p className="mt-4 leading-relaxed text-white/65">
            Попробуйте обновить страницу. Если сообщение повторяется — откройте сайт заново или очистите кэш
            браузера для steelprodukt.ru.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              className="bg-steel-orange px-5 py-3 text-xs font-bold uppercase text-white transition hover:bg-orange-600"
              type="button"
              onClick={hardNavigateFresh}
            >
              Обновить
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
