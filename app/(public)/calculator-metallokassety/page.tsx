import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { MetalCassetteCalculator } from "@/components/MetalCassetteCalculator";
import { PageLayout } from "@/components/PageLayout";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";
import { absoluteUrl, siteConfig } from "@/lib/site";

const path = "/calculator-metallokassety";
const title = "Калькулятор металлокассет — расчёт стоимости фасада";
const description =
  "Онлайн-калькулятор металлокассет 1170×545 мм с рустом 20 мм. Укажите площадь фасада и толщину металла, чтобы получить ориентировочное количество и стоимость.";

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path,
  keywords: [
    "калькулятор металлокассет",
    "расчет металлокассет онлайн",
    "расчет стоимости фасадных кассет",
    "сколько металлокассет нужно на фасад",
    "цена металлокассет за квадратный метр",
    "металлокассеты 1170х545",
    "металлокассеты с рустом 20 мм",
    "стоимость фасада из металлокассет",
    "фасадные кассеты расчет цены",
    "расчет вентилируемого фасада",
  ],
});

const faqItems = [
  {
    question: "Какой размер металлокассеты используется в расчёте?",
    answer: "Калькулятор настроен на металлокассету размером 1170×545 мм и межкассетный руст 20×20 мм.",
  },
  {
    question: "Какие толщины металла можно рассчитать?",
    answer: "Доступны четыре базовых варианта толщины: 0,5 мм, 0,7 мм, 1,0 мм и 1,2 мм. Для каждого варианта указана ориентировочная стоимость одного квадратного метра.",
  },
  {
    question: "В каких единицах указана стоимость?",
    answer: "Все базовые цены указаны за один квадратный метр металлокассет, а не за одну кассету.",
  },
  {
    question: "Является ли результат точной стоимостью заказа?",
    answer: "Нет. Все значения калькулятора являются ориентировочными. Точный расчёт выполняется специалистом после проверки раскладки фасада, проёмов, углов, покрытия и цвета по RAL.",
  },
  {
    question: "Что не входит в предварительную стоимость?",
    answer: "В расчёт не включены подсистема, крепёж, доборные элементы, упаковка и доставка. Эти позиции рассчитываются отдельно по проекту.",
  },
  {
    question: "Как получить точную раскладку и коммерческое предложение?",
    answer: "Отправьте площадь фасада, чертежи или спецификацию через форму расчёта. Инженер проверит исходные данные и подготовит предложение под объект.",
  },
];

const calculatorSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Калькулятор стоимости металлокассет",
  description,
  url: absoluteUrl(path),
  applicationCategory: "BusinessApplication",
  operatingSystem: "Любая платформа",
  browserRequirements: "Современный веб-браузер с поддержкой JavaScript",
  isAccessibleForFree: true,
  inLanguage: "ru-RU",
  featureList: [
    "Расчёт количества металлокассет по площади фасада",
    "Выбор толщины металла",
    "Ориентировочный расчёт стоимости",
    "Расчёт для кассеты 1170×545 мм с рустом 20 мм",
  ],
  provider: {
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
  },
};

export default function MetalCassetteCalculatorPage() {
  return (
    <>
      <JsonLd
        data={[
          calculatorSchema,
          breadcrumbSchema([
            { name: "Главная", path: "/" },
            { name: "Металлокассеты", path: "/products/metallokassety" },
            { name: "Калькулятор металлокассет", path },
          ]),
          faqSchema(faqItems),
        ]}
      />
      <PageLayout
        path={path}
        eyebrow="Онлайн-расчёт фасада"
        title="Калькулятор металлокассет"
        description="Рассчитайте ориентировочное количество и стоимость фасадных металлокассет 1170×545 мм с рустом 20×20 мм по площади вашего объекта."
        image="/images/web/hero-main.webp"
      >
        <section className="bg-[#0c1013] pb-16 pt-1 sm:pb-20">
          <div className="container">
            <MetalCassetteCalculator />

            <div className="mt-16 grid gap-5 lg:grid-cols-3">
              <article className="border border-white/12 bg-[#111519] p-6">
                <span className="text-2xl font-semibold text-steel-orange">01</span>
                <h2 className="mt-5 text-xl font-semibold uppercase">Для предварительной оценки бюджета</h2>
                <p className="mt-4 text-sm leading-7 text-white/60">
                  Калькулятор помогает быстро определить порядок бюджета до выпуска детальной раскладки фасада и подготовки спецификации.
                </p>
              </article>
              <article className="border border-white/12 bg-[#111519] p-6">
                <span className="text-2xl font-semibold text-steel-orange">02</span>
                <h2 className="mt-5 text-xl font-semibold uppercase">Четыре толщины металла</h2>
                <p className="mt-4 text-sm leading-7 text-white/60">
                  Сравните стоимость кассет толщиной 0,5; 0,7; 1,0 и 1,2 мм и выберите исходный вариант для дальнейшей инженерной проверки.
                </p>
              </article>
              <article className="border border-white/12 bg-[#111519] p-6">
                <span className="text-2xl font-semibold text-steel-orange">03</span>
                <h2 className="mt-5 text-xl font-semibold uppercase">Точный расчёт по чертежам</h2>
                <p className="mt-4 text-sm leading-7 text-white/60">
                  Для коммерческого предложения учитываются проёмы, углы, доборные элементы, раскладка, покрытие и выбранный цвет по RAL.
                </p>
              </article>
            </div>

            <div className="mt-16 grid gap-8 border-y border-white/12 py-10 lg:grid-cols-[.8fr_1.2fr]">
              <div>
                <p className="eyebrow">Что влияет на итог</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">От предварительной цены к смете проекта</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "Фактическая раскладка фасада",
                  "Количество оконных и дверных проёмов",
                  "Наружные и внутренние углы",
                  "Тип металла и защитного покрытия",
                  "Цвет и фактура по каталогу RAL",
                  "Доборные и фасонные элементы",
                ].map((item) => (
                  <div key={item} className="flex gap-3 border border-white/10 bg-white/[.025] px-4 py-3 text-sm text-white/70">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 bg-steel-orange" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <section className="mt-16">
              <p className="eyebrow">Вопросы и ответы</p>
              <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">О расчёте металлокассет</h2>
              <div className="mt-7 grid gap-3">
                {faqItems.map((item) => (
                  <details key={item.question} className="group border border-white/12 bg-[#111519]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-5 px-5 py-5 text-sm font-semibold sm:text-base">
                      {item.question}
                      <span className="text-2xl font-light text-steel-orange transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="border-t border-white/10 px-5 py-5 text-sm leading-7 text-white/60">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>

            <div className="mt-12 border border-steel-orange/40 bg-gradient-to-r from-steel-orange/15 to-transparent p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
              <div>
                <p className="text-xl font-semibold uppercase">Нужен точный расчёт фасада?</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                  Прикрепите чертёж, проект или спецификацию. Проверим раскладку и подготовим коммерческое предложение.
                </p>
              </div>
              <div className="mt-5 flex shrink-0 flex-wrap gap-3 sm:mt-0">
                <Link href="/products/metallokassety" className="border border-white/25 px-5 py-4 text-xs font-bold uppercase transition hover:border-steel-orange">
                  Каталог кассет&nbsp; →
                </Link>
                <Link href="/contacts#contact-form" className="clip-corner bg-steel-orange px-6 py-4 text-xs font-bold uppercase">
                  Получить расчёт&nbsp; →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </PageLayout>
    </>
  );
}
