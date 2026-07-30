import Link from "next/link";

export function Hero() {
  return <section className="relative isolate min-h-[610px] overflow-hidden bg-steel-black pt-[72px]">
    <img src="/images/web/hero-main.webp" width={1280} height={720} alt="" aria-hidden="true" fetchPriority="high" loading="eager" decoding="async" className="absolute inset-0 h-full w-full object-cover object-center" />
    <div className="hero-surface absolute inset-0" aria-hidden="true" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_50%,rgba(234,91,12,.23),transparent_31%)]" aria-hidden="true" />
    <div className="container relative z-10 grid min-h-[538px] items-end pb-12 pt-16 lg:grid-cols-[1fr_auto] lg:pb-14">
      <div className="max-w-3xl">
        <h1 className="max-w-3xl text-4xl font-semibold uppercase leading-[1.04] tracking-[-.035em] sm:text-5xl lg:text-6xl">Инженерные решения<br /><span className="text-steel-orange">из листового металла</span></h1>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/72 sm:text-base">Проектируем, производим и поставляем решения для строительства, промышленности и коммерческих объектов.</p>
        <div className="mt-7 flex flex-wrap gap-3"><Link className="clip-corner bg-steel-orange px-6 py-3 text-xs font-bold uppercase transition hover:bg-orange-600" href="/contacts#contact-form">Получить расчет&nbsp; →</Link><Link className="clip-corner border border-white/45 px-6 py-3 text-xs font-bold uppercase transition hover:border-steel-orange hover:text-steel-orange" href="/production#production-video">◉&nbsp; Смотреть производство</Link></div>
        <p className="mt-5 text-[11px] text-white/60">♢&nbsp; Работаем со строительными и производственными задачами · PDF-каталог и первичная консультация — без регистрации</p>
      </div>
      <div className="mt-12 grid grid-cols-2 border border-white/20 bg-black/30 backdrop-blur-sm lg:mt-0">
        {[['2000+','м² производства'],['70+','специалистов'],['3','лазерных комплекса'],['4','листогибочных комплекса']].map(([value,label]) => <div key={label} className="min-w-[150px] border border-white/10 p-5"><b className="block text-3xl text-steel-orange">{value}</b><span className="mt-1 block text-xs uppercase tracking-wider text-white/65">{label}</span></div>)}
      </div>
    </div>
  </section>;
}
