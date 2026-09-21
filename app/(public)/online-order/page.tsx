import type { Metadata } from "next";
import { ClientManufacturingWorkspace } from "@/components/ClientManufacturingWorkspace";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import Link from "next/link";
import { faqSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";
import { absoluteUrl, siteConfig } from "@/lib/site";

const path = "/online-order";
const title = "CAD-калькулятор металлоизделий";
const description =
  "Загрузите DXF, STEP или STP: система определит геометрию детали и сформирует предварительный расчёт стоимости изготовления.";

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
    question: "Какие файлы можно загрузить?",
    answer: "DXF с плоской развёрткой и STEP или STP с трёхмерной деталью. Можно загрузить несколько файлов сразу — каждый станет отдельной позицией проекта. DWG принимается после проверки инженером.",
  },
  {
    question: "Что определяется автоматически?",
    answer: "По DXF система определяет габариты, чистую площадь, длину реза и количество врезок. Служебные слои — размеры, осевые, рамки и штампы — в расчёт не попадают. По STEP дополнительно определяются толщина листа и количество гибов.",
  },
  {
    question: "Что нужно указать вручную?",
    answer: "Материал, толщину и количество. Для операций, которых нет в чертеже, указываются исходные данные: количество гибов для DXF, длина сварного шва, время сборки, число сторон окраски и подготовки поверхности. По STEP количество гибов подставляется автоматически.",
  },
  {
    question: "Сколько металла считает калькулятор?",
    answer: "Длина реза и прожиги определяются по реальным контурам CAD. Расход листа до production nesting считается по расчётной заготовке вокруг детали; для фигурных деталей фактический расход партии может уменьшиться после раскладки. Финальную раскладку подтверждает инженер.",
  },
  {
    question: "Насколько точна показанная стоимость?",
    answer: "Расчёт является предварительным и зависит от качества исходной модели. Окончательные цена и сроки подтверждаются коммерческим предложением и договором после проверки инженером.",
  },
  {
    question: "Откуда берётся цена металла?",
    answer: "Из действующего прайса поставщика листового проката. Если подтверждённой цены на нужную толщину нет или прайс устарел, система передаёт позицию на проверку инженеру.",
  },
  {
    question: "Что происходит с загруженными файлами?",
    answer: "Модель обрабатывается на сервере для построения предпросмотра и расчёта геометрии. Файлы передаются в работу только вместе с заявкой, которую вы отправляете сами.",
  },
  {
    question: "Можно ли рассчитать гнутую деталь из STEP?",
    answer: "Загрузите STEP для просмотра и проверки. Автоматический расчёт доступен только для поддерживаемой и проверенной геометрии. Предпросмотр 3D сам по себе не подтверждает развёртку. Неоднозначные гибы и развёртки передаются технологу.",
  },
] as const;

const calculatorSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "CAD-калькулятор металлоизделий",
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
        compactHero
        path={path}
        eyebrow="Проект → геометрия → производство → стоимость"
        title="CAD-калькулятор металлоизделий"
        description="Загрузите CAD, проверьте параметры и получите предварительный расчёт изготовления."
        image="/images/web/hero-main.webp"
        imageAlt="Иллюстративный визуал: фасад промышленного здания из тёмных металлокассет с перфорированным экраном"
      >
        <ClientManufacturingWorkspace />

        <section aria-labelledby="how-it-works" className="border-t border-white/10 bg-[#0c1013] py-12 sm:py-14">
          <div className="container">
            <h2 id="how-it-works" className="text-2xl font-semibold uppercase">Как работает онлайн-расчёт</h2>
            <div className="mt-7 grid gap-3 lg:grid-cols-3">
              {[
                {
                  title: "DXF: геометрия детали",
                  text: "Система определяет габариты, площадь, длину реза и количество врезок непосредственно по контурам детали.",
                },
                {
                  title: "STEP: толщина и гибы",
                  text: "По 3D-модели дополнительно определяются толщина листа и количество гибов.",
                },
                {
                  title: "Стоимость по актуальному прайсу",
                  text: "Цена металла берётся из действующего прайса. Если данных недостаточно, позиция передаётся инженеру.",
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
                <p className="text-[11px] font-bold uppercase tracking-[.16em] text-steel-orange">Автоматический расчёт и проверка</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase leading-tight">Что определяется автоматически</h2>
              </div>
              <div className="space-y-4 text-sm leading-7 text-white/62">
                <p>
                  Система считывает из модели геометрию, площадь, длину реза, количество врезок,
                  толщину и гибы — когда эти данные однозначно определяются форматом файла.
                </p>
                <p>
                  Развёртка гнутой детали и нестандартные операции подтверждаются технологом.
                  Если подтверждённой цены металла нет, позиция передаётся инженеру.
                </p>
                <p>
                  Расчёт является предварительным. Окончательные стоимость и сроки подтверждает{" "}
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
