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
  {question:"Можно рассчитать без чертежа?", answer:"Да. Введите внешние размеры плоской заготовки, толщину, материал и количество. В одном расчёте — до 5 изделий, у каждого до 5 типов отверстий с отдельными диаметрами и количеством. Отверстия условно считаются круглыми, без задания расположения. Полученная стоимость ориентировочная; форму и изготовляемость проверяет инженер."},
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
        eyebrow="Изготовление по вашему чертежу"
        title="CAD-калькулятор металлоизделий"
        description="Загрузите CAD, проверьте параметры и получите предварительный расчёт изготовления."
        image="/images/web/hero-main.webp"
        imageAlt="Иллюстративный визуал: фасад промышленного здания из тёмных металлокассет с перфорированным экраном"
      >
        <ClientManufacturingWorkspace />

        <section aria-labelledby="how-it-works" className="border-t border-white/10 bg-[#0c1115] py-10 sm:py-14">
          <div className="mx-auto grid max-w-[1680px] gap-10 px-4 sm:px-6 lg:grid-cols-[.7fr_1fr] lg:px-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-steel-orange">От КД до готовой партии</p>
              <h2 id="how-it-works" className="mt-3 text-2xl font-semibold">Как работает онлайн-расчёт</h2>
              <p className="mt-4 max-w-lg text-sm leading-7 text-white/70">Геометрия из CAD или введённые вами габариты, выбранный металл, количество и указанные операции. Цена металла поступает из актуального прайса поставщика. Неоднозначную геометрию и незаданные параметры проверяет инженер.</p>
              <p className="mt-3 max-w-lg text-sm leading-7 text-white/70">Расход листа до финальной раскладки оценивается по заготовке. Итоговые стоимость и сроки подтверждаются после проверки проекта.</p>
              <Link href="/production" className="mt-5 inline-flex min-h-11 items-center text-sm text-steel-orange underline underline-offset-4">Возможности производства →</Link>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/70"><Link href="/production/lazernaya-rezka-metalla" className="min-h-11 py-3 underline underline-offset-4">Лазерная резка</Link><Link href="/production/gibka-listovogo-metalla" className="min-h-11 py-3 underline underline-offset-4">Гибка листа</Link><Link href="/contacts#contact-form" className="min-h-11 py-3 underline underline-offset-4">Связаться с инженером</Link></div>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Частые вопросы</h2>
              <div className="mt-4 divide-y divide-white/15 border-y border-white/15">
                {faqItems.map((item) => (
                  <details key={item.question} className="group py-1">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-5 py-3 text-sm font-medium">{item.question}<span aria-hidden="true" className="text-xl text-steel-orange group-open:rotate-45">+</span></summary>
                    <p className="pb-5 pr-6 text-sm leading-7 text-white/70">{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      </PageLayout>
    </>
  );
}
