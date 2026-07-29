"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function ProductionShowreel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

  const startVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      video.muted = true;
      await video.play();
      setIsPlaying(true);
      setHasError(false);
    } catch {
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    void startVideo();

    const resumeWhenVisible = () => {
      if (document.visibilityState === "visible") void startVideo();
    };

    document.addEventListener("visibilitychange", resumeWhenVisible);
    return () => document.removeEventListener("visibilitychange", resumeWhenVisible);
  }, [startVideo]);

  return <section id="production-video" className="bg-[#0c1013] py-14 sm:py-16">
    <div className="container grid gap-8 lg:grid-cols-[minmax(0,.64fr)_minmax(0,1fr)] lg:items-center">
      <div className="max-w-xl">
        <p className="eyebrow">Технологический процесс</p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">Операции, из которых складывается качество</h2>
        <p className="mt-5 text-sm leading-relaxed text-white/62 sm:text-base">Короткая нарезка из реального производства: фирменное вступление, гибка металла, лазерная резка и сборочные операции.</p>
        <div className="mt-7 flex flex-wrap gap-3 text-[11px] font-bold uppercase tracking-[.12em] text-white/60">
          <span className="border border-white/15 px-4 py-3">Гибка</span>
          <span className="border border-white/15 px-4 py-3">Лазерная резка</span>
          <span className="border border-white/15 px-4 py-3">Сборка</span>
        </div>
      </div>

      <div className="production-video-frame">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/images/production-showreel-poster.png"
          onCanPlay={() => void startVideo()}
          onPlaying={() => {
            setIsPlaying(true);
            setHasError(false);
          }}
          onPause={() => setIsPlaying(false)}
          onError={() => {
            setIsPlaying(false);
            setHasError(true);
          }}
        >
          <source src="/video/production-showreel-web.mp4" type="video/mp4" />
          Ваш браузер не поддерживает видео.
        </video>
        {!isPlaying ? <button
          type="button"
          onClick={() => void startVideo()}
          className="absolute inset-0 z-10 grid place-items-center bg-black/25 transition hover:bg-black/15"
          aria-label="Запустить видео производства"
        >
          <span className="grid h-16 w-16 place-items-center border border-steel-orange/75 bg-black/70 text-xl text-steel-orange shadow-[0_0_36px_rgba(231,78,24,.28)] transition hover:scale-105 hover:bg-black/85">
            ▶
          </span>
          <span className="sr-only">{hasError ? "Повторить загрузку видео" : "Запустить видео"}</span>
        </button> : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 via-black/15 to-transparent px-5 pb-5 pt-16">
          <span className="text-[10px] font-bold uppercase tracking-[.16em] text-white/75">Производство «Сталь Продукт»</span>
          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-steel-orange"><i className="h-2 w-2 animate-pulse rounded-full bg-steel-orange" />11 секунд</span>
        </div>
      </div>
    </div>
  </section>;
}
