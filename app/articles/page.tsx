import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { articles, type ArticleDirection } from "@/data/articles";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Инженерный журнал «Сталь Продукт»",
  description: "Инженерный журнал архитектуры и металлообработки: фасадные идеи, производственные технологии, выставки и практика компании «Сталь Продукт».",
  path: "/articles",
  image: "/images/web/hero-main.jpg",
  keywords: [
    "инженерный журнал металлообработка",
    "инновации металлических фасадов",
    "технологии обработки листового металла",
    "выставки металлообработки",
    "инженерная практика",
  ],
});

const directions: Array<{
  id: string;
  number: string;
  title: string;
  description: string;
  image: string;
  href: string;
}> = [
  {
    id: "facades",
    number: "01",
    title: "Фасады и архитектурные инновации",
    description: "Архитектурные идеи, металлокассеты, объёмные и перфорированные панели, покрытия, узлы и концепции фасадов будущего.",
    image: "/images/industries/business-center.png",
    href: "#facades",
  },
  {
    id: "metalworking",
    number: "02",
    title: "Металлообработка и технологии",
    description: "Лазерная резка, гибка, сварка, окраска, оборудование, производственная автоматизация и роботизированные комплексы.",
    image: "/images/web/production.jpg",
    href: "#metalworking",
  },
  {
    id: "events",
    number: "03",
    title: "Выставки и события",
    description: "Проверенные календари, обзоры новых станков и технологий, рекомендации по профильным выставкам России, Китая и других стран.",
    image: "/images/web/cycle-laser-cutting.jpg",
    href: "#events",
  },
  {
    id: "engineering-practice",
    number: "04",
    title: "Инженерная практика «Сталь Продукт»",
    description: "Реальные производственные задачи: проектирование, чертежи, технологичность, материалы, покрытия и контроль результата.",
    image: "/images/web/cycle-design.jpg",
    href: "#engineering-practice",
  },
];

const directionCopy: Record<ArticleDirection, { eyebrow: string; title: string; description: string }> = {
  facades: {
    eyebrow: "Архитектурная лаборатория",
    title: "Фасады и архитектурные инновации",
    description: "Идеи и практические решения на пересечении архитектурного замысла и возможностей современного производства.",
  },
  metalworking: {
    eyebrow: "Производственные технологии",
    title: "Металлообработка и технологии",
    description: "Оборудование, процессы и автоматизация, которые повышают точность, повторяемость и управляемость производства.",
  },
  "engineering-practice": {
    eyebrow: "Опыт компании",
    title: "Инженерная практика «Сталь Продукт»",
    description: "Материалы, которые помогают правильно поставить задачу, подготовить документацию и получить прогнозируемый результат.",
  },
};

function ArticleCard({ article, eager = false }: { article: (typeof articles)[number]; eager?: boolean }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden border border-white/12 bg-[#111519] transition duration-300 hover:-translate-y-1 hover:border-steel-orange/70">
      <div className="relative aspect-[16/9] overflow-hidden">
        <img
          src={article.image}
          alt={article.title}
          width={960}
          height={540}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover brightness-[1.12] contrast-[1.02] transition duration-700 group-hover:scale-[1.035]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1013]/75 via-transparent to-transparent" />
        <span className="absolute bottom-4 left-5 border border-steel-orange/60 bg-[#0c1013]/85 px-2 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-steel-orange">
          {article.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-[10px] uppercase tracking-[.12em] text-white/45">{article.readingTime}</p>
        <h3 className="mt-4 text-xl font-semibold leading-tight">{article.title}</h3>
        <p className="mt-4 text-sm leading-relaxed text-white/60">{article.lead}</p>
        <Link href={`/articles/${article.slug}`} className="mt-auto pt-7 text-xs font-bold uppercase text-steel-orange">
          Читать материал&nbsp; →
        </Link>
      </div>
    </article>
  );
}

export default function ArticlesPage() {
  return (
    <PageLayout
      path="/articles"
      eyebrow="Архитектура · Металлообработка · Инженерная практика"
      title="Инженерный журнал"
      titleAccent="Сталь Продукт"
      description="Фасадные идеи, производственные технологии, отраслевые события и собственная инженерная практика — в одном центре знаний «Сталь Продукт»."
      image="/images/web/hero-main.jpg"
    >
      <section className="border-y border-white/10 bg-[#090d10] py-14 sm:py-20">
        <div className="container">
          <div className="flex flex-col justify-between gap-5 border-b border-white/12 pb-6 lg:flex-row lg:items-end">
            <div>
              <p className="eyebrow">Четыре направления</p>
              <h2 className="mt-3 max-w-4xl text-3xl font-semibold uppercase leading-tight sm:text-4xl">
                От архитектурной идеи до технологии изготовления
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-white/55">
              Выберите интересующее направление или переходите к новым материалам ниже.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {directions.map((direction) => (
              <a
                key={direction.id}
                href={direction.href}
                className="group relative flex min-h-[470px] flex-col overflow-hidden border border-white/14 bg-[#111519] transition duration-300 hover:-translate-y-1 hover:border-steel-orange"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={direction.image}
                    alt={direction.title}
                    width={900}
                    height={560}
                    className="h-full w-full object-cover brightness-[1.1] contrast-[1.03] transition duration-700 group-hover:scale-[1.045] group-hover:brightness-[1.18]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111519] via-transparent to-transparent" />
                  <span className="absolute left-5 top-5 font-mono text-3xl font-bold text-steel-orange">
                    {direction.number}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-xl font-semibold uppercase leading-tight">{direction.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-white/58">{direction.description}</p>
                  <span className="mt-auto pt-6 text-xs font-bold uppercase text-steel-orange">
                    Перейти в раздел&nbsp; ↓
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-steel-orange transition duration-500 group-hover:scale-x-100" />
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="events" className="scroll-mt-24 bg-[#0c1013] py-14 sm:py-20">
        <div className="container">
          <div className="flex flex-col justify-between gap-5 border-b border-white/12 pb-6 lg:flex-row lg:items-end">
            <div>
              <p className="eyebrow">03 · Выставки и события</p>
              <h2 className="mt-3 text-3xl font-semibold uppercase leading-tight sm:text-4xl">
                Где искать новые технологии и оборудование
              </h2>
            </div>
            <Link href="/articles/vystavki-metalloobrabotka-kitay-2026" className="text-xs font-bold uppercase text-steel-orange">
              Все выставки Китая 2026–2027&nbsp; →
            </Link>
          </div>

          <Link
            href="/articles/vystavki-metalloobrabotka-kitay-2026"
            className="group mt-8 grid overflow-hidden border border-steel-orange/45 bg-[#111519] transition hover:border-steel-orange lg:grid-cols-[340px_minmax(0,1fr)_220px] lg:items-stretch"
          >
            <div className="relative min-h-64 overflow-hidden">
              <img
                src="/images/web/cycle-laser-cutting.jpg"
                alt="Календарь выставок металлообработки в Китае"
                width={900}
                height={620}
                className="absolute inset-0 h-full w-full object-cover brightness-[1.16] contrast-[1.04] transition duration-700 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#111519]/55" />
            </div>
            <div className="flex flex-col justify-center border-t border-white/10 p-6 lg:border-l lg:border-t-0 sm:p-8">
              <p className="eyebrow">Спецпроект · Китай 2026–2027</p>
              <h3 className="mt-3 text-2xl font-semibold uppercase leading-tight">
                Календарь выставок по металлообработке
              </h3>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/58">
                Проверенные даты, города, оборудование, официальные сайты и рекомендации —
                кому действительно стоит планировать поездку.
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 bg-[#0d1114] p-6 lg:border-l lg:border-t-0 lg:flex-col lg:items-start">
              <span className="font-mono text-5xl font-bold text-steel-orange">14</span>
              <span className="text-xs font-bold uppercase leading-5 text-steel-orange">
                Открыть календарь&nbsp; →
              </span>
            </div>
          </Link>
        </div>
      </section>

      {(["facades", "metalworking", "engineering-practice"] as ArticleDirection[]).map((direction, sectionIndex) => {
        const section = directionCopy[direction];
        const sectionArticles = articles.filter((article) => article.direction === direction);
        return (
          <section
            id={direction}
            key={direction}
            className={`scroll-mt-24 border-t border-white/10 py-14 sm:py-20 ${sectionIndex % 2 === 0 ? "bg-[#15191c]" : "bg-[#0c1013]"}`}
          >
            <div className="container">
              <div className="flex flex-col justify-between gap-5 border-b border-white/12 pb-6 lg:flex-row lg:items-end">
                <div>
                  <p className="eyebrow">
                    {direction === "facades" ? "01" : direction === "metalworking" ? "02" : "04"} · {section.eyebrow}
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold uppercase leading-tight sm:text-4xl">{section.title}</h2>
                </div>
                <p className="max-w-md text-sm leading-7 text-white/55">{section.description}</p>
              </div>
              {direction === "metalworking" ? (
                <Link
                  href="/articles/china-tech"
                  className="group mt-8 grid overflow-hidden border border-steel-orange/40 bg-[#101519] transition hover:border-steel-orange lg:grid-cols-[minmax(0,1fr)_390px]"
                >
                  <div className="relative min-h-72 overflow-hidden">
                    <img
                      src="/images/web/cycle-bending.jpg"
                      alt="Технологии металлообработки Китая"
                      width={1200}
                      height={680}
                      className="absolute inset-0 h-full w-full object-cover brightness-[1.14] contrast-[1.03] transition duration-700 group-hover:scale-[1.035]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#101519]/70" />
                    <span className="absolute left-5 top-5 border border-steel-orange/70 bg-black/75 px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-steel-orange">
                      Мировые технологии
                    </span>
                  </div>
                  <div className="relative flex flex-col justify-center p-7 sm:p-9">
                    <p className="eyebrow">Технологии Китая</p>
                    <h3 className="mt-4 text-2xl font-semibold uppercase leading-tight">
                      Инженерная разведка для современного производства
                    </h3>
                    <p className="mt-5 text-sm leading-7 text-white/62">
                      Роботизированная гибка, умные линии, лазерная обработка и цифровое управление —
                      проверяем источники и объясняем технологии на профессиональном русском языке.
                    </p>
                    <span className="mt-7 text-xs font-bold uppercase text-steel-orange">
                      Перейти в рубрику&nbsp; →
                    </span>
                  </div>
                </Link>
              ) : null}
              {direction === "facades" ? (
                <Link
                  href="/articles/vystavki-fasady-arhitektura-2026"
                  className="group mt-8 grid overflow-hidden border border-steel-orange/40 bg-[#101519] transition hover:border-steel-orange lg:grid-cols-[390px_minmax(0,1fr)_180px]"
                >
                  <div className="relative min-h-72 overflow-hidden">
                    <img
                      src="/images/industries/business-center.png"
                      alt="Календарь выставок фасадов и архитектурных инноваций"
                      width={1200}
                      height={680}
                      className="absolute inset-0 h-full w-full object-cover brightness-[1.12] contrast-[1.03] transition duration-700 group-hover:scale-[1.035]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#101519]/75" />
                    <span className="absolute left-5 top-5 border border-steel-orange/70 bg-black/75 px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-steel-orange">
                      Россия · Китай · Дубай
                    </span>
                  </div>
                  <div className="flex flex-col justify-center border-t border-white/10 p-7 lg:border-l lg:border-t-0 sm:p-9">
                    <p className="eyebrow">Международный календарь 2026–2027</p>
                    <h3 className="mt-4 text-2xl font-semibold uppercase leading-tight">
                      Выставки фасадов и архитектурных инноваций
                    </h3>
                    <p className="mt-5 max-w-3xl text-sm leading-7 text-white/62">
                      Проверенные даты, технологии, официальные сайты и рекомендации —
                      кому действительно стоит посещать каждое событие.
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 bg-[#0d1114] p-6 lg:border-l lg:border-t-0 lg:flex-col lg:items-start">
                    <span className="font-mono text-5xl font-bold text-steel-orange">16</span>
                    <span className="text-xs font-bold uppercase leading-5 text-steel-orange">
                      Открыть календарь&nbsp; →
                    </span>
                  </div>
                </Link>
              ) : null}
              <div className="mt-8 grid gap-4 lg:grid-cols-3">
                {sectionArticles.map((article, index) => (
                  <ArticleCard key={article.slug} article={article} eager={sectionIndex === 0 && index === 0} />
                ))}
                {sectionArticles.length === 0 ? (
                  <div className="border border-dashed border-white/15 bg-[#111519] p-7 text-sm leading-7 text-white/48">
                    Материалы направления готовятся редакцией инженерного журнала «Сталь Продукт».
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        );
      })}
    </PageLayout>
  );
}
