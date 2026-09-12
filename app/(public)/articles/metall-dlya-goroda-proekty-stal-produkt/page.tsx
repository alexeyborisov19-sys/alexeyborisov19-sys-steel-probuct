import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import { realProjects } from "@/data/real-projects";
import { articleSchema, breadcrumbSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

const path = "/articles/metall-dlya-goroda-proekty-stal-produkt";
const title = "Металл для города: объекты Сталь Продукт";
const description = "Жилые кварталы, больницы и школы, для которых поставлялись металлокассеты, вентиляционные решётки, кронштейны, корпуса и другие изделия из листового металла.";

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path,
  image: "/images/industries/residential.jpg",
  keywords: [
    "объекты Сталь Продукт",
    "металлокассеты Смоленск объекты",
    "металлоизделия для больниц",
    "металлоизделия для школ",
    "металлоизделия для застройщиков",
  ],
  openGraphType: "article",
  publishedTime: "2026-09-12",
  modifiedTime: "2026-09-12",
});

const selectedSlugs = [
  "solovinaya-roshcha",
  "onkologicheskiy-dispanser",
  "odkb-novyy-korpus",
  "feniks-pechersk",
  "smolenskiy-meditsinskiy-kolledzh",
  "stodolishchenskaya-shkola",
  "klovskiy",
  "unity-development",
];

const selectedProjects = selectedSlugs.map((slug) => realProjects.find((project) => project.slug === slug)!).filter(Boolean);

export default function MetalForCityArticle() {
  return (
    <>
      <JsonLd data={[
        articleSchema({
          headline: "Металл для города: где работают изделия Сталь Продукт",
          description,
          path,
          image: "/images/industries/residential.jpg",
          datePublished: "2026-09-12",
          dateModified: "2026-09-12",
        }),
        breadcrumbSchema([
          { name: "Главная", path: "/" },
          { name: "Инженерный журнал", path: "/articles" },
          { name: "Металл для города", path },
        ]),
      ]} />
      <PageLayout
        path={path}
        eyebrow="Инженерный журнал · Проекты"
        title="Металл для города: где работают изделия Сталь Продукт"
        description="От крупной жилой застройки до новых медицинских корпусов и школ. Показываем, как металлокассеты, решётки, кронштейны, корпуса и нестандартные изделия становятся частью реальных строительных объектов."
        image="/images/industries/residential.jpg"
        imageAlt="Изделия из листового металла для городских строительных объектов"
      >
        <article className="bg-[#0c1013] py-14 sm:py-20">
          <div className="container max-w-6xl">
            <div className="border-y border-white/12 py-5 text-xs uppercase tracking-[.08em] text-white/45">
              <span className="text-steel-orange">12 сентября 2026</span><span className="mx-3">·</span><span>Инженерная практика</span><span className="mx-3">·</span><Link href="/projects" className="text-steel-orange">Полное портфолио</Link>
            </div>

            <p className="mt-8 max-w-4xl text-lg leading-8 text-white/78">Готовое здание редко показывает, сколько разных металлических изделий находится за его архитектурой. На фасаде работают кассеты, решётки и доборные элементы; в инженерных зонах — кронштейны, корпуса и ящики. Для производства это не разные миры, а одна задача: превратить документацию большого объекта в повторяемую, маркированную и комплектную серию деталей.</p>

            <section className="mt-10 border border-steel-orange/35 bg-[#111519] p-6 sm:p-8">
              <p className="eyebrow">Важно о публикации</p>
              <p className="mt-4 text-sm leading-7 text-white/62">Состав поставок указан по подтверждённой информации компании. Ссылки на официальные сайты используются для идентификации объектов и их публичного контекста. Иллюстрации на этой странице принадлежат сайту и показывают тип объекта; они не выдаются за фотографии конкретной партии «Сталь Продукт». Монтаж компания не выполняет.</p>
            </section>

            <section className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
              <div>
                <p className="font-mono text-sm font-bold text-steel-orange">01</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">«Соловьиная роща»: масштаб больше одного дома</h2>
                <p className="mt-5 text-base leading-8 text-white/68">Один из самых сильных примеров — многолетняя работа с проектами микрорайона «Соловьиная роща» и «Нового квартала». В разные периоды для объектов застройки поставлялись металлокассеты, кронштейны, корпуса, ящики и другие изделия по проектной документации. Отдельная часть истории — образовательная инфраструктура микрорайона.</p>
                <p className="mt-5 text-base leading-8 text-white/68">Для производства ценность такого сотрудничества в повторяемости: спустя время необходимо снова выпускать серии, работать с новыми очередями и сохранять управляемость большого количества позиций.</p>
                <Link href="/projects/solovinaya-roshcha" className="mt-5 inline-flex text-xs font-bold uppercase text-steel-orange">Большой кейс «Соловьиная роща»&nbsp; →</Link>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden border border-white/12"><Image src="/images/industries/residential.jpg" alt="Иллюстрация жилого проекта" fill sizes="(max-width:1023px) 100vw, 45vw" className="object-cover brightness-[.88]" /></div>
            </section>

            <section className="mt-16">
              <p className="font-mono text-sm font-bold text-steel-orange">02</p>
              <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Медицина: объект часто требует сразу нескольких групп изделий</h2>
              <p className="mt-5 max-w-4xl text-base leading-8 text-white/68">На медицинских объектах особенно хорошо видно преимущество широкого производственного контура. Для нового Смоленского областного онкологического диспансера поставка включала металлокассеты, вентиляционные решётки и другие металлические изделия. Для нового корпуса областной детской клинической больницы поставлялись металлические изделия и фасадные элементы. Для Смоленской областной клинической больницы выполнялись поставки изделий по проектной документации.</p>
              <div className="mt-7 grid gap-4 md:grid-cols-2">
                {selectedProjects.filter((project) => project.category === "medical").map((project) => (
                  <article key={project.slug} className="border border-white/12 bg-[#111519] p-5">
                    <p className="text-xs font-bold uppercase tracking-[.1em] text-steel-orange">{project.city}</p>
                    <h3 className="mt-3 text-lg font-semibold">{project.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/58">{project.supply.join(" · ")}</p>
                    <a href={project.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs font-bold uppercase text-white/50 hover:text-white">Официальный источник&nbsp; ↗</a>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-16 grid gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
              <div className="relative aspect-[4/3] overflow-hidden border border-white/12"><Image src="/images/industries/educational.jpg" alt="Иллюстрация образовательного объекта" fill sizes="(max-width:1023px) 100vw, 45vw" className="object-cover brightness-[.9]" /></div>
              <div>
                <p className="font-mono text-sm font-bold text-steel-orange">03</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Образование: новые школы и модернизация существующих зданий</h2>
                <p className="mt-5 text-base leading-8 text-white/68">В образовательном направлении портфолио включает многопрофильный лицей в «Соловьиной роще», строящуюся техношколу «Феникс» в Печерске, Смоленский базовый медицинский колледж и Стодолищенскую среднюю школу. Для колледжа и школы в Стодолище подтверждена поставка металлокассет; для «Феникса» — металлических изделий по проекту.</p>
                <p className="mt-5 text-base leading-8 text-white/68">Для реконструкции и капитального ремонта особенно важна фактическая геометрия существующего здания: новые элементы приходится увязывать с уже сформированными проёмами и отметками.</p>
              </div>
            </section>

            <section className="mt-16">
              <p className="font-mono text-sm font-bold text-steel-orange">04</p>
              <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Жилая застройка: работа с несколькими девелоперами</h2>
              <p className="mt-5 max-w-4xl text-base leading-8 text-white/68">Кроме «Ваш дом», портфолио включает сотрудничество с проектами «Кловский», «Юнити Девелопмент», «Метрум Груп» и «ВостокСтрой». В рамках такой работы поставлялись металлокассеты, кронштейны, металлические ящики и корпуса и другие изделия по спецификациям объектов. Конкретный состав партии зависит от проекта и не переносится автоматически с одного дома на другой.</p>
              <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {selectedProjects.filter((project) => project.category === "residential" && project.slug !== "solovinaya-roshcha").map((project) => (
                  <article key={project.slug} className="border border-white/12 bg-[#111519] p-5">
                    <h3 className="text-lg font-semibold">{project.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/58">{project.supply.join(" · ")}</p>
                    <a href={project.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs font-bold uppercase text-steel-orange">Сайт проекта&nbsp; ↗</a>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-16 border-y border-white/12 py-10">
              <p className="font-mono text-sm font-bold text-steel-orange">05</p>
              <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Что объединяет эти поставки</h2>
              <div className="mt-7 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Документация", "Чертёж, фасадная раскладка или спецификация превращаются в производственное задание."],
                  ["Серийность", "Повторяемость геометрии важна от первой детали до последней позиции партии."],
                  ["Разная номенклатура", "Кассеты, решётки, кронштейны, корпуса и доборы могут идти в одной поставке."],
                  ["Комплектование", "Маркировка и разделение партий помогают передать объекту понятный комплект изделий."],
                ].map(([heading, text]) => <div key={heading} className="bg-[#111519] p-5"><h3 className="font-semibold text-steel-orange">{heading}</h3><p className="mt-2 text-sm leading-6 text-white/55">{text}</p></div>)}
              </div>
            </section>

            <div className="mt-12 flex flex-col justify-between gap-5 border border-steel-orange/35 bg-gradient-to-r from-steel-orange/12 to-transparent p-6 sm:flex-row sm:items-center sm:p-8">
              <div><h2 className="text-xl font-semibold uppercase">Все подтверждённые объекты — в портфолио</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Карточки сгруппированы по жилой застройке, медицине и образованию и содержат состав поставки и ссылку на официальный источник об объекте.</p></div>
              <Link href="/projects" className="clip-corner bg-steel-orange-deep px-6 py-4 text-xs font-bold uppercase">Открыть проекты&nbsp; →</Link>
            </div>
          </div>
        </article>
      </PageLayout>
    </>
  );
}
