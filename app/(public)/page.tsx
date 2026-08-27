import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { ProductionCycle } from "@/components/ProductionCycle";
import { semanticKeywords } from "@/data/semantic";
import {
  customerMaterialSummary,
  productionLeadTimeSummary,
  productionEquipment,
} from "@/data/manufacturing-facts";
import { solutions } from "@/data/solutions";
import { faqSchema, webPageSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Инженерные решения из листового металла",
  description:
    "Производство полного цикла изделий из листового металла по КД: инженерная подготовка, лазерный раскрой, гибка, сварка, окраска, контроль и поставка по России.",
  path: "/",
  keywords: [
    ...semanticKeywords.core,
    ...semanticKeywords.production.slice(0, 3),
  ],
});

const cycle = [
  ["Инженерно-конструкторская подготовка", "design.jpg"],
  ["Раскрой металла", "laser-cutting.jpg"],
  ["Гибка", "bending.jpg"],
  ["Сварка и сборка", "welding.jpg"],
  ["Порошковая окраска", "powder-coating.jpg"],
  ["Контроль качества", "quality-control.jpg"],
  ["Упаковка и доставка", "packaging-shipping.jpg"],
] as const;
const benefits = [
  [
    "Весь цикл — в одном производственном контуре",
    "Инженерная подготовка, раскрой, гибка, сварка, сборка, очистка, окраска, контроль, комплектация и упаковка связаны в единый маршрут",
  ],
  [
    "Инженерия до запуска в цех",
    "Проверяем КД и технологичность конструкции, уточняем критичные параметры и только после этого передаём изделие в производство",
  ],
  [
    "Согласованный образец — основа серии",
    "Отрабатываем конструкцию на первом изделии, фиксируем согласованное исполнение и используем его как основу для последующих партий",
  ],
  [
    "Срок рассчитываем по заказу",
    "Учитываем КД, материал, объём партии и состав операций. Срок изготовления подтверждаем после инженерной проверки исходных данных",
  ],
  [
    "Работаем с материалом заказчика",
    "Принимаем давальческое сырьё, проводим входной контроль и подтверждаем пригодность материала до запуска в производство",
  ],
];
const projects = [
  { title: "Жилые комплексы", href: "/industries/zhilye-kompleksy", image: "/images/industries/residential.jpg" },
  { title: "Бизнес-центры", href: "/industries/biznes-centry", image: "/images/industries/business-center.jpg" },
  { title: "Торговые центры", href: "/industries/torgovye-centry", image: "/images/industries/shopping-center.jpg" },
  { title: "Производственные предприятия", href: "/industries/proizvodstvennye-predpriyatiya", image: "/images/industries/production.jpg" },
  { title: "Инженерная инфраструктура", href: "/industries/inzhenernaya-infrastruktura", image: "/images/industries/infrastructure.jpg" },
] as const;
const solutionCardImages: Record<string, { src: string; position?: string }> = {
  "Архитектурные решения": { src: "/images/industry/cards/architecture.webp" },
  "Решения для кондиционирования": {
    src: "/images/industry/cards/climate.webp",
    position: "center 48%",
  },
  "Решения для промышленности": { src: "/images/industry/cards/industry.webp" },
  "Инженерные системы": { src: "/images/industry/cards/engineering.webp" },
  "Индивидуальные решения": { src: "/images/industry/cards/custom.webp" },
};

const homeFaq = [
  { question: "Что производит компания «Сталь Продукт»?", answer: "Проектируем и изготавливаем фасадные элементы, металлокассеты, корпуса, шкафы, кожухи, рамы, кронштейны и нестандартные изделия из листового металла для строительства и промышленности." },
  { question: "Можно заказать металлоизделие по своему чертежу?", answer: "Да. Принимаем КД, PDF, DXF, DWG, STEP, 3D-модели, эскизы и технические задания. Перед запуском проверяем технологичность конструкции и состав исходных данных." },
  { question: "Выполняете полный цикл производства?", answer: `Да. В единый маршрут могут входить инженерно-конструкторская подготовка, ${productionEquipment.laserComplexes} лазерных комплекса, ${productionEquipment.pressBrakes} листогибочных комплекса и ${productionEquipment.panelBenders} панельгиб, слесарно-доводочные операции, ${productionEquipment.weldingStations} сварочных поста, сборочное производство, дробеструйная и лазерная очистка, ${productionEquipment.powderCoatingBooths} камеры порошковой окраски, контроль качества, комплектация, упаковка и отгрузка.` },
  { question: "Какой средний срок изготовления?", answer: productionLeadTimeSummary },
  { question: "Можно работать с металлом заказчика?", answer: customerMaterialSummary },
  { question: "Как заказать расчёт стоимости?", answer: "Приложите чертежи, укажите материал, количество и требования к покрытию. Подтвердим получение материалов и после инженерной проверки сообщим срок подготовки предложения." },
];

export default function Home() {
  return (
    <div className="type-pilot">
      <JsonLd
        data={[webPageSchema({
          name: "Сталь Продукт — инженерные решения из листового металла",
          description:
            "Проектирование, производство и поставка изделий из листового металла для строительства, промышленности и инженерной инфраструктуры.",
          path: "/",
        }), faqSchema(homeFaq)]}
      />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <section id="solutions" className="bg-[#0c1013] py-14">
          <div className="container">
            <h2 className="text-center text-2xl font-semibold uppercase tracking-wide sm:text-3xl">
              Решения для ваших задач
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {solutions.map((solution, index) => {
                const cardImage = solutionCardImages[solution.title];
                return (
                  <Link
                    key={solution.title}
                    href={solution.href}
                    className="group min-h-[250px] border border-white/15 bg-[#111519] p-5 transition hover:border-steel-orange hover:bg-[#15191c]"
                  >
                    <div
                      className={`relative -mx-5 -mt-5 mb-5 aspect-video overflow-hidden bg-[#192026] ${solution.imageClassName ?? ""}`}
                    >
                      <Image
                        src={cardImage.src}
                        alt={`${solution.title} — изделия из листового металла`}
                        fill
                        priority={index === 0}
                        sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 20vw"
                        style={{ objectPosition: cardImage.position }}
                        className="object-cover brightness-[1.06] contrast-[1.02] saturate-[1.04] transition duration-500 group-hover:scale-[1.035] group-hover:brightness-[1.14]"
                      />
                    </div>
                    <p className="text-lg text-steel-orange">{solution.icon}</p>
                    <h3 className="mt-3 text-sm font-bold uppercase leading-tight">
                      {solution.shortTitle}
                    </h3>
                    <p className="mt-3 text-[13px] leading-relaxed text-white/55">
                      {solution.text}
                    </p>
                    <span className="mt-5 block text-xs font-bold uppercase text-steel-orange">
                      Перейти к решениям&nbsp; →
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
        <section
          id="production"
          className="border-y border-white/10 bg-[#101112] py-12"
        >
          <div className="container">
            <h2 className="text-center text-2xl font-semibold uppercase">
              Полный цикл изготовления
            </h2>
            <div className="mt-8 grid gap-px overflow-hidden border border-white/10 bg-white/10">
              <ProductionCycle stages={cycle} />
            </div>
          </div>
        </section>
        <section className="bg-[#0c1013] py-14">
          <div className="container">
            <h2 className="text-center text-2xl font-semibold uppercase">
              Почему выбирают «Сталь Продукт»
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {benefits.map(([title, text], index) => (
                <article
                  key={title}
                  className="border border-white/10 bg-[#111519] p-5"
                >
                  <span className="text-2xl text-steel-orange">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-5 text-sm font-bold uppercase">{title}</h3>
                  <p className="mt-3 text-[13px] leading-relaxed text-white/55">
                    {text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section
          id="projects"
          className="border-y border-white/10 bg-[#101112] py-12"
        >
          <div className="container">
            <div className="flex items-center justify-between gap-6">
              <h2 className="text-2xl font-semibold uppercase">
                Решения для типовых объектов
              </h2>
              <Link
                href="/projects"
                className="text-[13px] font-bold uppercase text-steel-orange"
              >
                Смотреть проектные сценарии&nbsp; →
              </Link>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {projects.map((project, index) => (
                <Link
                  href={project.href}
                  key={project.title}
                  className="overflow-hidden border border-white/10 bg-[#111519] transition hover:border-steel-orange"
                >
                  <div className="relative aspect-video overflow-hidden bg-[#192026]">
                    <Image
                      src={project.image}
                      fill
                      alt={`${project.title} — типовой сценарий применения металлоизделий`}
                      sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 20vw"
                      style={{ objectPosition: `${15 + index * 20}% 42%` }}
                      className="object-cover brightness-[1.07] contrast-[1.01] saturate-[1.02]"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-bold">{project.title}</h3>
                    <p className="mt-1 text-xs text-white/50">Типовой состав решения и исходные данные</p>
                    <span className="mt-4 block text-xs text-steel-orange">
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section className="bg-[#17191a] py-9">
          <div className="container grid gap-7 lg:grid-cols-[1.35fr_repeat(6,1fr)] lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold uppercase leading-tight">
                Готовы обсудить
                <br />
                ваш проект?
              </h2>
              <p className="mt-3 text-[13px] text-white/55">
                Передайте чертёж и параметры партии. Проверим технологичность,
                уточним маршрут, срок и стоимость.
              </p>
              <Link
                className="mt-5 inline-block bg-steel-orange px-5 py-3 text-[13px] font-bold uppercase"
                href="/contacts#contact-form"
              >
                Получить расчёт&nbsp; →
              </Link>
            </div>
            {[
              ["2000+", "м² производственных площадей"],
              ["70+", "опытных специалистов"],
              [`${productionEquipment.laserComplexes}`, "лазерных комплекса"],
              [`${productionEquipment.pressBrakes}`, "листогибочных комплекса"],
              [`${productionEquipment.weldingStations}`, "сварочных поста"],
              [`${productionEquipment.powderCoatingBooths}`, "камеры порошковой окраски"],
            ].map(([value, label]) => (
              <div key={label} className="border-l border-white/10 pl-5">
                <b className="text-3xl text-steel-orange">{value}</b>
                <p className="mt-1 text-xs uppercase leading-relaxed text-white/50">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>
        <FaqSection items={homeFaq} title="Вопросы о производстве на заказ" />
      </main>
      <Footer />
    </div>
  );
}
