import Link from "next/link";
import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { JsonLd } from "@/components/JsonLd";
import { ProductionCycle } from "@/components/ProductionCycle";
import { semanticKeywords } from "@/data/semantic";
import { solutions } from "@/data/solutions";
import { webPageSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Инженерные решения из листового металла",
  description: "Проектируем, производим и поставляем инженерные решения из листового металла для строительства, промышленности и коммерческих объектов по всей России.",
  path: "/",
  keywords: [...semanticKeywords.core, ...semanticKeywords.production.slice(0, 3)],
});

const cycle = [
  ["Проектирование", "design.png"],
  ["Раскрой металла", "laser-cutting.png"],
  ["Гибка", "bending.png"],
  ["Сварка и сборка", "welding.png"],
  ["Порошковая окраска", "powder-coating.png"],
  ["Контроль качества", "quality-control.png"],
  ["Упаковка и доставка", "packaging-shipping.png"],
] as const;
const benefits = [
  ["Современное производство", "Высокоточное оборудование ведущих мировых брендов"],
  ["Инженерный подход", "Решаем нестандартные задачи и предлагаем оптимальные решения"],
  ["Контроль качества", "Многоступенчатая проверка на всех этапах производства"],
  ["Соблюдение сроков", "Точное планирование и выполнение обязательств"],
  ["Под ключ", "От проектирования до поставки готовой продукции"],
];
const projects = ["ЖК «Серебряный бор»", "БЦ «NEO GEO»", "ТЦ «Города»", "ЖК «Level Причальный»", "БЦ «DM Tower»"];

export default function Home() {
  return <><JsonLd data={webPageSchema({ name: "Сталь Продукт — инженерные решения из листового металла", description: "Проектирование, производство и поставка изделий из листового металла для строительства, промышленности и инженерной инфраструктуры.", path: "/" })} /><Header /><main><Hero />
    <section id="solutions" className="bg-[#0c1013] py-14"><div className="container"><h2 className="text-center text-2xl font-semibold uppercase tracking-wide sm:text-3xl">Решения для ваших задач</h2><div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{solutions.map((solution) => <Link key={solution.title} href={solution.href} className="group min-h-[250px] border border-white/15 bg-[#111519] p-5 transition hover:border-steel-orange hover:bg-[#15191c]"><div className={`solution-media -mx-5 -mt-5 mb-5 h-28 border-x-0 border-t-0 ${solution.imageClassName ?? ""}`} style={{ backgroundImage: `url('${solution.image}')` }} /><p className="text-lg text-steel-orange">{solution.icon}</p><h3 className="mt-3 text-sm font-bold uppercase leading-tight">{solution.shortTitle}</h3><p className="mt-3 text-[11px] leading-relaxed text-white/55">{solution.text}</p><span className="mt-5 block text-[10px] font-bold uppercase text-steel-orange">Перейти к решениям&nbsp; →</span></Link>)}</div></div></section>
    <section id="production" className="border-y border-white/10 bg-[#101112] py-12"><div className="container"><h2 className="text-center text-2xl font-semibold uppercase">Полный цикл изготовления</h2><div className="mt-8 grid gap-px overflow-hidden border border-white/10 bg-white/10"><ProductionCycle stages={cycle} /></div></div></section>
    <section className="bg-[#0c1013] py-14"><div className="container"><h2 className="text-center text-2xl font-semibold uppercase">Почему выбирают «Сталь Продукт»</h2><div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{benefits.map(([title,text], index) => <article key={title} className="border border-white/10 bg-[#111519] p-5"><span className="text-2xl text-steel-orange">{String(index + 1).padStart(2,"0")}</span><h3 className="mt-5 text-xs font-bold uppercase">{title}</h3><p className="mt-3 text-[11px] leading-relaxed text-white/55">{text}</p></article>)}</div></div></section>
    <section id="projects" className="border-y border-white/10 bg-[#101112] py-12"><div className="container"><div className="flex items-center justify-between gap-6"><h2 className="text-2xl font-semibold uppercase">Реализованные проекты</h2><Link href="/projects" className="text-xs font-bold uppercase text-steel-orange">Смотреть все проекты&nbsp; →</Link></div><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{projects.map((project,index) => <Link href="/projects" key={project} className="overflow-hidden border border-white/10 bg-[#111519] transition hover:border-steel-orange"><div className="solution-media h-28" style={{ backgroundImage: `url('${index % 2 ? "/images/industry/hero-building-v1.png" : "/images/industry/project-residential-v1.png"}')`, backgroundPosition: `${15 + index * 20}% 42%` }} /><div className="p-4"><h3 className="text-xs font-bold">{project}</h3><p className="mt-1 text-[10px] text-white/50">Москва</p><span className="mt-4 block text-xs text-steel-orange">→</span></div></Link>)}</div></div></section>
    <section className="bg-[#17191a] py-9"><div className="container grid gap-7 lg:grid-cols-[1.35fr_repeat(5,1fr)] lg:items-center"><div><h2 className="text-2xl font-semibold uppercase leading-tight">Готовы обсудить<br />ваш проект?</h2><p className="mt-3 text-xs text-white/55">Отправьте заявку, и мы подготовим для вас коммерческое предложение.</p><Link className="mt-5 inline-block bg-steel-orange px-5 py-3 text-xs font-bold uppercase" href="/contacts#contact-form">Получить расчет&nbsp; →</Link></div>{[["2000+","м² производственных площадей"],["70+","опытных специалистов"],["3","лазерных комплекса"],["4","листогибочных комплекса"],["100%","контроль качества"]].map(([value,label]) => <div key={label} className="border-l border-white/10 pl-5"><b className="text-3xl text-steel-orange">{value}</b><p className="mt-1 text-[10px] uppercase leading-relaxed text-white/50">{label}</p></div>)}</div></section>
  </main><Footer /></>;
}
