"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function CompanyVideo() {
  const [isOpen, setIsOpen] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const closeVideo = useCallback(() => {
    setIsOpen(false);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || typeof window.matchMedia !== "function") return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreviewPlayback = () => {
      if (isOpen || document.visibilityState !== "visible" || motionQuery.matches) {
        video.pause();
        return;
      }

      video.muted = true;
      void video.play().catch(() => undefined);
    };

    syncPreviewPlayback();
    document.addEventListener("visibilitychange", syncPreviewPlayback);
    motionQuery.addEventListener("change", syncPreviewPlayback);
    return () => {
      document.removeEventListener("visibilitychange", syncPreviewPlayback);
      motionQuery.removeEventListener("change", syncPreviewPlayback);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeVideo();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeVideo, isOpen]);

  function openVideo(trigger: HTMLButtonElement) {
    lastTriggerRef.current = trigger;
    setIsOpen(true);
  }

  return <>
    <section id="company-video" className="bg-[#0c1013] py-14 sm:py-16">
      <div className="container grid gap-8 lg:grid-cols-[minmax(0,.64fr)_minmax(0,1fr)] lg:items-center">
        <div className="max-w-xl">
          <p className="eyebrow">Фильм о компании</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">Познакомьтесь со «Сталь Продукт»</h2>
          <p className="mt-5 text-sm leading-relaxed text-white/62 sm:text-base">Видео о команде, инженерной экспертизе и реальном производстве. Показываем, как компания решает задачи клиентов — от идеи до готового изделия.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" onClick={(event) => openVideo(event.currentTarget)} className="clip-corner bg-steel-orange px-6 py-3 text-xs font-bold uppercase transition hover:bg-orange-600">Смотреть фильм&nbsp; →</button>
            <span className="inline-flex items-center border border-white/15 px-4 py-3 text-[11px] uppercase tracking-[.12em] text-white/55">1:59 · 720p HD</span>
          </div>
        </div>

        <button type="button" onClick={(event) => openVideo(event.currentTarget)} className="production-video-frame group text-left" aria-label="Смотреть фильм о компании">
          <video ref={previewVideoRef} className="h-full w-full object-cover" muted loop playsInline preload="metadata" poster="/images/company-video-poster.png">
            <source src="/video/company-film-flat.mp4" type="video/mp4" />
          </video>
          <span className="absolute inset-0 bg-black/10 transition group-hover:bg-black/0" />
          <span className="absolute left-5 top-5 grid h-11 w-11 place-items-center border border-white/35 bg-black/45 text-sm text-steel-orange transition group-hover:border-steel-orange group-hover:bg-black/70">▶</span>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/85 via-black/15 to-transparent px-5 pb-5 pt-16">
            <span className="text-[10px] font-bold uppercase tracking-[.16em] text-white/75">«Сталь Продукт» — о компании</span>
            <span className="text-[10px] font-bold uppercase tracking-[.15em] text-steel-orange">Смотреть</span>
          </span>
        </button>
      </div>
    </section>

    {isOpen ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Фильм о компании">
      <div className="relative w-full max-w-6xl border border-white/15 bg-[#0b0e10] p-2 shadow-[0_28px_100px_rgba(0,0,0,.85)]">
        <button ref={closeButtonRef} type="button" onClick={closeVideo} className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center border border-white/25 bg-black/65 text-xl text-white transition hover:border-steel-orange hover:text-steel-orange" aria-label="Закрыть видео">×</button>
        <video className="aspect-video w-full bg-black" controls autoPlay playsInline preload="metadata" poster="/images/company-video-poster.png">
          <source src="/video/company-film-flat.mp4" type="video/mp4" />
          Ваш браузер не поддерживает видео.
        </video>
      </div>
    </div> : null}
  </>;
}
