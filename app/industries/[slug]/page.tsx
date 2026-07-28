import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import {
  getIndustrySolutionBySlug,
  getIndustrySolutions,
  industryVisualByTitle,
} from "@/lib/industry-solutions";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

type IndustryPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getIndustrySolutions().map((industry) => ({ slug: industry.slug }));
}

export async function generateMetadata({ params }: IndustryPageProps): Promise<Metadata> {
  const industry = getIndustrySolutionBySlug((await params).slug);
  if (!industry) return {};
  const description = `Изделия и инженерные решения из листового металла для направления «${industry.title}»: фасады, корпуса, инженерные системы и элементы по чертежам.`;
  return createPageMetadata({
    title: `Металлоизделия для отрасли «${industry.title}»`,
    description,
    path: `/industries/${industry.slug}`,
    image: `/images/industries/${industryVisualByTitle[industry.title] ?? "hero-main.jpg"}`,
    keywords: [
      `металлоизделия для ${industry.title.toLowerCase()}`,
      `изделия из листового металла для ${industry.title.toLowerCase()}`,
      `${industry.title.toLowerCase()} фасадные и инженерные решения`,
      "изготовление по чертежам",
    ],
  });
}

export default async function IndustryPage({ params }: IndustryPageProps) {
  const industry = getIndustrySolutionBySlug((await params).slug);
  if (!industry) notFound();

  const path = `/industries/${industry.slug}`;
  const image = `/images/industries/${industryVisualByTitle[industry.title] ?? "hero-main.jpg"}`;
  const description = `Производим изделия из листового металла для направления «${industry.title}»: от фасадных и защитных элементов до корпусов, инженерных систем и индивидуальных узлов.`;
  const itemCount = industry.sections.reduce((total, section) => total + section.items.length, 0);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Главная", path: "/" },
            { name: "Решения для объектов", path: "/industries" },
            { name: industry.title, path },
          ]),
          serviceSchema({
            name: `Изделия из листового металла для отрасли «${industry.title}»`,
            description,
            path,
            serviceType: `Производство металлоизделий для ${industry.title.toLowerCase()}`,
          }),
        ]}
      />
      <PageLayout
        path={path}
        eyebrow="Решения для объектов"
        title={industry.title}
        description={description}
        image={image}
        imageBrightness
      >
        <section className="bg-[#0c1013] py-14 sm:py-20">
          <div className="container">
            <div className="grid gap-6 border-y border-white/12 py-7 md:grid-cols-[minmax(0,1fr)_220px_220px] md:items-end">
              <div>
                <p className="eyebrow">Состав решения</p>
                <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
                  Что можем изготовить для проекта
                </h2>
              </div>
              <div className="border-l border-white/12 pl-5">
                <b className="text-3xl text-steel-orange">{industry.sections.length}</b>
                <p className="mt-1 text-[10px] uppercase tracking-[.08em] text-white/48">функциональных разделов</p>
              </div>
              <div className="border-l border-white/12 pl-5">
                <b className="text-3xl text-steel-orange">{itemCount}</b>
                <p className="mt-1 text-[10px] uppercase tracking-[.08em] text-white/48">позиций в матрице</p>
              </div>
            </div>

            <div className="mt-8 overflow-hidden border border-white/12 bg-[#101519]">
              {industry.sections.map((section, index) => (
                <section
                  key={section.title}
                  className="grid border-b border-white/10 last:border-b-0 lg:grid-cols-[300px_minmax(0,1fr)]"
                >
                  <div className="flex items-start gap-4 bg-white/[.025] px-5 py-6 lg:border-r lg:border-white/10">
                    <span className="font-mono text-sm font-bold text-steel-orange">{String(index + 1).padStart(2, "0")}</span>
                    <h2 className="text-lg font-semibold leading-snug">{section.title}</h2>
                  </div>
                  <ul className="grid gap-x-7 gap-y-3 border-t border-white/10 px-5 py-6 sm:grid-cols-2 lg:border-t-0">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-3 text-sm leading-6 text-white/72">
                        <span className="mt-[10px] h-1 w-1 shrink-0 bg-steel-orange" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="mt-8 flex flex-col justify-between gap-6 border border-steel-orange/40 bg-[linear-gradient(100deg,rgba(234,91,12,.15),rgba(16,21,25,.98)_55%)] p-6 sm:flex-row sm:items-center sm:p-8">
              <div>
                <p className="text-xl font-semibold">Нужен состав поставки под конкретный объект?</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">Пришлите чертёж, спецификацию или описание задачи. Проверим исходные данные и определим следующий шаг.</p>
              </div>
              <Link href="/contacts#contact-form" className="clip-corner shrink-0 bg-steel-orange px-7 py-4 text-center text-xs font-bold uppercase">
                Передать документацию&nbsp; →
              </Link>
            </div>
          </div>
        </section>
      </PageLayout>
    </>
  );
}
