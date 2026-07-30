"use client";

import { lazy, Suspense, useState } from "react";

const loadAssistant = () => import("./EngineeringAssistant");
const LazyEngineeringAssistant = lazy(async () => {
  const assistantModule = await loadAssistant();
  return { default: assistantModule.EngineeringAssistant };
});

function BrandMark() {
  return (
    <span className="relative block h-9 w-[58px] shrink-0" aria-hidden="true">
      <img
        src="/logo/steel-product-mark.png"
        alt=""
        width={740}
        height={402}
        loading="lazy"
        decoding="async"
        className="absolute left-0 top-1/2 h-[30px] w-[55px] -translate-y-1/2 object-contain drop-shadow-[0_0_7px_rgba(234,91,12,.22)]"
      />
    </span>
  );
}

function LauncherButton({ loading = false, onClick }: { loading?: boolean; onClick?: () => void }) {
  return (
    <div className="fixed bottom-5 right-4 z-[85] sm:bottom-6 sm:right-6">
      <button
        type="button"
        onClick={onClick}
        onPointerEnter={() => { void loadAssistant(); }}
        onFocus={() => { void loadAssistant(); }}
        className="assistant-launcher group flex h-[58px] items-center gap-3 border border-steel-orange/65 bg-[#111519] pl-3 pr-4 shadow-[0_14px_50px_rgba(0,0,0,.58),0_0_26px_rgba(234,91,12,.16)] transition hover:scale-[1.025]"
        aria-label="Открыть инженерного помощника"
        aria-busy={loading}
      >
        <BrandMark />
        <span className="min-w-[142px] whitespace-nowrap text-left">
          <b className="block text-[10px] leading-none uppercase tracking-[.1em] text-white">ИИ-инженер</b>
          <span className="mt-1 block text-[9px] leading-none text-white/45">
            {loading ? "Загружаем помощника…" : "Задать технический вопрос"}
          </span>
        </span>
      </button>
    </div>
  );
}

export function EngineeringAssistantLauncher() {
  const [activated, setActivated] = useState(false);
  if (!activated) return <LauncherButton onClick={() => setActivated(true)} />;
  return (
    <Suspense fallback={<LauncherButton loading />}>
      <LazyEngineeringAssistant initialOpen />
    </Suspense>
  );
}
