import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { solutions } from "@/data/solutions";
import { createPageMetadata } from "@/lib/seo";
import { faqSchema, itemListSchema } from "@/lib/schema";

export const metadata: Metadata = createPageMetadata({
  title: "Инженерные решения из листового металла",
  description:
    "Архитектурные, климатические, промышленные и инженерные решения из листового металла: проектирование, производство по чертежам и поставка по России.",
  path: "/solutions",
  keywords: [
    "инженерные решения из листового металла",
    "металлоизделия на заказ",
    "производство по чертежам",
    "металлоизделия для промышленности",
    "контрактное производство изделий",
  ],
});

const faqItems = [
  { question: "Как выбрать подходящий раздел решений?", answer: "Для фасадов и архитектурных элементов откройте каталог продукции, для корпусов и оборудования — промышленное направление, для кронштейнов и опор — инженерные системы. Нестандартные изделия ведём как индивидуальный проект." },
  { question: "Можно заказать только изготовление по готовым чертежам?", answer: "Да. Работаем по КД заказчика, DXF, DWG, STEP и спецификациям. При необходимости инженер проверит технологичность до запуска." },
  { question: "Можно объединить несколько изделий в одну поставку?", answer: "Да. Состав решения можно комплектовать по узлам, зонам объекта или сборочным единицам с согласованной маркировкой и упаковкой." },
];

export default function SolutionsPage() {
  return (
    <>
    <JsonLd data={[itemListSchema({ name: "Инженерные решения из листового металла", description: "Решения для архитектуры, климатического оборудования, промышленности и инженерной инфраструктуры.", path: "/solutions", items: solutions.map((solution) => ({ name: solution.title, path: solution.href })) }), faqSchema(faqItems)]} />
    <PageLayout
      path="/solutions"
      eyebrow="Решения"
      title="Инженерные решения из листового металла"
      description="Готовые решения и производство изделий по техническому заданию для строительства, промышленности и инженерной инфраструктуры."
      image="/images/web/hero-main.webp"
    >
      <section className="bg-[#0c1013] py-14">
        <div className="container grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {solutions.map((solution, index) => (
            <article
              key={solution.title}
              className="border border-white/10 bg-[#111519] p-6"
            >
              <div className={`solution-media relative -mx-6 -mt-6 mb-6 aspect-video overflow-hidden ${solution.imageClassName ?? ""}`}>
                <Image
                  src={solution.image}
                  alt={`${solution.title} — решения из листового металла`}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
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
      <FaqSection items={faqItems} title="Вопросы об инженерных решениях" />
    </PageLayout>
    </>
  );
}
