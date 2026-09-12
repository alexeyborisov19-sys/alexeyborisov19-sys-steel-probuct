import Link from "next/link";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import {
  installationScopeSummary,
  metalCassetteOutputSummary,
  productionEquipment,
  productionEquipmentSummary,
  productionScale,
  productionScaleSummary,
} from "@/data/manufacturing-facts";
import { legalLinks, legalOperator } from "@/lib/legal";
import { createPageMetadata } from "@/lib/seo";
import { faqSchema } from "@/lib/schema";

export const metadata = createPageMetadata({
  title: "Проверенные факты о производстве",
  description: "Проверенные данные о бренде «Сталь Продукт», юридическом операторе, производственной площадке, оборудовании, масштабе производства и границах работ.",
  path: "/company/facts",
  keywords: ["Сталь Продукт", "производство металлоизделий Смоленск", "оборудование производства", "металлокассеты производитель"],
});

const equipmentRows = [
  ["Лазерные комплексы", productionEquipment.laserComplexes],
  ["Листогибочные комплексы", productionEquipment.pressBrakes],
  ["Панельгиб", productionEquipment.panelBenders],
  ["Сварочные посты", productionEquipment.weldingStations],
  ["Камеры порошковой окраски", productionEquipment.powderCoatingBooths],
  ["Дробеструйная камера", productionEquipment.shotBlastingChambers],
  ["Система лазерной очистки", productionEquipment.laserCleaningSystems],
] as const;

const factsFaq = [
  {
    question: "«Сталь Продукт» — это юридическое лицо?",
    answer: `Нет. «Сталь Продукт» — бренд/товарный знак, а не наименование юридического лица. Юридический оператор, указанный на сайте, — ${legalOperator.shortName}.`,
  },
  {
    question: "Где находится производство «Сталь Продукт»?",
    answer: `Производственная площадка находится по адресу: ${legalOperator.productionAddress}. География поставок — Россия.`,
  },
  {
    question: "Какой масштаб производства?",
    answer: `${productionScaleSummary} ${metalCassetteOutputSummary}`,
  },
  {
    question: "Какое основное оборудование подтверждено?",
    answer: productionEquipmentSummary,
  },
  {
    question: "Выполняет ли «Сталь Продукт» монтаж на объектах?",
    answer: installationScopeSummary,
  },
];

export default function CompanyFactsPage() {
  return (
    <>
      <JsonLd data={faqSchema(factsFaq)} />
      <PageLayout
        path="/company/facts"
        eyebrow="Проверенные данные"
        title="Факты о производстве «Сталь Продукт»"
        description="Краткая справочная страница с подтверждёнными данными о бренде, юридическом операторе, производственной площадке, оборудовании и границах работ."
      >
        <section className="border-b border-white/10 bg-[#0c1013] py-12 sm:py-16">
          <div className="container grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
            <div>
              <p className="eyebrow">Идентификация</p>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Бренд и юридический оператор — разные сущности</h2>
              <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/72">
                <strong className="text-white">«Сталь Продукт» — бренд/товарный знак, не юридическое лицо.</strong>{" "}
                Юридический оператор, указанный на сайте: {legalOperator.name}, ИНН {legalOperator.inn}, ОГРН {legalOperator.ogrn}.
              </p>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/58">
                Производственная площадка: {legalOperator.productionAddress}. Поставки выполняются по России. {installationScopeSummary}
              </p>
              <p className="mt-5 text-xs uppercase tracking-[.12em] text-white/45">
                Актуализировано: <time dateTime="2026-09-12">12 сентября 2026 года</time>
              </p>
            </div>

            <div className="border border-white/12 bg-[#111519] p-6 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-steel-orange">Масштаб</p>
              <dl className="mt-6 grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
                <div>
                  <dt className="text-xs uppercase tracking-[.1em] text-white/45">Площадь</dt>
                  <dd className="mt-1 text-2xl font-semibold text-white">{productionScale.floorArea}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[.1em] text-white/45">Специалисты</dt>
                  <dd className="mt-1 text-2xl font-semibold text-white">{productionScale.specialists}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[.1em] text-white/45">Металлокассеты</dt>
                  <dd className="mt-1 text-xl font-semibold text-white">{productionScale.annualMetalCassetteOutput}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="bg-[#151719] py-14 sm:py-20">
          <div className="container">
            <p className="eyebrow">Оборудование</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Подтверждённый состав производственного оборудования</h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {equipmentRows.map(([label, value]) => (
                <article key={label} className="border border-white/12 bg-[#101214] p-5">
                  <strong className="text-3xl text-steel-orange">{value}</strong>
                  <p className="mt-3 text-sm font-medium leading-snug text-white/72">{label}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#0c1013] py-12 sm:py-16">
          <div className="container grid gap-6 lg:grid-cols-2">
            <article className="border border-white/12 bg-[#111519] p-6">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-steel-orange">Что подтверждено</p>
              <p className="mt-4 text-sm leading-relaxed text-white/68">{productionScaleSummary}</p>
              <p className="mt-3 text-sm leading-relaxed text-white/68">{productionEquipmentSummary}</p>
              <p className="mt-3 text-sm leading-relaxed text-white/68">{metalCassetteOutputSummary}</p>
            </article>
            <article className="border border-white/12 bg-[#111519] p-6">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-steel-orange">Граница работ</p>
              <p className="mt-4 text-lg font-semibold text-white">{installationScopeSummary}</p>
              <p className="mt-4 text-sm leading-relaxed text-white/60">
                На сайте производственные возможности отделены от работ на строительной площадке, чтобы в коммерческих, справочных и машиночитаемых материалах не возникало двусмысленности.
              </p>
            </article>
          </div>
        </section>

        <FaqSection items={factsFaq} title="Короткие ответы о «Сталь Продукт»" />

        <section className="bg-[#151719] py-12 sm:py-16">
          <div className="container">
            <p className="eyebrow">Первоисточники на сайте</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Проверить подробности</h2>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/production" className="btn-primary">Производство</Link>
              <Link href="/company" className="btn-secondary">О компании</Link>
              <Link href={legalLinks.requisites} className="btn-secondary">Реквизиты</Link>
              <Link href="/contacts" className="btn-secondary">Контакты</Link>
            </div>
          </div>
        </section>
      </PageLayout>
    </>
  );
}
