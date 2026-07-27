import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { articles } from "@/data/articles";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Статьи и инженерная экспертиза",
  description: "Практические материалы о фасадных решениях, производстве изделий из листового металла, порошковой окраске и подготовке чертежей.",
  path: "/articles",
  image: "/images/web/hero-main.jpg",
  keywords: ["статьи о металлоизделиях", "производство листового металла", "инженерные решения"],
});

export default function ArticlesPage() {
  return <PageLayout path="/articles" eyebrow="Экспертиза" title="Статьи о металле, производстве и инженерных решениях" description="Практические материалы для проектировщиков, закупщиков и технических специалистов: без шаблонных обещаний, с фокусом на реальные производственные задачи." image="/images/web/hero-main.jpg">
    <section className="bg-[#0c1013] py-14 sm:py-20">
      <div className="container">
        <div className="flex flex-col justify-between gap-5 border-b border-white/12 pb-6 sm:flex-row sm:items-end">
          <div><p className="eyebrow">База знаний</p><h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">Материалы, которые помогают подготовить задачу к производству</h2></div>
          <p className="max-w-xs text-sm leading-relaxed text-white/55">Новые статьи будут добавляться по мере появления практических вопросов от заказчиков и проектных команд.</p>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {articles.map((article, index) => <article key={article.slug} className="group flex flex-col overflow-hidden border border-white/12 bg-[#111519] transition hover:border-steel-orange/70">
            <div className="relative aspect-[16/9] overflow-hidden"><img src={article.image} alt="" width={960} height={540} loading={index === 0 ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover brightness-[1.1] contrast-[1.02] transition duration-500 group-hover:scale-[1.03]" /><div className="absolute inset-0 bg-gradient-to-t from-[#0c1013]/70 via-transparent to-transparent" /><span className="absolute bottom-4 left-5 border border-steel-orange/60 bg-[#0c1013]/85 px-2 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-steel-orange">{article.category}</span></div>
            <div className="flex flex-1 flex-col p-6"><p className="text-[10px] uppercase tracking-[.12em] text-white/45">{article.readingTime}</p><h2 className="mt-4 text-xl font-semibold leading-tight">{article.title}</h2><p className="mt-4 text-sm leading-relaxed text-white/60">{article.lead}</p><Link href={`/articles/${article.slug}`} className="mt-7 text-xs font-bold uppercase text-steel-orange">Читать статью&nbsp; →</Link></div>
          </article>)}
        </div>
      </div>
    </section>
  </PageLayout>;
}
