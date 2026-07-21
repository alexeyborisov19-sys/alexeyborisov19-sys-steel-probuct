export function ProductionShowreel() {
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
        <video className="h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" poster="/images/production-showreel-poster.png">
          <source src="/video/production-showreel-web.mp4" type="video/mp4" />
        </video>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 via-black/15 to-transparent px-5 pb-5 pt-16">
          <span className="text-[10px] font-bold uppercase tracking-[.16em] text-white/75">Производство «Сталь Продукт»</span>
          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-steel-orange"><i className="h-2 w-2 animate-pulse rounded-full bg-steel-orange" />11 секунд</span>
        </div>
      </div>
    </div>
  </section>;
}
