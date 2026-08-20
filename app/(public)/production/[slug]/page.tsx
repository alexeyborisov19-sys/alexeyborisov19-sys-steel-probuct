import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import {
  productionServiceBySlug,
  productionServices,
} from "@/data/production-services";
import { faqSchema, serviceSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

type ProductionServicePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return productionServices.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({
  params,
}: ProductionServicePageProps): Promise<Metadata> {
  const service = productionServiceBySlug[(await params).slug];
  if (!service) return {};

  return createPageMetadata({
    title: service.seoTitle ?? service.title,
    description: service.description,
    path: `/production/${service.slug}`,
    image: service.image,
    keywords: service.keywords,
  });
}

export default async function ProductionServicePage({
  params,
}: ProductionServicePageProps) {
  const service = productionServiceBySlug[(await params).slug];
  if (!service) notFound();

  const path = `/production/${service.slug}`;

  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: service.title,
            description: service.description,
            path,
            serviceType: service.shortTitle,
          }),
          faqSchema(service.faq),
        ]}
      />
      <PageLayout
        path={path}
        eyebrow={service.eyebrow}
        title={service.title}
        description={service.description}
        image={service.image}
        imageAlt={`${service.title} — производственный участок «Сталь Продукт»`}
        imageBrightness
      >
        <section className="bg-[#0c1013] py-14 sm:py-20">
          <div className="container grid gap-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,.92fr)] xl:items-start">
            <div>
              <p className="eyebrow">Задача и результат</p>
              <h2 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight sm:text-4xl">
                Технология подчинена готовому изделию
              </h2>
              <p className="mt-6 max-w-4xl text-lg leading-8 text-white/72">
                {service.lead}
              </p>
              {service.specifications && (
                <dl className="mt-8 grid gap-3 sm:grid-cols-2">
                  {service.specifications.map((specification) => (
                    <div
                      key={specification.label}
                      className="border border-white/12 bg-[#111519] p-5"
                    >
                      <dt className="text-[10px] font-bold uppercase tracking-[.14em] text-white/45">
                        {specification.label}
                      </dt>
                      <dd className="mt-3 text-xl font-semibold text-steel-orange">
                        {specification.value}
                      </dd>
                      <p className="mt-3 text-xs leading-5 text-white/55">
                        {specification.note}
                      </p>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-8 border-l-2 border-steel-orange bg-[#111519] p-6 sm:p-7">
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-steel-orange">
                  Что получает заказчик
                </p>
                <p className="mt-3 text-base leading-7 text-white/82">
                  {service.result}
                </p>
              </div>
            </div>

            <aside className="border border-white/12 bg-[#111519] p-6 sm:p-8">
              <p className="eyebrow">Для предварительной оценки</p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight">
                Что прислать специалисту
              </h2>
              <ul className="mt-6 space-y-4">
                {service.inputs.map((input) => (
                  <li
                    key={input}
                    className="flex gap-3 border-b border-white/10 pb-4 text-sm leading-6 text-white/70 last:border-0"
                  >
                    <span className="mt-[10px] h-1.5 w-1.5 shrink-0 bg-steel-orange" />
                    {input}
                  </li>
                ))}
              </ul>
              <Link
                href="/contacts#contact-form"
                className="clip-corner mt-7 inline-flex bg-steel-orange px-6 py-4 text-xs font-bold uppercase"
              >
                Передать документацию&nbsp; →
              </Link>
              <p className="mt-4 text-xs leading-5 text-white/42">
                Подтвердим получение материалов в течение рабочего дня. Срок подготовки расчёта
                сообщим после проверки документации.
              </p>
            </aside>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#101112] py-14 sm:py-20">
          <div className="container">
            <div className="max-w-3xl">
              <p className="eyebrow">Производственный маршрут</p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                Из каких операций складывается результат
              </h2>
              <p className="mt-4 text-sm leading-7 text-white/58">
                Точный состав операций определяется после анализа чертежа, материала,
                количества и требований к готовому изделию.
              </p>
            </div>
            <ol className="mt-9 grid gap-px border border-white/12 bg-white/10 md:grid-cols-2 xl:grid-cols-3">
              {service.operations.map((operation, index) => (
                <li key={operation} className="bg-[#101519] p-6 sm:p-7">
                  <span className="font-mono text-xl font-bold text-steel-orange">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-6 text-sm leading-7 text-white/76">{operation}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-[#090d10] py-14 sm:py-20">
          <div className="container grid gap-8 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:items-start">
            <div>
              <p className="eyebrow">Контроль качества</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
                Что проверяем на этом этапе
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/58">
                Контрольные признаки фиксируются в исходной документации и производственном
                маршруте. Для ответственных параметров согласуем проверку первой детали или образца.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {service.controls.map((control, index) => (
                <article
                  key={control}
                  className="border border-white/12 bg-[#111519] p-6 transition hover:border-steel-orange/60"
                >
                  <span className="font-mono text-sm font-bold text-steel-orange">
                    К{String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-5 text-base font-semibold leading-6">{control}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>

        <FaqSection items={service.faq} title={`Вопросы: ${service.shortTitle.toLowerCase()}`} />

        <section className="bg-[#0c1013] py-14 sm:py-20">
          <div className="container">
            <div className="flex flex-col justify-between gap-5 border-b border-white/12 pb-5 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">Связанные разделы</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">
                  Продолжить по задаче
                </h2>
              </div>
              <Link
                href="/production"
                className="text-xs font-bold uppercase text-steel-orange"
              >
                Весь производственный цикл&nbsp; →
              </Link>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {service.related.map((item, index) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group border border-white/12 bg-[#111519] p-6 transition hover:border-steel-orange"
                >
                  <span className="font-mono text-xl font-bold text-steel-orange">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-6 text-base font-semibold leading-6 group-hover:text-steel-orange">
                    {item.label}
                  </h3>
                  <span className="mt-5 block text-xs text-white/42">Открыть раздел&nbsp; →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </PageLayout>
    </>
  );
}
