import Image from "next/image";
import Link from "next/link";
import { productionEquipment } from "@/data/manufacturing-facts";
import { heroOffset } from "@/data/site-mode";

export function Hero() {
  return <section className={`relative isolate overflow-hidden bg-steel-black ${heroOffset}`}>
    <Image
      src="/images/web/hero-main.webp"
      alt=""
      aria-hidden="true"
      fill
      priority
      sizes="100vw"
      className="object-cover object-center"
    />
    <div className="hero-surface absolute inset-0" aria-hidden="true" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_50%,rgba(234,91,12,.23),transparent_31%)]" aria-hidden="true" />
    <div className="container relative z-10 grid min-h-[538px] items-end pb-12 pt-16 lg:grid-cols-[1fr_auto] lg:pb-14">
      <div className="max-w-3xl">
        <p className="mb-4 text-xs font-bold uppercase tracking-[.18em] text-steel-orange">Производство полного цикла · Смоленск</p>
        <h1 className="max-w-3xl text-4xl font-semibold uppercase leading-[1.04] tracking-[-.035em] sm:text-5xl lg:text-6xl">Инженерные решения<br /><span className="text-steel-orange">из листового металла</span></h1>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/72 sm:text-base">От инженерно-конструкторской подготовки и КД до готовой промаркированной партии: раскрой, гибка, сварка, сборка, подготовка поверхности, окраска, контроль и упаковка в одном производственном маршруте.</p>
        <div className="mt-7 flex flex-wrap gap-3"><Link className="clip-corner bg-steel-orange-deep px-6 py-3 text-[13px] font-bold uppercase transition hover:bg-steel-orange-deeper" href="/contacts#contact-form">Получить расчёт&nbsp; →</Link><Link className="clip-corner border border-white/45 px-6 py-3 text-[13px] font-bold uppercase transition hover:border-steel-orange hover:text-steel-orange" href="/production#production-video">◉&nbsp; Смотреть производство</Link></div>
        <p className="mt-5 text-xs leading-5 text-white/60">♢&nbsp; Принимаем PDF, DXF, DWG и STEP · Работаем с давальческим материалом после входного контроля</p>
      </div>
      <div className="mt-12 grid grid-cols-2 border border-white/20 bg-black/30 backdrop-blur-sm lg:mt-0">
        {[['2000+','м² производства'],['70+','специалистов'],[productionEquipment.laserComplexes,'лазерных комплекса'],[productionEquipment.pressBrakes,'листогибочных комплекса']].map(([value,label]) => <div key={label} className="min-w-[150px] border border-white/10 p-5"><b className="block text-2xl text-steel-orange sm:text-3xl">{value}</b><span className="mt-1 block text-xs uppercase tracking-wider text-white/65">{label}</span></div>)}
      </div>
    </div>
  </section>;
}
