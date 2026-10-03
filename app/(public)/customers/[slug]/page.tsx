import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/PageLayout";
import { AttributionLink } from "@/components/AttributionLink";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { CustomerResources } from "@/components/commercial/CustomerResources";
import {
  LandingNav,
  SectionHeading,
  EnquiryFinish,
} from "@/components/commercial/LandingSections";
import { customerGuides } from "@/data/customer-guides";
import { createPageMetadata } from "@/lib/seo";
import { faqSchema } from "@/lib/schema";
export function generateStaticParams() {
  return customerGuides.map((g) => ({ slug: g.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = customerGuides.find((g) => g.slug === slug);
  if (!guide) return {};
  return createPageMetadata({
    title: guide.title,
    description: guide.description,
    path: "/customers/" + slug,
    image: guide.image,
  });
}
export default async function CustomerGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = customerGuides.find((g) => g.slug === slug);
  if (!guide) notFound();
  return (
    <>
      <JsonLd data={faqSchema(guide.faq)} />
      <PageLayout
        path={"/customers/" + slug}
        eyebrow={guide.eyebrow}
        title={guide.title}
        description={guide.intro}
        image={guide.image}
        imageAlt={guide.imageAlt}
      >
        <LandingNav
          items={guide.sections.map((s) => ({ id: s.id, label: s.title }))}
        />
        {guide.sections.map((section, index) => (
          <section
            key={section.id}
            id={section.id}
            className={
              "scroll-mt-28 py-14 sm:py-20 " +
              (index % 2 ? "bg-[#181c1f]" : "bg-[#101416]")
            }
          >
            <div className="container">
              <SectionHeading
                eyebrow={"0" + (index + 1) + " / " + guide.eyebrow}
                title={section.title}
                text={section.lead}
              />
              <div className="mt-9 grid gap-px overflow-hidden border border-white/20 bg-white/20 md:grid-cols-2">
                {section.cards.map((card) => (
                  <article key={card.title} className="bg-[#101416] p-6 sm:p-8">
                    <h3 className="text-xl font-semibold">{card.title}</h3>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-white/80">
                      {card.text}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ))}
        <section className="bg-[#eeefeb] py-10 text-[#151a1d]">
          <div className="container flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold">
                Сохраните задание на изготовление
              </h2>
              <p className="mt-3 leading-7">
                Бесплатный текстовый шаблон: заполните известные параметры и
                приложите его к чертежам. Регистрация не нужна.
              </p>
            </div>
            <a
              download
              href="/documents/zadanie-na-izgotovlenie.txt"
              className="inline-flex min-h-12 items-center border-2 border-[#151a1d] px-6 py-3 font-semibold hover:bg-white"
            >
              Скачать шаблон · TXT ↓
            </a>
          </div>
        </section>
        <FaqSection items={guide.faq} title="Ответы перед заказом" />
        <section className="bg-[#101416] py-12">
          <div className="container">
            <h2 className="text-2xl font-semibold">Дальше — к вашей задаче</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {guide.related.map((item) => (
                <AttributionLink
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-16 items-center justify-between gap-4 border border-white/20 p-5 font-semibold hover:border-steel-orange"
                >
                  {item.title}
                  <span aria-hidden="true">→</span>
                </AttributionLink>
              ))}
            </div>
          </div>
        </section>
        <CustomerResources current={slug} />
        <EnquiryFinish
          title="Есть исходные данные? Разберём задачу."
          text="Передайте материалы инженеру. Уточним недостающие параметры и состав работ до согласования заказа."
        />
      </PageLayout>
    </>
  );
}
