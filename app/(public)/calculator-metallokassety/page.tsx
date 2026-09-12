import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { MetalCassetteCalculator } from "@/components/MetalCassetteCalculator";
import { PageLayout } from "@/components/PageLayout";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";
import { absoluteUrl, siteConfig } from "@/lib/site";

const path = "/calculator-metallokassety";
const title = "Калькулятор металлокассет — цена";
const description = "Получите предварительную оценку количества и стоимости фасадных металлокассет по площади или размерам стены: открытый и закрытый тип, толщины 0,65–1,2 мм.";

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path,
  keywords: [
    "калькулятор металлокассет",
    "цена металлокассет",
    "расчет металлокассет онлайн",
    "расчет количества фасадных кассет",
    "сколько металлокассет нужно на фасад",
    "расчет металлокассет по размерам стены",
    "металлокассеты открытого типа цена",
    "металлокассеты закрытого типа цена",
    "фасадные кассеты цена за м2",
  ],
});

const faqItems = [
  {
    question: "Что умеет калькулятор металлокассет?",
    answer: "Он даёт предварительную оценку количества и стоимости в двух режимах: по площади фасада или по ширине и высоте стены. Для стены можно отдельно указать суммарную площадь окон и дверей.",
  },
  {
    question: "Можно ли изменить цену за квадратный метр?",
    answer: "Да. Для каждого типа и толщины калькулятор подставляет базовую ставку по умолчанию. Её можно изменить вручную для конкретного предварительного расчёта или вернуть кнопкой к базовому значению.",
  },
  {
    question: "Как учитываются русты у открытой кассеты?",
    answer: "При расчёте стены учитываются только швы между соседними кассетами. Дополнительный руст после последней кассеты в ряду или колонне не добавляется.",
  },
  {
    question: "Как учитывается закрытый тип?",
    answer: "Для закрытого типа используется отдельный рабочий шаг рядов: горизонтальный стык формируется замковой геометрией, поэтому его нельзя считать как открытую кассету с дополнительным вертикальным рустом.",
  },
  {
    question: "Какие толщины доступны в калькуляторе?",
    answer: "В публичном расчёте доступны 0,65; 0,7; 1,0 и 1,2 мм. Итоговая толщина подтверждается по проекту и требованиям к конкретной кассете.",
  },
  {
    question: "Насколько точна показанная цена?",
    answer: "Это ориентир для первичной оценки бюджета. Финальная стоимость подтверждается после проверки раскладки, размеров, покрытия, цвета, углов, проёмов, доборных элементов и объёма партии.",
  },
  {
    question: "Почему калькулятор не выдаёт DXF и развёртку?",
    answer: "Публичный калькулятор предназначен для заказчика и показывает только коммерчески полезный результат. Производственная геометрия, развёртки и DXF формируются после инженерной проверки заказа.",
  },
];

const calculatorSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Калькулятор фасадных металлокассет",
  description,
  url: absoluteUrl(path),
  applicationCategory: "BusinessApplication",
  operatingSystem: "Любая платформа",
  browserRequirements: "Современный веб-браузер с поддержкой JavaScript",
  isAccessibleForFree: true,
  inLanguage: "ru-RU",
  featureList: [
    "Оценка количества металлокассет по площади фасада",
    "Расчёт по ширине и высоте стены",
    "Открытый и закрытый тип металлокассет",
    "Редактируемая цена за квадратный метр с базовыми значениями по умолчанию",
    "Предварительная оценка стоимости",
    "Толщины 0,65; 0,7; 1,0 и 1,2 мм",
  ],
  provider: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
};

export default function MetalCassetteCalculatorPage() {
  return (
    <>
      <JsonLd data={[
        calculatorSchema,
        breadcrumbSchema([
          { name: "Главная", path: "/" },
          { name: "Металлокассеты", path: "/products/metallokassety" },
          { name: "Калькулятор металлокассет", path },
        ]),
        faqSchema(faqItems),
      ]} />
      <PageLayout
        path={path}
        eyebrow="Цена и количество"
        title="Калькулятор металлокассет"
        description="Быстрая оценка фасада по площади или габаритам стены. Выберите открытый или закрытый тип, толщину металла и получите ориентировочное количество и бюджет."
        image="/images/web/hero-main.webp"
      >
        <section className="bg-[#0c1013] pb-16 pt-1 sm:pb-20">
          <div className="container">
            <MetalCassetteCalculator />

            <div className="mt-14 grid gap-4 lg:grid-cols-3">
              <article className="border border-white/12 bg-[#111519] p-6">
                <span className="text-2xl font-semibold text-steel-orange">01</span>
                <h2 className="mt-4 text-xl font-semibold uppercase">По площади — быстро</h2>
                <p className="mt-3 text-sm leading-7 text-white/60">Подходит для первого бюджета, когда известна только площадь облицовки. Количество оценивается по типовому модулю.</p>
              </article>
              <article className="border border-white/12 bg-[#111519] p-6">
                <span className="text-2xl font-semibold text-steel-orange">02</span>
                <h2 className="mt-4 text-xl font-semibold uppercase">По стене — точнее</h2>
                <p className="mt-3 text-sm leading-7 text-white/60">Ширина и высота позволяют считать целые ряды и колонны. Для открытого типа корректно учитываются межкассетные русты, для закрытого — рабочий шаг замка.</p>
              </article>
              <article className="border border-white/12 bg-[#111519] p-6">
                <span className="text-2xl font-semibold text-steel-orange">03</span>
                <h2 className="mt-4 text-xl font-semibold uppercase">Проект — финально</h2>
                <p className="mt-3 text-sm leading-7 text-white/60">Окна, углы, примыкания и доборы влияют на раскладку. Финальная спецификация и цена подтверждаются после проверки проекта.</p>
              </article>
            </div>

            <div className="mt-14 grid gap-5 border-y border-white/12 py-8 lg:grid-cols-[.8fr_1.2fr]">
              <div>
                <p className="eyebrow">Почему расчёт отличается</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Площадь стены — не вся математика фасада</h2>
              </div>
              <div className="space-y-4 text-sm leading-7 text-white/62">
                <p>У открытых кассет между соседними элементами остаётся архитектурный руст. У закрытых горизонтальный стык формируется замком, поэтому механически переносить формулу открытого типа нельзя.</p>
                <p>Проёмы тоже нельзя полностью описать одной цифрой: одинаковая площадь окон при разном положении даёт разную подрезку и разное количество целых кассет. Поэтому калькулятор показывает бюджетный ориентир, а не подменяет фасадную раскладку.</p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link href="/articles/ploshchad-fasada-raskhod-metalla-metallokassety" className="text-xs font-bold uppercase text-steel-orange">Как считается расход металла&nbsp; →</Link>
                  <Link href="/articles/uzly-fasada-metallokassety" className="text-xs font-bold uppercase text-steel-orange">Какие узлы проверить&nbsp; →</Link>
                </div>
              </div>
            </div>

            <section className="mt-14">
              <p className="eyebrow">Вопросы и ответы</p>
              <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">О расчёте металлокассет</h2>
              <div className="mt-6 grid gap-3">
                {faqItems.map((item) => (
                  <details key={item.question} className="group border border-white/12 bg-[#111519]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-5 px-5 py-5 text-sm font-semibold sm:text-base">
                      {item.question}<span className="text-2xl font-light text-steel-orange transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="border-t border-white/10 px-5 py-5 text-sm leading-7 text-white/60">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>

            <div className="mt-12 border border-steel-orange/40 bg-gradient-to-r from-steel-orange/15 to-transparent p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
              <div>
                <p className="text-xl font-semibold uppercase">Нужен точный расчёт?</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Прикрепите фасадную раскладку, чертёж или спецификацию. Проверим геометрию и подготовим коммерческое предложение.</p>
              </div>
              <div className="mt-5 flex shrink-0 flex-wrap gap-3 sm:mt-0">
                <Link href="/products/metallokassety" className="border border-white/25 px-5 py-4 text-xs font-bold uppercase transition hover:border-steel-orange">Каталог кассет&nbsp; →</Link>
                <Link href="/contacts#contact-form" className="clip-corner bg-steel-orange-deep px-6 py-4 text-xs font-bold uppercase">Получить расчёт&nbsp; →</Link>
              </div>
            </div>
          </div>
        </section>
      </PageLayout>
    </>
  );
}
