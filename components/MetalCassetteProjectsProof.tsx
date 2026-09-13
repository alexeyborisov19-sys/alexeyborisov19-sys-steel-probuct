import Image from "next/image";
import Link from "next/link";
import { MetalCassetteAnnualOutput } from "./MetalCassetteAnnualOutput";
import { realProjectsShowcase } from "@/data/real-project-showcase";

const slugs = [
  "solovinaya-roshcha",
  "onkologicheskiy-dispanser",
  "odkb-novyy-korpus",
  "mrrc-tsyba-obninsk",
  "smolenskiy-meditsinskiy-kolledzh",
];
const projects = slugs.map((slug) => realProjectsShowcase.find((project) => project.slug === slug)!).filter(Boolean);

const categoryVisual = {
  residential: "/images/industries/residential.jpg",
  medical: "/images/industries/medical.jpg",
  education: "/images/industries/educational.jpg",
} as const;

export function MetalCassetteProjectsProof() {
  return (
    <section className="border-t border-white/10 bg-[#0a0e11] py-14 sm:py-20">
      <div className="container">
        <MetalCassetteAnnualOutput className="mb-12" />

        <div className="flex flex-col justify-between gap-5 border-b border-white/12 pb-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="eyebrow">Реальные поставки</p>
            <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Где используются наши металлокассеты</h2>
            <p className="mt-4 text-sm leading-7 text-white/58">Не только каталог и расчёт: металлокассеты и связанные изделия поставлялись для жилой застройки, медицинских и образовательных объектов. Для МРНЦ им. А. Ф. Цыба в Обнинске поставка металлокассет продолжается.</p>
          </div>
          <Link href="/projects" className="text-xs font-bold uppercase text-steel-orange">Все реализованные объекты&nbsp; →</Link>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {projects.map((project) => (
            <article key={project.slug} className="group flex h-full flex-col overflow-hidden border border-white/12 bg-[#111519] transition hover:border-steel-orange/65">
              <div className="relative aspect-[16/10] overflow-hidden bg-[#172026]">
                <Image src={categoryVisual[project.category]} alt={`${project.categoryLabel} — иллюстративный визуал отрасли`} fill sizes="(max-width:767px) 100vw, (max-width:1279px) 50vw, 20vw" className="object-cover brightness-[.82] transition duration-500 group-hover:scale-[1.025]" />
                <span className="absolute bottom-3 left-3 max-w-[90%] bg-black/70 px-2 py-1 text-[9px] uppercase tracking-[.06em] text-white/70">Иллюстративный визуал · не фото объекта</span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs font-bold uppercase tracking-[.08em] text-steel-orange">{project.categoryLabel}</p>
                <h3 className="mt-3 text-base font-semibold leading-tight">{project.title}</h3>
                <p className="mt-4 text-sm leading-6 text-white/58">{project.supply.join(" · ")}</p>
                <div className="mt-auto flex flex-wrap gap-4 pt-5">
                  {project.href ? <Link href={project.href} className="text-xs font-bold uppercase text-steel-orange">Кейс&nbsp; →</Link> : <Link href="/projects" className="text-xs font-bold uppercase text-steel-orange">В портфолио&nbsp; →</Link>}
                  {project.imageSourceUrl ? <a href={project.imageSourceUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase text-white/40 hover:text-white">Реальное фото у источника&nbsp; ↗</a> : null}
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-5 text-xs leading-6 text-white/40">Карточки показывают подтверждённые объекты и состав поставки. Локальные изображения в этом блоке являются отраслевыми иллюстрациями, а ссылки ведут к реальным фотографиям на сайтах первоисточников. Чужие файлы не загружаются на steelprodukt.ru без подтверждённого права публикации. Монтаж на объектах не выполняем.</p>
      </div>
    </section>
  );
}
