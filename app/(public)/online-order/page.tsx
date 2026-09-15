import type { Metadata } from "next";
import { ClientManufacturingWorkspace } from "@/components/ClientManufacturingWorkspace";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import Link from "next/link";
import { faqSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";
import { absoluteUrl, siteConfig } from "@/lib/site";

const path = "/online-order";
const title = "Онлайн-расчёт металлоизделий по CAD";
const description =
  "Загрузите DXF или STEP/STP, проверьте CAD-модель и задайте параметры изделия для производственного расчёта в Сталь Продукт.";

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path,
  keywords: [
    "онлайн расчет металлоизделий",
    "расчет по DXF",
    "расчет стоимости лазерной резки онлайн",
    "калькулятор лазерной резки по чертежу",
    "STEP производство металлоизделий",
    "лазерная резка DXF",
    "изготовление по чертежу",
    "расчет детали по 3D модели",
    "загрузить DXF и узнать цену",
    "стоимость изготовления детали из листового металла",
  ],
});

const faqItems = [
  {
    question: "Какие файлы принимает калькулятор?",
    answer: "DXF с плоской развёрткой и STEP или STP с трёхмерной деталью. Можно загрузить несколько файлов сразу — каждый станет отдельной позицией проекта. DWG тоже принимается, но геометрию по нему уточняет инженер.",
  },
  {
    question: "Что именно определяется по чертежу автоматически?",
    answer: "По DXF: габарит детали, чистая площадь, длина реза и число врезок. Служебные слои — размеры, осевые, рамки, штампы — в расчёт не попадают. По STEP дополнительно определяются толщина листа и число гибов.",
  },
  {
    question: "Нужно ли что-то указывать вручную?",
    answer: "Материал, толщину и количество. Для операций, которых нет в чертеже, нужны исходные данные: число гибов для DXF, длина сварного шва, время сборки, число сторон окраски и подготовки поверхности. По STEP число гибов подставляется автоматически.",
  },
  {
    question: "Насколько точна показанная стоимость?",
    answer: "Это предварительный автоматический расчёт, он зависит от качества исходной модели и не является публичной офертой. Окончательные цена и сроки подтверждаются коммерческим предложением и договором после проверки инженером.",
  },
  {
    question: "Откуда берётся цена металла?",
    answer: "Из действующего прайса поставщика листового проката. Если подтверждённой цены на нужную толщину нет или прайс устарел, калькулятор не подставляет приблизительную цену, а передаёт позицию на проверку инженеру.",
  },
  {
    question: "Что происходит с загруженными файлами?",
    answer: "Модель разбирается на сервере для построения предпросмотра и расчёта геометрии. Файлы передаются в работу только вместе с заявкой, которую вы отправляете сами.",
  },
  {
    question: "Можно ли посчитать гнутую деталь из STEP?",
    answer: "Число гибов и их радиусы определяются по модели автоматически. Размер развёртки гнутой детали подтверждает технолог: он зависит от инструмента и режимов конкретного оборудования, поэтому машина его не выдумывает.",
  },
] as const;

const calculatorSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Калькулятор металлоизделий по CAD-модели",
  description,
  url: absoluteUrl(path),
  applicationCategory: "BusinessApplication",
  operatingSystem: "Любая платформа",
  browserRequirements: "Современный веб-браузер с поддержкой JavaScript",
  isAccessibleForFree: true,
  inLanguage: "ru-RU",
  featureList: [
    "Загрузка DXF, STEP и STP",
    "Автоматическое определение габаритов по CAD-модели",
    "Просмотр 2D-контура и 3D-модели",
    "Выбор материала, толщины и количества",
    "Выбор производственных операций",
    "Предварительная оценка стоимости проекта",
  ],
  provider: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
};

export default function OnlineOrderPage() {
  return (
    <>
      <JsonLd data={[calculatorSchema, faqSchema(faqItems.map((item) => ({ ...item })))]} />
      <PageLayout
        path={path}
        eyebrow="CAD → конфигурация → расчёт"
        title="Калькулятор металлоизделий"
        description="Загрузите чертёж или 3D-модель: габариты определятся автоматически. Останется выбрать материал, толщину, количество и обработку."
        image="/images/web/hero-main.webp"
      >
        <ClientManufacturingWorkspace />

        <section aria-labelledby="how-it-works" className="border-t border-white/10 bg-[#0c1013] py-12 sm:py-14">
          <div className="container">
            <h2 id="how-it-works" className="text-2xl font-semibold uppercase">Как считает калькулятор</h2>
            <div className="mt-7 grid gap-3 lg:grid-cols-3">
              {[
                {
                  title: "Читает чертёж, а не форму",
                  text: "DXF разбирается по контурам: габарит, чистая площадь, длина реза и число врезок снимаются с самой геометрии. Размерные линии, осевые, рамки и штампы в расчёт не попадают.",
                },
                {
                  title: "Понимает объёмную модель",
                  text: "По STEP определяется толщина листа и число гибов с их радиусами. Для гнутой детали гибка включается сама, а количество подставляется из модели.",
                },
                {
                  title: "Берёт цену металла из прайса",
                  text: "Стоимость листа подтягивается из действующего прайса поставщика. Нет подтверждённой цены на нужную толщину — позиция уходит инженеру, а не считается наугад.",
                },
              ].map((item, index) => (
                <article key={item.title} className="border border-white/10 bg-[#111519] p-5">
                  <span className="font-mono text-xs font-bold text-steel-orange">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="mt-4 text-sm font-semibold uppercase leading-snug">{item.title}</h3>
                  <p className="mt-3 text-[13px] leading-relaxed text-white/55">{item.text}</p>
                </article>
              ))}
            </div>

            <div className="mt-10 grid gap-5 border-y border-white/12 py-8 lg:grid-cols-[.8fr_1.2fr]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.16em] text-steel-orange">Где проходит граница</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase leading-tight">Что машина считает, а что подтверждает инженер</h2>
              </div>
              <div className="space-y-4 text-sm leading-7 text-white/62">
                <p>
                  Автоматически определяется всё, что однозначно читается из модели: размеры, площадь,
                  длина реза, число врезок, толщина и количество гибов. Эти величины не зависят от
                  оборудования и не требуют решения технолога.
                </p>
                <p>
                  Размер развёртки гнутой детали машина не выдумывает: он зависит от инструмента и
                  режимов конкретного листогиба, поэтому его подтверждает технолог. Так же и с ценой
                  металла — если подтверждённого прайса на нужную толщину нет, позиция уходит на
                  проверку, а не считается приблизительно.
                </p>
                <p>
                  Поэтому результат калькулятора — предварительный. Он показывает порядок цифр и
                  состав работ, а окончательную стоимость и сроки подтверждает{" "}
                  <Link href="/contacts#contact-form" className="text-steel-orange underline underline-offset-2">инженерный отдел</Link>.
                </p>
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-2xl font-semibold uppercase">Частые вопросы</h2>
              <div className="mt-6 grid gap-3 lg:grid-cols-2">
                {faqItems.map((item) => (
                  <article key={item.question} className="border border-white/10 bg-[#111519] p-5">
                    <h3 className="text-sm font-semibold leading-snug">{item.question}</h3>
                    <p className="mt-3 text-[13px] leading-relaxed text-white/55">{item.answer}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/production/lazernaya-rezka-metalla" className="border border-white/20 px-6 py-4 text-center text-sm font-bold uppercase transition hover:border-steel-orange hover:text-steel-orange">Лазерная резка металла&nbsp; →</Link>
              <Link href="/production/gibka-listovogo-metalla" className="border border-white/20 px-6 py-4 text-center text-sm font-bold uppercase transition hover:border-steel-orange hover:text-steel-orange">Гибка листового металла&nbsp; →</Link>
              <Link href="/production" className="border border-white/20 px-6 py-4 text-center text-sm font-bold uppercase transition hover:border-steel-orange hover:text-steel-orange">Возможности производства&nbsp; →</Link>
            </div>
          </div>
        </section>
      </PageLayout>
    </>
  );
}
