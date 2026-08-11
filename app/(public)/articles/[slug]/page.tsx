import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCommercialLinks } from "@/components/ArticleCommercialLinks";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { InnerHero } from "@/components/InnerHero";
import { JsonLd } from "@/components/JsonLd";
import { articleBySlug, articles } from "@/data/articles";
import { articleSchema, breadcrumbSchema, webPageSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

type ArticlePageProps = { params: Promise<{ slug: string }> };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function sectionId(index: number) {
  return `section-${String(index + 1).padStart(2, "0")}`;
}

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const article = articleBySlug[(await params).slug];
  if (!article) return {};

  return createPageMetadata({
    title: article.seoTitle ?? article.title,
    description: article.lead,
    path: `/articles/${article.slug}`,
    image: article.image,
    keywords: article.keywords,
    openGraphType: "article",
    publishedTime: article.publishedAt,
    modifiedTime: article.modifiedAt,
  });
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const article = articleBySlug[(await params).slug];
  if (!article) notFound();

  const path = `/articles/${article.slug}`;
  const wasUpdated = article.modifiedAt !== article.publishedAt;

  return (
    <>
      <JsonLd
        data={[
          webPageSchema({
            name: article.title,
            description: article.lead,
            path,
          }),
          breadcrumbSchema([
            { name: "Главная", path: "/" },
            { name: "Статьи", path: "/articles" },
            { name: article.title, path },
          ]),
          articleSchema({
            headline: article.title,
            description: article.lead,
            path,
            image: article.image,
            datePublished: article.publishedAt,
            dateModified: article.modifiedAt,
            citations: article.sources?.map((source) => source.url),
          }),
        ]}
      />
      <Header />
      <main>
        <InnerHero
          eyebrow={article.category}
          title={article.title}
          description={article.lead}
          image={article.image}
        />

        <article className="bg-[#0c1013] py-14 sm:py-20">
          <div className="container grid gap-10 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="min-w-0">
              <div className="text-xs text-white/45">
                <Link href="/articles" className="transition hover:text-steel-orange">
                  Инженерный журнал «Сталь Продукт»
                </Link>
                <span className="mx-2 text-steel-orange">/</span>
                {article.category}
              </div>

              {article.series ? (
                <p className="mt-8 text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">
                  {article.series}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-y border-white/10 py-4 text-[11px] uppercase tracking-[.06em] text-white/45">
                <span>
                  Опубликовано{" "}
                  <time dateTime={article.publishedAt} className="text-white/68">
                    {formatDate(article.publishedAt)}
                  </time>
                </span>
                {wasUpdated ? (
                  <span>
                    Обновлено{" "}
                    <time dateTime={article.modifiedAt} className="text-white/68">
                      {formatDate(article.modifiedAt)}
                    </time>
                  </span>
                ) : null}
                <span className="text-white/68">{article.readingTime} чтения</span>
              </div>

              <p className="mt-8 max-w-3xl text-lg leading-relaxed text-white/78">
                {article.lead}
              </p>

              <div className="mt-12 space-y-12">
                {article.sections.map((section, index) => (
                  <section
                    id={sectionId(index)}
                    key={`${index}-${section.title}`}
                    className="scroll-mt-28 border-l border-white/12 pl-5 sm:pl-7"
                  >
                    <p className="font-mono text-sm font-bold text-steel-orange">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
                      {section.title}
                    </h2>

                    {section.paragraphs?.map((paragraph, paragraphIndex) => (
                      <p
                        key={`${paragraphIndex}-${paragraph.slice(0, 28)}`}
                        className="mt-5 max-w-4xl text-base leading-8 text-white/68"
                      >
                        {paragraph}
                      </p>
                    ))}

                    {section.newsItems?.length ? (
                      <div className="mt-7 grid gap-5">
                        {section.newsItems.map((item, itemIndex) => (
                          <div
                            key={item.title}
                            className="border border-white/12 bg-[#111519] p-5 sm:p-7"
                          >
                            <div className="flex items-start gap-4">
                              <span className="font-mono text-sm font-bold text-steel-orange">
                                {String(itemIndex + 1).padStart(2, "0")}
                              </span>
                              <h3 className="text-lg font-semibold leading-snug text-white sm:text-xl">
                                {item.title}
                              </h3>
                            </div>
                            <dl className="mt-6 grid gap-5">
                              <div>
                                <dt className="text-[10px] font-bold uppercase tracking-[.13em] text-steel-orange">
                                  Краткое описание
                                </dt>
                                <dd className="mt-2 text-sm leading-7 text-white/66">{item.summary}</dd>
                              </div>
                              <div>
                                <dt className="text-[10px] font-bold uppercase tracking-[.13em] text-steel-orange">
                                  Почему это важно
                                </dt>
                                <dd className="mt-2 text-sm leading-7 text-white/66">{item.importance}</dd>
                              </div>
                              <div>
                                <dt className="text-[10px] font-bold uppercase tracking-[.13em] text-steel-orange">
                                  Возможные последствия
                                </dt>
                                <dd className="mt-2 text-sm leading-7 text-white/66">{item.consequences}</dd>
                              </div>
                            </dl>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>

              <ArticleCommercialLinks article={article} />

              {article.sources?.length ? (
                <section className="mt-12 border border-white/12 bg-[#111519] p-6 sm:p-8">
                  <p className="eyebrow">Источники и редакционная проверка</p>
                  {article.editorNote ? (
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-white/62">
                      {article.editorNote}
                    </p>
                  ) : null}
                  <div className="mt-6 grid gap-3">
                    {article.sources.map((source, index) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-start gap-4 border-t border-white/10 pt-4 transition hover:border-steel-orange/60"
                      >
                        <span className="font-mono text-sm font-bold text-steel-orange">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>
                          <strong className="block text-sm font-semibold text-white group-hover:text-steel-orange">
                            {source.name}
                          </strong>
                          <span className="mt-1 block text-xs leading-5 text-white/52">
                            {source.title}
                            {source.language ? ` · ${source.language}` : ""}
                          </span>
                        </span>
                        <span className="ml-auto text-steel-orange">↗</span>
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="h-fit border border-white/12 bg-[#111519] p-6 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
              <nav aria-label="Содержание статьи">
                <p className="text-[10px] font-bold uppercase tracking-[.15em] text-steel-orange">
                  Содержание
                </p>
                <ol className="mt-5 space-y-3">
                  {article.sections.map((section, index) => (
                    <li key={`${index}-${section.title}`}>
                      <a
                        href={`#${sectionId(index)}`}
                        className="group grid grid-cols-[28px_minmax(0,1fr)] gap-2 text-xs leading-5 text-white/58 transition hover:text-white"
                      >
                        <span className="font-mono font-bold text-steel-orange">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>{section.title}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>

              <div className="mt-7 border-t border-white/12 pt-7">
                <p className="text-[10px] font-bold uppercase tracking-[.15em] text-steel-orange">
                  Чек-лист для запроса
                </p>
                <ul className="mt-5 space-y-3">
                  {article.checklist.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-5 text-white/70">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-steel-orange" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/contacts#contact-form"
                className="clip-corner mt-7 block bg-steel-orange px-5 py-4 text-center text-xs font-bold uppercase transition hover:bg-orange-600"
              >
                Получить расчёт&nbsp; →
              </Link>
            </aside>
          </div>
        </article>

        <section className="border-t border-white/10 bg-[#151719] py-12">
          <div className="container flex flex-col justify-between gap-6 border border-white/12 bg-[#101214] p-7 sm:flex-row sm:items-center">
            <div>
              <p className="eyebrow">Связанное решение</p>
              <h2 className="mt-3 text-2xl font-semibold">Нужна консультация по вашему проекту?</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/60">
                Получим исходные данные, проверим задачу и предложим следующий технический шаг.
              </p>
            </div>
            <Link href={article.related.href} className="shrink-0 text-xs font-bold uppercase text-steel-orange">
              {article.related.label}&nbsp; →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
