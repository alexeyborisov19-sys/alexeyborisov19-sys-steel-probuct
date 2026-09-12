import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import { ProjectPhotoGallery } from "@/components/ProjectPhotoGallery";
import { realProjects } from "@/data/real-projects";
import { projectShowcaseBySlug } from "@/data/real-project-showcase";
import { createPageMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

const path = "/projects/solovinaya-roshcha";
const project = projectShowcaseBySlug["solovinaya-roshcha"];
const lyceum = realProjects.find((item) => item.slug === "litsey-solovinaya-roshcha")!;

export const metadata: Metadata = createPageMetadata({
  title: "Соловьиная роща — поставки металлоизделий",
  description: "Многолетняя работа с объектами микрорайона «Соловьиная роща» в Смоленске: металлокассеты, кронштейны, металлические корпуса, ящики и изделия по проектной документации.",
  path,
  image: project.image,
  keywords: [
    "Соловьиная роща Смоленск металлокассеты",
    "Сталь Продукт Соловьиная роща",
    "металлоизделия для жилого комплекса",
    "металлокассеты для застройщика",
  ],
});

const houses = [
  ["Александра Степанова, 12", "дом сдан"],
  ["Александра Степанова, 14", "дом сдан"],
  ["Александра Степанова, 4", "строительство"],
  ["Александра Степанова, 6", "очередь проекта"],
  ["Александра Степанова, 6, стр. 1", "очередь проекта"],
] as const;

const caseSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Соловьиная роща: многолетняя работа с крупным микрорайоном",
  url: absoluteUrl(path),
  image: project.photos.map((photo) => photo.src),
  datePublished: "2026-09-12",
  dateModified: "2026-09-12",
  about: ["металлокассеты", "кронштейны", "металлические корпуса", "жилое строительство"],
};

export default function SolovinayaRoshchaProjectPage() {
  return (
    <>
      <JsonLd data={caseSchema} />
      <PageLayout
        path={path}
        eyebrow="Кейс · Жилая застройка"
        title="Соловьиная роща: многолетняя работа с крупным микрорайоном"
        description="Не один дом, а развивающийся кластер жилых и общественных объектов. В разные периоды для проектов микрорайона под брендом «Сталь Продукт» поставлялись металлокассеты, кронштейны, корпуса, ящики и другие изделия из листового металла."
        image={project.image}
        imageAlt={project.imageAlt}
      >
        <article className="bg-[#0c1013] py-14 sm:py-20">
          <div className="container max-w-6xl">
            <section className="overflow-hidden border border-steel-orange/40 bg-[#111519]">
              <div className="grid lg:grid-cols-[1.15fr_.85fr]">
                <ProjectPhotoGallery photos={project.photos} tall />
                <div className="flex flex-col p-6 sm:p-8">
                  <p className="eyebrow">Масштаб сотрудничества</p>
                  <h2 className="mt-3 text-2xl font-semibold uppercase leading-tight sm:text-3xl">От отдельных партий к системной работе по микрорайону</h2>
                  <p className="mt-5 text-base leading-8 text-white/68">«Соловьиная роща» — один из наиболее значимых кластеров в портфолио поставок. Это длительная работа не с одной фасадной плоскостью, а с несколькими жилыми объектами и социальной инфраструктурой развивающегося микрорайона.</p>
                  <p className="mt-5 text-sm leading-7 text-white/55">В разные периоды для проектов поставлялись металлокассеты, кронштейны, металлические корпуса и ящики, а также другие изделия по рабочей документации. Конкретная номенклатура определялась отдельными заказами и не переносится автоматически на каждый дом.</p>
                  <div className="mt-auto pt-7">
                    <p className="text-xs font-bold uppercase tracking-[.12em] text-white/38">Партнёр / застройщик</p>
                    <p className="mt-2 text-lg font-semibold">АО СЗ «Ваш дом»</p>
                    <a href="https://zao-vash-dom.ru/" target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs font-bold uppercase text-steel-orange">Официальный сайт&nbsp; ↗</a>
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["78 га", "территория микрорайона по данным застройщика"],
                ["27 га", "парк «Соловьиная роща»"],
                [">260 тыс. м²", "жилья введено в 2020–2025 годах по данным застройщика"],
                ["несколько очередей", "жилые дома и социальная инфраструктура"],
              ].map(([value, label]) => (
                <div key={value} className="border border-white/12 bg-[#111519] p-5">
                  <p className="text-2xl font-semibold text-steel-orange">{value}</p>
                  <p className="mt-2 text-sm leading-6 text-white/52">{label}</p>
                </div>
              ))}
            </div>

            <section className="mt-14 grid gap-7 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
              <div>
                <p className="font-mono text-sm font-bold text-steel-orange">01</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Много домов — одна длинная производственная история</h2>
                <p className="mt-5 text-base leading-8 text-white/68">Официальный сайт «Ваш дом» показывает несколько действующих очередей «Нового квартала». Для производственного партнёра такой масштаб означает повторяемые серии, большое количество типоразмеров и необходимость воспроизводить решения спустя месяцы и годы.</p>
                <p className="mt-5 text-base leading-8 text-white/68">Это принципиально отличается от разовой детали: документация должна оставаться понятной, геометрия — воспроизводимой, а маркировка и комплектование — устойчивыми при переходе между очередями.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {houses.map(([house, status]) => (
                  <div key={house} className="border border-white/10 bg-[#111519] p-4">
                    <p className="text-sm font-semibold">ул. {house}</p>
                    <p className="mt-1 text-xs uppercase tracking-[.08em] text-white/38">{status}</p>
                  </div>
                ))}
                <p className="sm:col-span-2 mt-2 text-xs leading-6 text-white/40">Перечень показывает масштаб текущей застройки по официальному сайту. Он не означает одинаковую поставку «Сталь Продукт» на каждый адрес.</p>
              </div>
            </section>

            <section className="mt-14">
              <p className="font-mono text-sm font-bold text-steel-orange">02</p>
              <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Что поставлялось для проектов микрорайона</h2>
              <div className="mt-6 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Металлокассеты", "Фасадные элементы серийных и проектных размеров."],
                  ["Кронштейны", "Гнутые и сварные позиции по рабочим чертежам."],
                  ["Корпуса и ящики", "Изделия для инженерного оборудования и систем объекта."],
                  ["Нестандартные изделия", "Детали из листового металла по спецификациям конкретных заказов."],
                ].map(([heading, text]) => (
                  <div key={heading} className="bg-[#111519] p-5">
                    <h3 className="font-semibold text-steel-orange">{heading}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/55">{text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-14 overflow-hidden border-y border-white/12 py-10">
              <div className="grid gap-7 lg:grid-cols-[1fr_.9fr] lg:items-center">
                <div>
                  <p className="font-mono text-sm font-bold text-steel-orange">03</p>
                  <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Многопрофильный лицей — инфраструктура того же микрорайона</h2>
                  <p className="mt-5 text-base leading-8 text-white/68">Работа с «Соловьиной рощей» не ограничивается жилыми домами. В микрорайоне работает многопрофильный лицей на 1100 учащихся; для образовательного объекта также поставлялись металлические изделия по проекту.</p>
                  <p className="mt-5 text-base leading-8 text-white/68">Это важная часть кейса: один производственный контур поддерживает разные типы объектов на территории — жилые здания и социальную инфраструктуру.</p>
                  <div className="mt-5 flex flex-wrap gap-4">
                    <a href={lyceum.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase text-steel-orange">Материал об объекте&nbsp; ↗</a>
                    {lyceum.imageSourceUrl ? <a href={lyceum.imageSourceUrl} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase text-white/45">Источник фото&nbsp; ↗</a> : null}
                  </div>
                </div>
                <div className="relative min-h-80 overflow-hidden border border-white/12 bg-[#172026]">
                  <Image src={lyceum.image} alt={lyceum.imageAlt} fill sizes="(max-width:1023px) 100vw, 45vw" className="object-cover brightness-[.92]" />
                  <span className="absolute bottom-3 left-3 bg-black/65 px-3 py-2 text-[10px] uppercase tracking-[.06em] text-white/65">{lyceum.imageCredit}</span>
                </div>
              </div>
            </section>

            <section className="mt-14">
              <p className="font-mono text-sm font-bold text-steel-orange">04</p>
              <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Почему крупный микрорайон — отдельная производственная задача</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {[
                  ["Повторяемость", "Серийные позиции должны сохранять геометрию от первой детали до последней партии."],
                  ["Много типоразмеров", "Рядовые изделия соседствуют с угловыми, крайними и инженерными позициями."],
                  ["Долгий горизонт", "Новые очереди требуют воспроизводимости решений и понятной работы с документацией спустя время."],
                ].map(([heading, text]) => (
                  <div key={heading} className="border border-white/12 bg-[#111519] p-5">
                    <h3 className="font-semibold">{heading}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/55">{text}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-14 flex flex-col justify-between gap-5 border border-steel-orange/35 bg-gradient-to-r from-steel-orange/12 to-transparent p-6 sm:flex-row sm:items-center sm:p-8">
              <div>
                <h2 className="text-xl font-semibold uppercase">Другие реальные объекты</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Медицинские, образовательные и жилые проекты собраны в общем портфолио поставок.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/projects" className="border border-white/25 px-5 py-4 text-xs font-bold uppercase">Все проекты&nbsp; →</Link>
                <Link href="/products/metallokassety" className="clip-corner bg-steel-orange-deep px-5 py-4 text-xs font-bold uppercase">Металлокассеты&nbsp; →</Link>
              </div>
            </div>
          </div>
        </article>
      </PageLayout>
    </>
  );
}
