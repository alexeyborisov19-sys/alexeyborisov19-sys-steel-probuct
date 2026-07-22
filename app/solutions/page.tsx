import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { solutions } from "@/data/solutions";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Инженерные решения из листового металла",
  description:
    "Архитектурные, климатические, промышленные и инженерные решения из листового металла. Проектирование, производство, контроль качества и поставка.",
  path: "/solutions",
  keywords: [
    "инженерные решения из листового металла",
    "металлоизделия на заказ",
    "производство по чертежам",
  ],
});

export default function SolutionsPage() {
  return (
    <PageLayout
      path="/solutions"
      eyebrow="Решения"
      title="Инженерные решения из листового металла"
      description="Готовые решения и производство изделий по техническому заданию для строительства, промышленности и инженерной инфраструктуры."
      image="/images/web/hero-main.jpg"
    >
      <section className="bg-[#0c1013] py-14">
        <div className="container grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {solutions.map((solution, index) => (
            <article
              key={solution.title}
              className="border border-white/10 bg-[#111519] p-6"
            >
              <div
                className={`solution-media -mx-6 -mt-6 mb-6 aspect-video ${solution.imageClassName ?? ""}`}
                style={{ backgroundImage: `url('${solution.image}')` }}
              />
              <span className="text-2xl text-steel-orange">
                {solution.icon}
              </span>
              <h2 className="mt-3 text-xl font-semibold uppercase">
                {solution.title}
              </h2>
              <p className="mt-4 min-h-14 text-sm leading-relaxed text-white/60">
                {solution.text}
              </p>
              <ul className="mt-5 border-t border-white/10">
                {solution.items.slice(0, 5).map((item) => (
                  <li key={item} className="border-b border-white/10 text-sm">
                    <Link
                      href={solution.href}
                      className="flex items-center justify-between py-3 transition hover:text-steel-orange"
                    >
                      <span>{item}</span>
                      <span className="text-steel-orange">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={solution.href}
                className="mt-6 inline-block border border-steel-orange px-4 py-3 text-xs font-bold uppercase text-steel-orange"
              >
                Перейти в раздел&nbsp; →
              </Link>
              {index === 0 && (
                <a
                  href="/documents/katalog-fasadnyh-resheniy-stal-produkt.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-4 mt-6 inline-block text-xs font-bold uppercase text-white/55 transition hover:text-steel-orange"
                >
                  PDF-каталог&nbsp; ↗
                </a>
              )}
            </article>
          ))}
        </div>
      </section>
    </PageLayout>
  );
}
