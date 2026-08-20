import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
import { PageLayout } from "@/components/PageLayout";
import { getIndustrySolutions, industryVisualByTitle } from "@/lib/industry-solutions";
import { faqSchema, itemListSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Решения для отраслей и объектов",
  description:
    "Изделия из листового металла для строительства, машиностроения, энергетики, фармацевтики, ЦОД и производственных предприятий по всей России.",
  path: "/industries",
  keywords: [
    "металлоизделия для строительства",
    "фасадные решения",
    "корпуса оборудования",
    "инженерные системы",
    "металлоизделия для машиностроения",
    "корпуса для энергетики и автоматизации",
  ],
});

const faqItems = [
  { question: "Для каких отраслей производите металлоизделия?", answer: "Страницы охватывают строительство, производственные предприятия, машиностроение, энергетику, фармацевтику, пищевую промышленность, ЦОД, транспорт и инженерную инфраструктуру. Состав изделия всегда уточняется по проекту." },
  { question: "Можно получить перечень изделий под конкретный объект?", answer: "Да. Передайте спецификацию, чертежи или описание функциональных зон — подготовим состав поставки и отметим данные, необходимые для расчёта." },
  { question: "Поставляете продукцию в Москву и другие регионы?", answer: "Производство находится в Смоленске. Упаковку и логистику согласуем для Москвы, Московской области, ЦФО и других регионов России с учётом габаритов и комплектации заказа." },
];

export default function IndustriesPage() {
  const industries = getIndustrySolutions();

  return (
    <>
    <JsonLd data={[itemListSchema({
      name: "Решения из листового металла по отраслям и типам объектов",
      description: "Отраслевые комплекты металлоизделий для строительства, промышленности и инженерной инфраструктуры.",
      path: "/industries",
      items: industries.map((industry) => ({
        name: industry.title,
        path: `/industries/${industry.slug}`,
      })),
    }), faqSchema(faqItems)]} />
    <PageLayout
      path="/industries"
      eyebrow="Решения для объектов"
      title="Решения для отраслей и объектов"
      description="Комплексные решения из листового металла для строительства, промышленности и инженерной инфраструктуры. Выберите направление и ознакомьтесь с составом поставки для конкретного объекта."
      image="/images/web/hero-main.webp"
    >
      <section className="bg-[#0c1013] py-14 sm:py-20">
        <div className="container">
          <div className="flex flex-wrap gap-3">
            <Link href="/contacts#contact-form" className="bg-steel-orange px-5 py-3 text-xs font-bold uppercase">
              Получить расчёт&nbsp; →
            </Link>
            <Link href="/production" className="border border-white/30 px-5 py-3 text-xs font-bold uppercase">
              Посмотреть производство&nbsp; →
            </Link>
          </div>

          <div className="mt-12 border-y border-white/15 py-7 sm:flex sm:items-end sm:justify-between sm:gap-10">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-steel-orange">Матрица производственных возможностей</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Что можем изготовить для вашего объекта</h2>
              <p className="mt-4 text-sm leading-6 text-white/65">Для каждой сферы собрали перечень изделий по функциональным зонам: от фасада и инженерии до технических помещений, безопасности и благоустройства.</p>
            </div>
            <p className="mt-5 border-l-2 border-steel-orange pl-4 text-sm leading-5 text-white/70 sm:mt-0 sm:max-w-56">Откройте карточку — получите полный состав решения, сгруппированный по зонам объекта.</p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {industries.map((industry, index) => {
              const itemsCount = industry.sections.reduce((total, section) => total + section.items.length, 0);
              const visual = industryVisualByTitle[industry.title] ?? "hero-main.jpg";

              return (
                <article key={industry.title} className="overflow-hidden border border-white/15 bg-[#111519] shadow-[0_18px_45px_rgba(0,0,0,.16)]">
                  <div className="solution-media relative aspect-[16/6] overflow-hidden border-b border-white/10">
                    <img
                      src={`/images/industries/${visual}`}
                      alt={`${industry.title} — решения из листового металла`}
                      width={1600}
                      height={600}
                      loading={index < 2 ? "eager" : "lazy"}
                      fetchPriority={index < 2 ? "high" : "auto"}
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0c1013]/80 via-transparent to-transparent" />
                    <span className="absolute left-5 top-5 border border-steel-orange/70 px-2 py-1 text-[10px] font-bold tracking-[.14em] text-steel-orange">{String(index + 1).padStart(2, "0")}</span>
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="max-w-[75%] text-2xl font-semibold leading-tight sm:text-[28px]">{industry.title}</h2>
                      <span className="hidden h-9 w-9 shrink-0 items-center justify-center border border-steel-orange/45 text-lg text-steel-orange sm:flex">↗</span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 border-y border-white/10 py-4">
                      <div className="border-r border-white/10 pr-3"><p className="text-xl font-semibold text-steel-orange">{industry.sections.length}</p><p className="mt-1 text-[10px] uppercase tracking-[.08em] text-white/50">разделов</p></div>
                      <div className="pl-3"><p className="text-xl font-semibold text-steel-orange">{itemsCount}</p><p className="mt-1 text-[10px] uppercase tracking-[.08em] text-white/50">изделий</p></div>
                    </div>

                    <details className="group mt-5" open={index === 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border border-white/15 bg-[#0c1013] px-4 py-3 text-xs font-bold uppercase tracking-[.04em] transition hover:border-steel-orange/70">
                        Матрица изделий для объекта
                        <span className="text-xl leading-none text-steel-orange transition group-open:rotate-45">+</span>
                      </summary>
                      <div className="border-x border-b border-white/15 bg-[#0e1215]">
                        {industry.sections.map((section, sectionIndex) => (
                          <section key={section.title} className="grid border-b border-white/10 last:border-b-0 md:grid-cols-[minmax(190px,30%)_1fr]">
                            <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-white/[.025] px-4 py-4 md:border-b-0 md:border-r md:border-white/10">
                              <h3 className="text-sm font-semibold leading-5">{section.title}</h3>
                              <span className="shrink-0 text-[10px] font-bold text-steel-orange">{String(sectionIndex + 1).padStart(2, "0")}</span>
                            </div>
                            <ul className="grid gap-x-5 gap-y-2 px-4 py-4 sm:grid-cols-2">
                              {section.items.map((item) => (
                                <li key={item} className="flex gap-2 text-[13px] leading-5 text-white/75"><span className="mt-[9px] h-1 w-1 shrink-0 bg-steel-orange" />{item}</li>
                              ))}
                            </ul>
                          </section>
                        ))}
                      </div>
                    </details>

                    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-xs font-bold uppercase">
                      <Link href={`/industries/${industry.slug}`} className="text-white transition hover:text-steel-orange">Открыть страницу отрасли&nbsp; →</Link>
                      <Link href="/contacts#contact-form" className="text-steel-orange transition hover:text-orange-300">Получить состав и расчёт&nbsp; →</Link>
                      <Link href="/projects" className="text-white/65 transition hover:text-white">Посмотреть проекты&nbsp; →</Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-8 border border-steel-orange/40 bg-gradient-to-r from-steel-orange/15 to-transparent px-5 py-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-7">
            <div><p className="text-xl font-semibold">Не нашли нужную позицию?</p><p className="mt-1 text-sm leading-6 text-white/65">Разработаем и изготовим решение по вашему чертежу, спецификации или техническому заданию.</p></div>
            <Link href="/contacts#contact-form" className="mt-5 inline-block shrink-0 bg-steel-orange px-6 py-4 text-xs font-bold uppercase sm:mt-0">Обсудить проект&nbsp; →</Link>
          </div>
        </div>
      </section>
      <FaqSection items={faqItems} title="Вопросы по отраслевым решениям" />
    </PageLayout>
    </>
  );
}
