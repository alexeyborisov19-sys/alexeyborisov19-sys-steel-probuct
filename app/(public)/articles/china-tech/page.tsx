import Link from "next/link";
import type { Metadata } from "next";
import { ArticleCommercialLinks } from "@/components/ArticleCommercialLinks";
import { PageLayout } from "@/components/PageLayout";
import { articles } from "@/data/articles";
import { chinaTechSources } from "@/data/china-tech";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Технологии металлообработки Китая",
  description: "Русские экспертные обзоры китайских технологий листовой обработки, роботизированной гибки, лазерной резки и цифрового производства.",
  path: "/articles/china-tech",
  image: "/images/web/cycle-bending.jpg",
  keywords: [
    "технологии металлообработки Китая",
    "роботизированная гибка",
    "автоматизация листового металла",
    "промышленная робототехника Китай",
  ],
});

export default function ChinaTechPage() {
  const technologyArticles = articles.filter((article) => article.category === "Технологии Китая");

  return (
    <PageLayout
      path="/articles/china-tech"
      eyebrow="Редакционный мониторинг"
      title="Технологии металлообработки Китая"
      description="Отбираем сильные инженерные решения, проверяем их по первичным источникам и объясняем на профессиональном русском языке — с выводами для российских производств и заказчиков."
      image="/images/web/cycle-bending.jpg"
      imageBrightness
    >
      <section className="china-tech-radar border-y border-white/10 bg-[#090d10] py-14 sm:py-20">
        <div className="container">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)] xl:items-end">
            <div>
              <p className="eyebrow">Как устроена рубрика</p>
              <h2 className="mt-4 max-w-4xl text-3xl font-semibold uppercase leading-tight sm:text-4xl">
                Не перевод новостей, а инженерная разведка
              </h2>
              <p className="mt-6 max-w-3xl text-base leading-8 text-white/64">
                Мы не копируем китайские публикации. Редакция выделяет технические факты,
                сопоставляет их с первичными материалами производителей и выпускает
                самостоятельный русский обзор с практическим выводом.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-px border border-white/12 bg-white/10">
              {[
                ["01", "Найти сигнал"],
                ["02", "Проверить факты"],
                ["03", "Объяснить пользу"],
              ].map(([number, label]) => (
                <div key={number} className="bg-[#101519] p-5">
                  <span className="font-mono text-xl font-bold text-steel-orange">{number}</span>
                  <p className="mt-5 text-xs font-bold uppercase leading-5 text-white/74">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0c1013] py-14 sm:py-20">
        <div className="container">
          <div className="flex flex-col justify-between gap-5 border-b border-white/12 pb-6 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Новые обзоры</p>
              <h2 className="mt-3 text-3xl font-semibold uppercase sm:text-4xl">Отобрано редакцией</h2>
            </div>
            <Link href="/articles" className="text-xs font-bold uppercase text-steel-orange">
              Все статьи&nbsp; →
            </Link>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {technologyArticles.map((article, index) => (
              <article
                key={article.slug}
                className="group relative overflow-hidden border border-white/14 bg-[#111519] transition duration-300 hover:-translate-y-1 hover:border-steel-orange/70"
              >
                <div className="relative aspect-[16/8] overflow-hidden">
                  <img
                    src={article.image}
                    alt={article.title}
                    width={1200}
                    height={600}
                    loading={index === 0 ? "eager" : "lazy"}
                    decoding="async"
                    className="h-full w-full object-cover brightness-[1.14] contrast-[1.03] transition duration-700 group-hover:scale-[1.035]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f12] via-[#0b0f12]/15 to-transparent" />
                  <span className="absolute left-5 top-5 border border-steel-orange/70 bg-black/70 px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-steel-orange backdrop-blur">
                    Китай / редакционный обзор
                  </span>
                </div>
                <div className="p-6 sm:p-8">
                  <p className="text-[10px] font-bold uppercase tracking-[.15em] text-white/42">
                    {article.readingTime} · проверено по {article.sources?.length ?? 0} источникам
                  </p>
                  <h3 className="mt-4 max-w-3xl text-2xl font-semibold leading-tight">{article.title}</h3>
                  <p className="mt-5 max-w-3xl text-sm leading-7 text-white/62">{article.lead}</p>
                  <Link href={`/articles/${article.slug}`} className="mt-7 inline-block text-xs font-bold uppercase text-steel-orange">
                    Читать инженерный разбор&nbsp; →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#15191c] py-14 sm:py-20">
        <div className="container">
          <div className="max-w-3xl">
            <p className="eyebrow">Контур источников</p>
            <h2 className="mt-3 text-3xl font-semibold uppercase leading-tight sm:text-4xl">
              Где мы отслеживаем технологии
            </h2>
            <p className="mt-5 text-sm leading-7 text-white/58">
              Публикации этих площадок служат началом исследования. Технические заявления
              дополнительно проверяются по материалам ассоциаций и производителей оборудования.
            </p>
          </div>
          <div className="mt-9 grid gap-px border border-white/12 bg-white/10 md:grid-cols-2">
            {chinaTechSources.map((source, index) => (
              <article key={source.url} className="group bg-[#101417] p-6 sm:p-8">
                <div className="flex items-start justify-between gap-5">
                  <span className="font-mono text-2xl font-bold text-steel-orange">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="border border-white/15 px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-white/46">
                    {source.kind}
                  </span>
                </div>
                <h3 className="mt-8 text-xl font-semibold">{source.name}</h3>
                <p className="mt-4 text-sm leading-7 text-white/58">{source.description}</p>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[.12em] text-white/40">
                  {source.focus}
                </p>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-block text-xs font-bold uppercase text-steel-orange"
                >
                  Открыть первоисточник&nbsp; ↗
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0c1013] py-14 sm:py-20">
        <div className="container">
          <ArticleCommercialLinks direction="metalworking" />
        </div>
      </section>
    </PageLayout>
  );
}
