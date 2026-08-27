"use client";

import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const staleBuildPattern =
  /ChunkLoadError|Loading chunk|Failed to load chunk|dynamically imported module|CSS_CHUNK_LOAD_FAILED/i;

/** Bypass cached HTML document — location.reload() is not enough after deploys. */
function hardNavigateHome() {
  window.location.replace("/?_sp=" + Date.now());
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("SteelProdukt client error", error);
    const signature = `${error.name} ${error.message}`;
    if (staleBuildPattern.test(signature)) {
      hardNavigateHome();
    }
  }, [error]);

  return (
    <html lang="ru">
      <body className="grid min-h-screen place-items-center bg-[#101112] p-6 text-white">
        <main className="w-full max-w-xl border border-white/15 bg-[#151719] p-8 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-steel-orange">Сталь Продукт</p>
          <h1 className="mt-4 text-3xl font-bold">Загрузка…</h1>
          <p className="mt-4 leading-relaxed text-white/65">
            Открываем актуальную версию сайта.
          </p>
          <button
            className="mt-7 bg-steel-orange px-5 py-3 text-xs font-bold uppercase text-white transition hover:bg-orange-600"
            type="button"
            onClick={hardNavigateHome}
          >
            Открыть сайт
          </button>
        </main>
      </body>
    </html>
  );
}
