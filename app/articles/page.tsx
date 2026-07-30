import Link from "next/link";
import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { articles, type Article, type ArticleDirection } from "@/data/articles";
import { createPageMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { breadcrumbSchema, webPageSchema } from "@/lib/schema";

export const metadata: Metadata = createPageMetadata({
  title: "Инженерный журнал по металлообработке",
  description: "Инженерная практика, технологии металлообработки, фасадные решения и отраслевые выставки в журнале компании «Сталь Продукт».",
  path: "/articles",
  image: "/images/web/hero-main.jpg",
  keywords: [
    "инженерный журнал металлообработка",
    "инженерная практика металлообработка",
    "технологии лазерной резки",
    "автоматизация гибки металла",
    "роботизация производства",
    "инновации металлических фасадов",
    "выставки металлообработки 2026 2027",
    "инженерная практика",
  ],
});

const navigation = [
  { id: "engineering-practice", marker: "01", title: "Инженерная практика" },
  { id: "facades", marker: "02", title: "Фасады и архитектурные инновации" },
  { id: "metalworking", marker: "03", title: "Металлообработка и технологии" },
  { id: "events", marker: "04", title: "Выставки и события" },
] as const;

const sectionCopy: Record<ArticleDirection, { number: string; eyebrow: string; title: string; description: string }> = {
  facades: {
    number: "02",
    eyebrow: "Архитектурная лаборатория",
    title: "Фасады и архитектурные инновации",
    description: "Идеи и практические решения на пересечении архитектурного замысла, материалов и возможностей современного производства.",
  },
  metalworking: {
    number: "03",
    eyebrow: "Производственные технологии",
    title: "Металлообработка и технологии",
    description: "Оборудование, процессы и автоматизация, которые повышают точность, повторяемость и управляемость производства.",
  },
  "engineering-practice": {
    number: "01",
    eyebrow: "Главная рубрика",
    title: "Инженерная практика «Сталь Продукт»",
    description: "Прикладные материалы о постановке задачи, подготовке документации, выборе технологии, снижении затрат и контроле результата.",
  },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function ArticleCard({ article, compact = false }: { article: Article; compact?: boolean }) {
  return (
    <article className={`journal-card group grid h-full overflow-hidden border border-white/12 bg-[#101519] transition duration-300 hover:border-steel-orange/75 ${compact ? "sm:grid-cols-[120px_minmax(0,1fr)]" : ""}`}>
      <div className={`relative overflow-hidden ${compact ? "min-h-48 sm:min-h-full" : "aspect-[16/9]"}`}>
        <img
          src={article.image}
          alt={article.title}
          width={960}
          height={540}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover brightness-[1.14] contrast-[1.02] transition duration-700 group-hover:scale-[1.035] group-hover:brightness-[1.2]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1013]/80 via-transparent to-transparent" />
      </div>
      <div className="flex min-w-0 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[.08em]">
          <span className="text-steel-orange">{article.category}</span>
          <time dateTime={article.publishedAt} className="text-white/42">{formatDate(article.publishedAt)}</time>
        </div>
        <h3 className={`${compact ? "mt-3 text-lg" : "mt-4 text-xl"} font-semibold leading-tight`}>{article.title}</h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/58">{article.lead}</p>
        <Link href={`/articles/${article.slug}`} className="mt-auto pt-5 text-[11px] font-bold uppercase tracking-[.055em] text-steel-orange">
          Читать материал&nbsp; →
        </Link>
      </div>
    </article>
  );
}

function SectionHeading({
  number,
  eyebrow,
  title,
  description,
}: {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="journal-section-heading grid gap-5 border-b border-white/12 pb-6 md:grid-cols-[72px_minmax(0,1fr)]">
      <span className="text-4xl font-bold tabular-nums text-steel-orange">{number}</span>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold uppercase leading-tight sm:text-3xl">{title}</h2>
        </div>
        <p className="text-sm leading-7 text-white/55">{description}</p>
      </div>
    </div>
  );
}

export default function ArticlesPage() {
  const engineeringArticles = articles
    .filter((article) => article.direction === "engineering-practice")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const featuredEngineeringArticle = engineeringArticles[0];
  const secondaryEngineeringArticles = engineeringArticles.slice(1, 3);
  const remainingEngineeringArticles = engineeringArticles.slice(3);

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${absoluteUrl("/articles")}#collection`,
    name: "Инженерный журнал по металлообработке",
    description: "Инженерная практика, технологии металлообработки, фасадные инновации и отраслевые события.",
    url: absoluteUrl("/articles"),
    inLanguage: "ru",
    hasPart: articles.map((article) => ({
      "@type": "Article",
      headline: article.title,
      url: absoluteUrl(`/articles/${article.slug}`),
      datePublished: article.publishedAt,
      dateModified: article.modifiedAt,
      articleSection: article.category,
    })),
  };

  return (
    <>
      <JsonLd
        data={[
          webPageSchema({
            name: "Инженерный журнал по металлообработке",
            description: "Инженерная практика, технологии металлообработки, фасадные инновации и отраслевые события.",
            path: "/articles",
          }),
          breadcrumbSchema([
            { name: "Главная", path: "/" },
            { name: "Инженерный журнал", path: "/articles" },
          ]),
          collectionSchema,
        ]}
      />
      <Header />
      <main>
        <section className="journal-hero relative overflow-hidden border-b border-white/12 pt-[76px]">
          <img
            src="/images/web/hero-main.webp"
            alt=""
            width={1800}
            height={920}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center brightness-[.62] contrast-[1.08]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,10,12,.98)_0%,rgba(7,10,12,.88)_48%,rgba(7,10,12,.34)_100%)]" />
          <div className="journal-grid-overlay absolute inset-0" />
          <div className="container relative z-10 grid min-h-[440px] items-end gap-10 py-16 lg:grid-cols-[minmax(0,1fr)_330px] lg:py-20">
            <div>
              <p className="eyebrow">Инженерная практика · Технологии · Аналитика</p>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold uppercase leading-[1.02] sm:text-5xl lg:text-6xl">
                Инженерный журнал
                <span className="mt-2 block text-steel-orange">Сталь Продукт</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/68">
                Разбираем реальные производственные задачи, подготовку документации, выбор материалов,
                технологии обработки листового металла и фасадные решения.
              </p>
            </div>
            <div className="border-l-2 border-steel-orange bg-black/35 p-6 backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">Редакционный принцип</p>
              <p className="mt-3 text-sm leading-7 text-white/67">
                Опираемся на инженерную логику, производственный опыт и первоисточники. Каждый материал должен помогать принять практическое решение.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[#090d10] py-10 sm:py-14">
          <div className="container grid items-start gap-8 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-12">
            <aside className="journal-sidebar lg:sticky lg:top-6">
              <div className="border border-white/12 bg-[#0f1418]">
                <div className="border-b border-white/10 px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/42">Навигация по журналу</p>
                </div>
                <nav aria-label="Разделы инженерного журнала">
                  {navigation.map((item) => (
                    <a key={item.id} href={`#${item.id}`} className="journal-sidebar-link group grid grid-cols-[52px_minmax(0,1fr)] items-center border-b border-white/8 px-5 py-4 last:border-0">
                      <span className="text-lg font-bold tabular-nums text-steel-orange">
                        {item.marker}
                      </span>
                      <span className="text-xs font-semibold leading-5 text-white/72 transition group-hover:text-white">{item.title}</span>
                    </a>
                  ))}
                </nav>
              </div>
              <div className="mt-4 border border-steel-orange/35 bg-[linear-gradient(135deg,rgba(234,91,12,.14),rgba(15,20,24,.98)_54%)] p-5">
                <p className="text-sm font-semibold">Есть тема или инженерный вопрос?</p>
                <p className="mt-2 text-xs leading-6 text-white/52">Предложите тему редакции или передайте задачу специалисту.</p>
                <Link href="/contacts#contact-form" className="mt-4 inline-flex text-[10px] font-bold uppercase tracking-[.06em] text-steel-orange">
                  Написать нам&nbsp; →
                </Link>
              </div>
            </aside>

            <div className="min-w-0">
              <section id="engineering-practice" className="scroll-mt-24 pb-14 sm:pb-16">
                <SectionHeading {...sectionCopy["engineering-practice"]} />
                {featuredEngineeringArticle ? (
                  <div className="mt-7 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
                    <article className="journal-card-feature group relative min-h-[510px] overflow-hidden border border-steel-orange/45 bg-[#101519]">
                      <img
                        src={featuredEngineeringArticle.image}
                        alt={featuredEngineeringArticle.title}
                        width={1200}
                        height={760}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover brightness-[.82] contrast-[1.05] transition duration-700 group-hover:scale-[1.025] group-hover:brightness-[.9]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#080b0d] via-[#080b0d]/58 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                        <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-[.09em]">
                          <span className="text-steel-orange">Главный инженерный материал</span>
                          <time dateTime={featuredEngineeringArticle.publishedAt} className="text-white/55">{formatDate(featuredEngineeringArticle.publishedAt)}</time>
                        </div>
                        <h3 className="mt-4 max-w-3xl text-2xl font-semibold leading-tight sm:text-3xl">{featuredEngineeringArticle.title}</h3>
                        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/66">{featuredEngineeringArticle.lead}</p>
                        <Link href={`/articles/${featuredEngineeringArticle.slug}`} className="mt-6 inline-flex border border-steel-orange/65 px-4 py-3 text-[10px] font-bold uppercase tracking-[.06em] text-steel-orange transition hover:bg-steel-orange hover:text-white">
                          Читать материал&nbsp; →
                        </Link>
                      </div>
                    </article>
                    <div className="grid gap-4">
                      {secondaryEngineeringArticles.map((article) => <ArticleCard key={article.slug} article={article} compact />)}
                    </div>
                  </div>
                ) : null}
                {remainingEngineeringArticles.length ? (
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    {remainingEngineeringArticles.map((article) => <ArticleCard key={article.slug} article={article} />)}
                  </div>
                ) : null}
              </section>

              <section id="facades" className="scroll-mt-24 border-t border-white/10 py-14 sm:py-16">
                <SectionHeading {...sectionCopy.facades} />
                <Link href="/articles/vystavki-fasady-arhitektura-2026" className="journal-feature-link group mt-7 grid overflow-hidden border border-steel-orange/35 bg-[#101519] md:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="relative min-h-56 overflow-hidden">
                    <img src="/images/industries/business-center.jpg" alt="Фасадные выставки России, Китая и Дубая" width={900} height={600} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover brightness-[1.12] transition duration-700 group-hover:scale-[1.035]" />
                  </div>
                  <div className="flex flex-col justify-center p-6 sm:p-8">
                    <p className="eyebrow">Календарь 2026–2027</p>
                    <h3 className="mt-3 text-xl font-semibold uppercase">Выставки фасадов России, Китая и Дубая</h3>
                    <p className="mt-3 text-sm leading-7 text-white/56">Даты, площадки, основные темы и официальные сайты профильных событий.</p>
                    <span className="mt-5 text-[11px] font-bold uppercase text-steel-orange">Открыть календарь&nbsp; →</span>
                  </div>
                </Link>
                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  {articles.filter((article) => article.direction === "facades").map((article) => <ArticleCard key={article.slug} article={article} />)}
                </div>
              </section>

              <section id="metalworking" className="scroll-mt-24 border-t border-white/10 py-14 sm:py-16">
                <SectionHeading {...sectionCopy.metalworking} />
                <Link href="/articles/china-tech" className="journal-feature-link group mt-7 grid overflow-hidden border border-steel-orange/35 bg-[#101519] md:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="flex flex-col justify-center p-6 sm:p-8">
                    <p className="eyebrow">Мировые технологии</p>
                    <h3 className="mt-3 text-xl font-semibold uppercase">Инженерная разведка для современного производства</h3>
                    <p className="mt-3 text-sm leading-7 text-white/56">Роботизированная гибка, умные линии, лазерная обработка и цифровое управление.</p>
                    <span className="mt-5 text-[11px] font-bold uppercase text-steel-orange">Перейти в рубрику&nbsp; →</span>
                  </div>
                  <div className="relative min-h-56 overflow-hidden">
                    <img src="/images/web/cycle-bending.jpg" alt="Современная гибка листового металла" width={900} height={600} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover brightness-[1.16] transition duration-700 group-hover:scale-[1.035]" />
                  </div>
                </Link>
                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  {articles.filter((article) => article.direction === "metalworking").map((article) => <ArticleCard key={article.slug} article={article} />)}
                </div>
              </section>

              <section id="events" className="scroll-mt-24 border-t border-white/10 py-14 sm:py-16">
                <SectionHeading
                  number="04"
                  eyebrow="Проверенные календари"
                  title="Выставки и события"
                  description="Даты, города, направления оборудования и официальные сайты — в компактном формате для планирования поездок."
                />
                <div className="mt-7 grid gap-4 xl:grid-cols-2">
                  <Link href="/articles/vystavki-metalloobrabotka-kitay-2026" className="journal-event-card group border border-white/12 bg-[#101519] p-6 transition hover:border-steel-orange">
                    <span className="text-4xl font-bold tabular-nums text-steel-orange">14</span>
                    <p className="mt-5 text-[10px] font-bold uppercase tracking-[.12em] text-white/42">Китай · 2026–2027</p>
                    <h3 className="mt-3 text-xl font-semibold uppercase leading-tight">Выставки металлообработки</h3>
                    <p className="mt-4 text-sm leading-7 text-white/56">Резка, гибка, станки, автоматизация и промышленная робототехника.</p>
                    <span className="mt-6 inline-flex text-[11px] font-bold uppercase text-steel-orange">Открыть календарь&nbsp; →</span>
                  </Link>
                  <Link href="/articles/vystavki-fasady-arhitektura-2026" className="journal-event-card group border border-white/12 bg-[#101519] p-6 transition hover:border-steel-orange">
                    <span className="text-4xl font-bold tabular-nums text-steel-orange">16</span>
                    <p className="mt-5 text-[10px] font-bold uppercase tracking-[.12em] text-white/42">Россия · Китай · Дубай</p>
                    <h3 className="mt-3 text-xl font-semibold uppercase leading-tight">Фасады и архитектурные инновации</h3>
                    <p className="mt-4 text-sm leading-7 text-white/56">Фасадные системы, оболочка здания, стекло, панели, покрытия и проектирование.</p>
                    <span className="mt-6 inline-flex text-[11px] font-bold uppercase text-steel-orange">Открыть календарь&nbsp; →</span>
                  </Link>
                </div>
              </section>

            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
