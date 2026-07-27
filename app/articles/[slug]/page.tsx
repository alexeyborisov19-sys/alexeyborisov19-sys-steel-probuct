import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { InnerHero } from "@/components/InnerHero";
import { JsonLd } from "@/components/JsonLd";
import { articleBySlug, articles } from "@/data/articles";
import { articleSchema, breadcrumbSchema, webPageSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

type ArticlePageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() { return articles.map((article) => ({ slug: article.slug })); }

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const article = articleBySlug[(await params).slug];
  if (!article) return {};
  return createPageMetadata({ title: article.title, description: article.lead, path: `/articles/${article.slug}`, image: article.image, keywords: article.keywords });
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const article = articleBySlug[(await params).slug];
  if (!article) notFound();
  const path = `/articles/${article.slug}`;
  return <><JsonLd data={[webPageSchema({ name: article.title, description: article.lead, path }), breadcrumbSchema([{ name: "Главная", path: "/" }, { name: "Статьи", path: "/articles" }, { name: article.title, path }]), articleSchema({ headline: article.title, description: article.lead, path, image: article.image, datePublished: article.publishedAt, dateModified: article.modifiedAt })]} /><Header /><main>
    <InnerHero eyebrow={article.category} title={article.title} description={article.lead} image={article.image} />
    <article className="bg-[#0c1013] py-14 sm:py-20"><div className="container grid gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div><div className="mb-8 text-xs text-white/45"><Link href="/articles" className="transition hover:text-steel-orange">Статьи</Link><span className="mx-2 text-steel-orange">/</span>{article.category}</div><p className="max-w-3xl text-lg leading-relaxed text-white/78">{article.lead}</p><div className="mt-10 space-y-10">{article.sections.map((section, index) => <section key={section.title} className="border-l border-white/12 pl-5 sm:pl-7"><p className="font-mono text-sm font-bold text-steel-orange">{String(index + 1).padStart(2, "0")}</p><h2 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-5 text-base leading-8 text-white/66">{paragraph}</p>)}</section>)}</div></div>
      <aside className="h-fit border border-white/12 bg-[#111519] p-6 xl:sticky xl:top-24"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-steel-orange">Чек-лист для запроса</p><ul className="mt-5 space-y-3">{article.checklist.map((item) => <li key={item} className="flex gap-3 text-sm leading-5 text-white/70"><span className="mt-2 h-1.5 w-1.5 shrink-0 bg-steel-orange" />{item}</li>)}</ul><Link href="/contacts#contact-form" className="clip-corner mt-7 block bg-steel-orange px-5 py-4 text-center text-xs font-bold uppercase">Получить расчёт&nbsp; →</Link></aside>
    </div></article>
    <section className="border-t border-white/10 bg-[#151719] py-12"><div className="container flex flex-col justify-between gap-6 border border-white/12 bg-[#101214] p-7 sm:flex-row sm:items-center"><div><p className="eyebrow">Связанное решение</p><h2 className="mt-3 text-2xl font-semibold">Нужна консультация по вашему проекту?</h2><p className="mt-3 text-sm leading-relaxed text-white/60">Получим исходные данные, проверим задачу и предложим следующий технический шаг.</p></div><Link href={article.related.href} className="shrink-0 text-xs font-bold uppercase text-steel-orange">{article.related.label}&nbsp; →</Link></div></section>
  </main><Footer /></>;
}
