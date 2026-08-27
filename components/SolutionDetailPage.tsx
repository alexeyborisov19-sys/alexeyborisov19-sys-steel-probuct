import Image from "next/image";
import Link from "next/link";
import type { SolutionDetail } from "@/data/solution-details";
import { solutionSeoBySlug } from "@/data/solution-seo";
import { FaqSection } from "./FaqSection";
import { JsonLd } from "./JsonLd";
import { PageLayout } from "./PageLayout";
import { SolutionDiagram } from "./SolutionDiagram";
import { SolutionItemVisual } from "./SolutionItemVisual";
import { ManufacturingProofSection } from "./ManufacturingProofSection";
import { faqSchema, serviceSchema } from "@/lib/schema";

export function SolutionDetailPage({ solution }: { solution: SolutionDetail }) {
  const brightenIndustry = solution.slug === "industry";
  const seo = solutionSeoBySlug[solution.slug];
  const faqItems = seo.faq;
  return <><JsonLd data={[serviceSchema({ name: solution.title, description: solution.description, path: `/solutions/${solution.slug}`, serviceType: solution.eyebrow }), faqSchema(faqItems)]} /><PageLayout path={`/solutions/${solution.slug}`} eyebrow={solution.eyebrow} title={solution.title} description={solution.description} image={solution.image} imageAlt={`${solution.title} — изделия из листового металла «Сталь Продукт»`} imageBrightness={brightenIndustry}>
    <section className="bg-[#0c1013] py-14 sm:py-20">
      <div className="container">
        <div className="grid gap-8 xl:grid-cols-[.94fr_1.06fr] xl:items-start">
          <div className="border-l-2 border-steel-orange pl-5"><p className="text-lg font-semibold leading-relaxed text-white/90">{solution.introduction}</p></div>
          <div className="grid gap-3 sm:grid-cols-3">{solution.highlights.map((highlight, index) => <article key={highlight.title} className="border border-white/12 bg-[#111519] p-5"><span className="font-mono text-xl font-bold text-steel-orange">0{index + 1}</span><h2 className="mt-6 text-base font-semibold uppercase leading-tight">{highlight.title}</h2><p className="mt-3 text-sm leading-relaxed text-white/58">{highlight.text}</p></article>)}</div>
        </div>
        {seo.commercialFacts && (
          <dl className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {seo.commercialFacts.map((fact) => (
              <div key={fact.label} className="border border-white/12 bg-[#111519] p-5">
                <dt className="text-xs font-bold uppercase tracking-[.14em] text-white/45">{fact.label}</dt>
                <dd className="mt-3 text-xl font-semibold text-steel-orange">{fact.value}</dd>
                <p className="mt-3 text-xs leading-5 text-white/55">{fact.note}</p>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>

    <ManufacturingProofSection />

    <section className="border-y border-white/10 bg-[#101112] py-14 sm:py-20">
      <div className="container">
        <div className="max-w-3xl"><p className="eyebrow">Состав решения</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Изделия и задачи</h2><p className="mt-4 text-sm leading-relaxed text-white/60">Каждый пункт можно поставить отдельно или собрать в единое решение. Для наглядности подготовили собственные типовые схемы узлов: они показывают принцип изделия, точки крепления и параметры, которые уточняются под конкретный проект.</p></div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{solution.items.map((item, index) => <article key={item.title} className="group flex min-h-64 overflow-hidden border border-white/12 bg-[#111519] transition hover:border-steel-orange"><div className="flex flex-1 flex-col"><SolutionItemVisual kind={item.visual} title={item.title} brighter={brightenIndustry} /><div className="flex flex-1 flex-col p-6"><span className="font-mono text-xl font-bold text-steel-orange">{String(index + 1).padStart(2, "0")}</span><h3 className="mt-5 text-lg font-semibold uppercase leading-tight">{item.title}</h3><p className="mt-4 text-sm leading-relaxed text-white/62">{item.description}</p><div className="mt-auto border-t border-white/10 pt-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-white/40">Где применяется</p><p className="mt-2 text-xs leading-relaxed text-white/75">{item.application}</p></div></div></div></article>)}</div>
      </div>
    </section>

    <section className="bg-[#0c1013] py-14 sm:py-20"><div className="container"><SolutionDiagram title={solution.diagramTitle} caption={solution.diagramCaption} steps={solution.diagramSteps} /></div></section>

    <section className="border-y border-white/10 bg-[#101112] py-14 sm:py-20">
      <div className="container">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="max-w-3xl"><p className="eyebrow">Реальные кадры производства</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Как создаём эти решения</h2><p className="mt-4 text-sm leading-relaxed text-white/60">Фотографии показывают действующие участки, где формируются геометрия деталей, качество соединений, подготовка поверхности и комплектность заказа.</p></div><p className="max-w-xs text-xs leading-relaxed text-white/42">Точная последовательность операций зависит от конструкции и согласованной технологии.</p></div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">{solution.productionStages.map((stage, index) => <article key={stage.title} className="overflow-hidden border border-white/12 bg-[#111519]"><div className="relative aspect-[16/9] overflow-hidden border-b border-white/10"><Image src={stage.image} alt={stage.title} fill sizes="(max-width: 767px) 100vw, 33.3vw" className={`object-cover transition duration-500 hover:scale-[1.03] ${brightenIndustry ? "brightness-[1.16] contrast-[1.02] saturate-[1.03]" : "brightness-[1.08] contrast-[1.01] saturate-[1.02]"}`} /><div className="absolute inset-0 bg-gradient-to-t from-[#0a0d0f]/70 via-transparent to-transparent" /><span className="absolute bottom-3 left-4 font-mono text-lg font-bold text-steel-orange">0{index + 1}</span></div><div className="p-6"><h3 className="text-lg font-semibold uppercase leading-tight">{stage.title}</h3><p className="mt-3 text-sm leading-relaxed text-white/62">{stage.text}</p></div></article>)}</div>
      </div>
    </section>

    <section className="border-y border-white/10 bg-[#101112] py-14 sm:py-20">
      <div className="container grid gap-10 xl:grid-cols-[1fr_.9fr]">
        <div><p className="eyebrow">Для точного расчёта</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Что нужно передать в работу</h2><p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/60">Можно начать с неполного комплекта. Если каких-то данных нет, поможем сформировать перечень вопросов и подобрать подходящее решение.</p><ul className="mt-7 grid gap-3 sm:grid-cols-2">{solution.requirements.map((requirement) => <li key={requirement} className="border-b border-white/10 pb-3 text-sm leading-relaxed text-white/78"><span className="mr-2 text-steel-orange">•</span>{requirement}</li>)}</ul></div>
        <aside className="border border-white/12 bg-[#141719] p-6 sm:p-8"><p className="eyebrow">Файлы и форматы</p><h3 className="mt-3 text-xl font-semibold uppercase leading-tight">Принимаем чертежи и описание задачи</h3><p className="mt-4 text-sm leading-relaxed text-white/60">PDF, DXF, DWG, STEP, IGES, изображения, спецификации и архивы. Можно приложить рабочий чертёж, эскиз или просто фотографии существующего решения.</p><Link href="/contacts#contact-form" className="clip-corner mt-7 inline-block bg-steel-orange-deep px-6 py-4 text-xs font-bold uppercase">Передать исходные данные&nbsp; →</Link></aside>
      </div>
    </section>

    <section className="border-y border-white/10 bg-[#0c1013] py-10">
      <div className="container">
        <p className="eyebrow">Связанные возможности</p>
        <div className="mt-5 grid gap-px border border-white/12 bg-white/10 md:grid-cols-3">
          {seo.related.map((item) => <Link key={item.href} href={item.href} className="bg-[#111519] p-5 text-sm font-semibold transition hover:text-steel-orange">{item.label}&nbsp; →</Link>)}
        </div>
      </div>
    </section>

    <FaqSection items={faqItems} title="Частые вопросы по решению" />

    <section className="bg-[#0c1013] py-14 sm:py-20"><div className="container"><div className="flex flex-col justify-between gap-5 border-b border-white/12 pb-5 sm:flex-row sm:items-end"><div><p className="eyebrow">Порядок работы</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">От задачи до поставки</h2></div><Link href="/contacts#contact-form" className="text-xs font-bold uppercase text-steel-orange">Получить расчёт&nbsp; →</Link></div><div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{solution.process.map((step, index) => <article key={step.title} className="border border-white/12 bg-[#111519] p-6"><span className="font-mono text-2xl font-bold text-steel-orange">0{index + 1}</span><h3 className="mt-7 text-lg font-semibold uppercase leading-tight">{step.title}</h3><p className="mt-4 text-sm leading-relaxed text-white/60">{step.text}</p></article>)}</div></div></section>

    <section className="border-t border-white/10 bg-[#17191a] py-10"><div className="container flex flex-col justify-between gap-6 md:flex-row md:items-center"><div><p className="eyebrow">Расчёт под объект</p><h2 className="mt-2 text-2xl font-semibold uppercase">Передайте исходные данные</h2><p className="mt-3 text-sm text-white/58">Проверим документацию и подготовим предложение по составу поставки, сроку и стоимости.</p></div><Link href="/contacts#contact-form" className="clip-corner whitespace-nowrap bg-steel-orange-deep px-8 py-4 text-sm font-bold uppercase">Получить расчёт&nbsp; →</Link></div></section>
  </PageLayout></>;
}
