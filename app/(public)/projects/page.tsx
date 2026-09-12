import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import { ProjectPhotoGallery } from "@/components/ProjectPhotoGallery";
import { projectCategoryLabels, type RealProjectCategory } from "@/data/real-projects";
import { realProjectsShowcase as realProjects } from "@/data/real-project-showcase";
import { absoluteUrl } from "@/lib/site";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Реализованные объекты и поставки",
  description: "Реальные объекты, для которых под брендом «Сталь Продукт» поставлялись металлокассеты, вентиляционные решётки, кронштейны, корпуса и другие изделия из листового металла.",
  path: "/projects",
  image: "/images/industries/residential.jpg",
  keywords: [
    "реализованные объекты Сталь Продукт",
    "металлокассеты объекты Смоленск",
    "металлоизделия для застройщиков",
    "металлоизделия для больниц",
    "металлоизделия для школ",
    "поставка металлокассет",
    "металлокассеты Обнинск",
  ],
});

const categories: RealProjectCategory[] = ["residential", "medical", "education"];

const portfolioSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Реализованные объекты и поставки «Сталь Продукт»",
  itemListElement: realProjects.map((project, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "CreativeWork",
      name: project.title,
      description: project.description,
      image: project.photos.map((photo) => photo.src),
      url: project.href ? absoluteUrl(project.href) : project.sourceUrl,
    },
  })),
};

export default function ProjectsPage() {
  const solovinaya = realProjects.find((project) => project.slug === "solovinaya-roshcha")!;

  return (
    <>
      <JsonLd data={portfolioSchema} />
      <PageLayout
        path="/projects"
        eyebrow="Реальные поставки"
        title="Реализованные объекты и поставки"
        description="Жилые кварталы, больницы, школы и общественные объекты, для которых под брендом «Сталь Продукт» изготавливались и поставлялись изделия из листового металла."
        image="/images/industries/residential.jpg"
        imageAlt="Изделия из листового металла для строительных объектов"
      >
        <section className="bg-[#0c1013] py-12 sm:py-16">
          <div className="container">
            <div className="grid gap-5 border border-steel-orange/35 bg-[#111519] p-6 lg:grid-cols-[1.1fr_.9fr] lg:p-8">
              <div>
                <p className="eyebrow">Портфолио поставок</p>
                <h2 className="mt-3 max-w-3xl text-2xl font-semibold uppercase leading-tight sm:text-3xl">
                  От жилого квартала до медицинского корпуса
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/62">
                  На одном объекте заказ может включать фасадные металлокассеты, вентиляционные решётки, кронштейны, корпуса, ящики и нестандартные детали. Производственная задача — выпустить разные позиции в единой управляемой серии по документации заказчика.
                </p>
              </div>
              <div className="border-l-2 border-steel-orange bg-black/20 p-5 text-sm leading-7 text-white/58">
                <b className="text-white">Границы утверждений.</b> Состав поставок на этой странице основан на подтверждённой информации компании. Ссылки на официальные и отраслевые источники подтверждают название и контекст объекта. Мы не утверждаем, что конкретный видимый элемент на фотографии изготовлен нами, если такая привязка отдельно не подтверждена. Монтаж на объекте не выполняем. Работу фасадной системы, требования к креплению, пожарной безопасности и другим системным характеристикам определяет проектная документация объекта, а не отдельное изделие.
              </div>
            </div>

            <div className="mt-5 grid overflow-hidden border border-white/10 bg-[#0f1418] sm:grid-cols-[240px_minmax(0,1fr)]">
              <div className="relative min-h-44">
                <Image
                  src="/images/industries/residential.jpg"
                  alt="Архитектурные и фасадные решения для строительных объектов"
                  fill
                  sizes="(max-width: 639px) 100vw, 240px"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col justify-center p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[.12em] text-steel-orange">Производство под объект</p>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-white/58">Фотографии ниже показывают сами объекты и архитектурный контекст. Производственная привязка подтверждается нашей историей поставок; конкретные свойства готовой системы задаются проектом.</p>
              </div>
            </div>

            <section className="mt-12 overflow-hidden border border-steel-orange/45 bg-[#111519]">
              <div className="grid lg:grid-cols-[1.05fr_.95fr]">
                <ProjectPhotoGallery photos={solovinaya.photos} tall />
                <div className="flex flex-col p-6 sm:p-8">
                  <p className="text-xs font-bold uppercase tracking-[.12em] text-steel-orange">Ключевой кластер проектов</p>
                  <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">{solovinaya.title}</h2>
                  <p className="mt-2 text-sm font-semibold text-white/48">{solovinaya.partner} · {solovinaya.city}</p>
                  <p className="mt-5 text-sm leading-7 text-white/62">{solovinaya.description}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {solovinaya.supply.map((item) => <span key={item} className="border border-white/12 bg-white/[.035] px-3 py-2 text-xs text-white/68">{item}</span>)}
                  </div>
                  <div className="mt-auto flex flex-wrap gap-4 pt-7 text-xs font-bold uppercase">
                    <Link href="/projects/solovinaya-roshcha" className="text-steel-orange">Большой кейс&nbsp; →</Link>
                    <a href={solovinaya.sourceUrl} target="_blank" rel="noreferrer" className="text-white/55 transition hover:text-white">Официальный сайт&nbsp; ↗</a>
                  </div>
                </div>
              </div>
            </section>

            {categories.map((category) => {
              const projects = realProjects.filter((project) => project.category === category && project.slug !== "solovinaya-roshcha");
              return (
                <section key={category} className="mt-16">
                  <div className="flex flex-col justify-between gap-4 border-b border-white/12 pb-5 sm:flex-row sm:items-end">
                    <div>
                      <p className="eyebrow">Реальные объекты</p>
                      <h2 className="mt-2 text-2xl font-semibold uppercase sm:text-3xl">{projectCategoryLabels[category]}</h2>
                    </div>
                    <p className="max-w-xl text-sm leading-6 text-white/48">В карточке указан подтверждённый состав поставки и источник об объекте. Если в открытых источниках найдено несколько достоверных фотографий, они собраны в галерею.</p>
                  </div>
                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {projects.map((project) => (
                      <article key={project.slug} className="group flex h-full flex-col overflow-hidden border border-white/12 bg-[#111519] transition hover:border-steel-orange/60">
                        <ProjectPhotoGallery photos={project.photos} />
                        <div className="flex flex-1 flex-col p-5">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[.08em]">
                            <span className="text-steel-orange">{project.categoryLabel}</span><span className="text-white/35">·</span><span className="text-white/45">{project.city}</span>
                          </div>
                          <h3 className="mt-3 text-lg font-semibold leading-tight">{project.title}</h3>
                          {project.partner ? <p className="mt-2 text-xs text-white/42">{project.partner}</p> : null}
                          <p className="mt-4 text-sm leading-6 text-white/58">{project.description}</p>
                          <div className="mt-5 border-t border-white/10 pt-4">
                            <p className="text-[11px] font-bold uppercase tracking-[.1em] text-white/40">Поставка</p>
                            <p className="mt-2 text-sm leading-6 text-white/72">{project.supply.join(" · ")}</p>
                          </div>
                          <div className="mt-auto flex flex-wrap gap-4 pt-5 text-xs font-bold uppercase">
                            {project.href ? <Link href={project.href} className="text-steel-orange">Подробнее&nbsp; →</Link> : null}
                            <a href={project.sourceUrl} target="_blank" rel="noreferrer" className="text-white/48 transition hover:text-white">{project.sourceLabel}&nbsp; ↗</a>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}

            <section className="mt-16 overflow-hidden border border-steel-orange/35 bg-[linear-gradient(120deg,rgba(224,86,36,.13),rgba(17,21,25,.98)_48%)] p-6 sm:p-8">
              <p className="eyebrow">Портфолио продолжает расти</p>
              <h2 className="mt-3 max-w-4xl text-2xl font-semibold uppercase leading-tight sm:text-3xl">Это далеко не полный перечень объектов, прошедших через наше производство</h2>
              <p className="mt-5 max-w-4xl text-sm leading-7 text-white/62">
                За годы работы изделия «Сталь Продукт» поставлялись на значительно большее число жилых, медицинских, образовательных, промышленных и общественных объектов. Мы постепенно поднимаем архивы, сверяем названия зданий, фотографии и фактический состав каждой поставки — и будем расширять этот раздел только теми проектами, которые можем корректно идентифицировать и подтвердить.
              </p>
              <p className="mt-3 max-w-4xl text-xs leading-6 text-white/42">Так портфолио остаётся не рекламным перечнем без доказательств, а живым архивом реальных производственных поставок.</p>
            </section>

            <section className="mt-16 border-y border-white/12 py-9">
              <p className="eyebrow">Номенклатура объектов</p>
              <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Что поставляем для крупных строительных проектов</h2>
              <div className="mt-7 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Металлокассеты", "Открытые, закрытые, угловые и проектные исполнения по фасадной раскладке."],
                  ["Вентиляционные решётки", "Фасадные и инженерные решётки по размерам, живому сечению и проектному исполнению."],
                  ["Кронштейны", "Серийные гнутые и сварные изделия по рабочим чертежам и спецификациям."],
                  ["Корпуса и ящики", "Металлические корпуса, боксы и защитные изделия для инженерных систем."],
                  ["Доборные элементы", "Откосы, отливы, парапетные крышки, углы и другие элементы сопряжения."],
                  ["Нестандартные изделия", "Детали и сборки из листового металла по КД заказчика."],
                ].map(([title, text]) => (
                  <div key={title} className="bg-[#111519] p-5">
                    <h3 className="font-semibold text-steel-orange">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/55">{text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-12 grid gap-5 border border-white/12 bg-[#111519] p-6 lg:grid-cols-[1fr_auto] lg:items-center lg:p-8">
              <div>
                <p className="eyebrow">История за объектами</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase">Металл для города</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58">В инженерном журнале собрали несколько показательных объектов и объяснили, как разные группы листовых металлоизделий сходятся в одной строительной поставке.</p>
              </div>
              <Link href="/articles/metall-dlya-goroda-proekty-stal-produkt" className="clip-corner bg-steel-orange-deep px-6 py-4 text-xs font-bold uppercase">Читать статью&nbsp; →</Link>
            </section>

            <div className="mt-6 flex flex-col justify-between gap-5 border border-white/15 bg-[#14181b] p-6 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-semibold">Есть проект или спецификация?</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Передайте чертежи, ведомость изделий или фасадную раскладку. Проверим исходные данные и подготовим производственный и коммерческий расчёт.</p>
              </div>
              <Link href="/contacts#contact-form" className="clip-corner whitespace-nowrap bg-steel-orange-deep px-7 py-4 text-[13px] font-bold uppercase">Передать проект&nbsp; →</Link>
            </div>
          </div>
        </section>
      </PageLayout>
    </>
  );
}
