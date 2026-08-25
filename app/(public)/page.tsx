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
  laserCuttingCapabilities,
  productionLeadTimeSummary,
  productionOrderConditions,
} from "@/data/manufacturing-facts";
import { solutions } from "@/data/solutions";
import { faqSchema, webPageSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Инженерные решения из листового металла",
  description:
    `Изделия из листового металла по чертежам. Лазерная резка чёрной стали ${laserCuttingCapabilities.thicknessRange}, стол ${laserCuttingCapabilities.tableWorkingArea}, полный производственный цикл.`,
  path: "/",
  keywords: [
    ...semanticKeywords.core,
    ...semanticKeywords.production.slice(0, 3),
  ],
});

const cycle = [
  ["Проектирование", "design.jpg"],
  ["Раскрой металла", "laser-cutting.jpg"],
  ["Гибка", "bending.jpg"],
  ["Сварка и сборка", "welding.jpg"],
  ["Порошковая окраска", "powder-coating.jpg"],
  ["Контроль качества", "quality-control.jpg"],
  ["Упаковка и доставка", "packaging-shipping.jpg"],
] as const;
const benefits = [
  [
    "Проверяемая технология",
    "До запуска проверяем материал, геометрию, последовательность операций и контрольные размеры",
  ],
  [
    "Инженерный подход",
    "Связываем КД, раскрой, гибку, сварку и покрытие в единый производственный маршрут",
  ],
  [
    "Контроль качества",
    "Фиксируем критические параметры и контролируем первую деталь, комплектность и упаковку",
  ],
  ["Срок по маршруту", `Средний производственный срок — ${productionOrderConditions.typicalLeadTime}; точную дату подтверждаем после проверки заказа`],
  ["Материал заказчика", "Принимаем давальческое сырьё после входного контроля и подтверждения его пригодности"],
];
const projects = [
  "Жилые комплексы",
  "Бизнес-центры",
  "Торговые объекты",
  "Промышленные предприятия",
  "Инженерная инфраструктура",
];
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
  { question: "Выполняете полный цикл производства?", answer: "Да. В единый маршрут могут входить инженерная подготовка, лазерный раскрой, гибка на ЧПУ, сварка и сборка, порошковая окраска, контроль, упаковка и отгрузка." },
  { question: "Какие возможности лазерной резки чёрной стали?", answer: `Рабочий диапазон по толщине — ${laserCuttingCapabilities.thicknessRange}, рабочее поле стола — ${laserCuttingCapabilities.tableWorkingArea}. Возможность изготовления конкретной детали подтверждаем по марке стали, геометрии и требованиям к кромке.` },
  { question: "Какой средний срок изготовления?", answer: productionLeadTimeSummary },
  { question: "Можно работать с металлом заказчика?", answer: customerMaterialSummary },
  { question: "Как заказать расчёт стоимости?", answer: "Приложите чертежи, укажите материал, количество и требования к покрытию. Подтвердим получение материалов и после инженерной проверки сообщим срок подготовки предложения." },
];

export default function Home() {
  return (
    <>
      <JsonLd
        data={[webPageSchema({
          name: "Сталь Продукт — инженерные решения из листового металла",
          description:
            "Проектирование, производство и поставка изделий из листового металла для строительства, промышленности и инженерной инфраструктуры.",
          path: "/",
        }), faqSchema(homeFaq)]}
      />
      <Header />
      <main>
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
                    <p className="mt-3 text-[11px] leading-relaxed text-white/55">
                      {solution.text}
                    </p>
                    <span className="mt-5 block text-[10px] font-bold uppercase text-steel-orange">
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
                  <h3 className="mt-5 text-xs font-bold uppercase">{title}</h3>
                  <p className="mt-3 text-[11px] leading-relaxed text-white/55">
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
                className="text-xs font-bold uppercase text-steel-orange"
              >
                Смотреть проектные сценарии&nbsp; →
              </Link>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {projects.map((project, index) => (
                <Link
                  href="/projects"
                  key={project}
                  className="overflow-hidden border border-white/10 bg-[#111519] transition hover:border-steel-orange"
                >
                  <div className="relative aspect-video overflow-hidden bg-[#192026]">
                    <Image
                      src={index % 2 ? "/images/web/hero-main.webp" : "/images/web/project-residential.jpg"}
                      fill
                      alt={`${project} — объект с металлоизделиями «Сталь Продукт»`}
                      sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 20vw"
                      style={{ objectPosition: `${15 + index * 20}% 42%` }}
                      className="object-cover brightness-[1.07] contrast-[1.01] saturate-[1.02]"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-xs font-bold">{project}</h3>
                    <p className="mt-1 text-[10px] text-white/50">Типовой состав и исходные данные</p>
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
          <div className="container grid gap-7 lg:grid-cols-[1.35fr_repeat(5,1fr)] lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold uppercase leading-tight">
                Готовы обсудить
                <br />
                ваш проект?
              </h2>
              <p className="mt-3 text-xs text-white/55">
                Передайте чертёж и параметры партии. Проверим технологичность,
                уточним маршрут, срок и стоимость.
              </p>
              <Link
                className="mt-5 inline-block bg-steel-orange px-5 py-3 text-xs font-bold uppercase"
                href="/contacts#contact-form"
              >
                Получить расчёт&nbsp; →
              </Link>
            </div>
            {[
              ["2000+", "м² производственных площадей"],
              ["70+", "опытных специалистов"],
              ["3", "лазерных комплекса"],
              ["4", "листогибочных комплекса"],
              ["Система", "контроля качества"],
            ].map(([value, label]) => (
              <div key={label} className="border-l border-white/10 pl-5">
                <b className="text-3xl text-steel-orange">{value}</b>
                <p className="mt-1 text-[10px] uppercase leading-relaxed text-white/50">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>
        <FaqSection items={homeFaq} title="Вопросы о производстве на заказ" />
      </main>
      <Footer />
    </>
  );
}
