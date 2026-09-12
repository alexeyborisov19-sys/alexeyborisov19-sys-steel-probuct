import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import { realProjects, type RealProject, type RealProjectCategory } from "@/data/real-projects";
import { articleSchema, breadcrumbSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

const path = "/articles/metall-dlya-goroda-proekty-stal-produkt";
const title = "Металл для города: объекты Сталь Продукт";
const description = "Жилые кварталы, больницы и школы, для которых поставлялись металлокассеты, вентиляционные решётки, кронштейны, корпуса и другие изделия из листового металла.";

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path,
  image: "https://static.tildacdn.com/tild6566-3364-4764-a666-393734303130/4_2_1_747.webp",
  keywords: [
    "объекты Сталь Продукт",
    "металлокассеты Смоленск объекты",
    "металлоизделия для больниц",
    "металлоизделия для школ",
    "металлоизделия для застройщиков",
    "поставки металлокассет Смоленск",
  ],
  openGraphType: "article",
  publishedTime: "2026-09-12",
  modifiedTime: "2026-09-12",
});

const selectedSlugs = [
  "solovinaya-roshcha",
  "klovskiy",
  "unity-development",
  "metrum-group",
  "vostokstroy",
  "smolenskaya-oblastnaya-klinicheskaya-bolnitsa",
  "odkb-novyy-korpus",
  "onkologicheskiy-dispanser",
  "litsey-solovinaya-roshcha",
  "smolenskiy-meditsinskiy-kolledzh",
  "feniks-pechersk",
  "stodolishchenskaya-shkola",
];

const selectedProjects = selectedSlugs.map((slug) => realProjects.find((project) => project.slug === slug)!).filter(Boolean);

const sectionNames: Record<RealProjectCategory, string> = {
  residential: "Жилая застройка",
  medical: "Медицина",
  education: "Образование",
};

function ProjectCard({ project }: { project: RealProject }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden border border-white/12 bg-[#111519] transition hover:border-steel-orange/65">
      <div className="relative aspect-[16/10] overflow-hidden bg-[#172026]">
        <Image
          src={project.image}
          alt={project.imageAlt}
          fill
          sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
          className="object-cover brightness-[.9] contrast-[1.02] transition duration-500 group-hover:scale-[1.025]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1013]/80 via-transparent to-transparent" />
        <span className="absolute bottom-3 left-3 max-w-[92%] bg-black/65 px-2 py-1 text-[9px] uppercase tracking-[.06em] text-white/65">
          {project.imageCredit ?? "Отраслевая иллюстрация"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[.08em]">
          <span className="text-steel-orange">{project.categoryLabel}</span>
          <span className="text-white/30">·</span>
          <span className="text-white/45">{project.city}</span>
        </div>
        <h3 className="mt-3 text-lg font-semibold leading-tight">{project.title}</h3>
        {project.partner ? <p className="mt-2 text-xs text-white/42">{project.partner}</p> : null}
        <p className="mt-4 text-sm leading-6 text-white/58">{project.description}</p>
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[.1em] text-white/38">Поставка</p>
          <p className="mt-2 text-sm leading-6 text-white/74">{project.supply.join(" · ")}</p>
        </div>
        <div className="mt-auto flex flex-wrap gap-4 pt-5">
          {project.href ? <Link href={project.href} className="text-xs font-bold uppercase text-steel-orange">Кейс&nbsp; →</Link> : null}
          <a href={project.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase text-white/45 hover:text-white">Об объекте&nbsp; ↗</a>
          {project.imageSourceUrl ? <a href={project.imageSourceUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase text-white/35 hover:text-white">Источник фото&nbsp; ↗</a> : null}
        </div>
      </div>
    </article>
  );
}

export default function MetalForCityArticle() {
  const solovinaya = selectedProjects.find((project) => project.slug === "solovinaya-roshcha")!;

  return (
    <>
      <JsonLd data={[
        articleSchema({
          headline: "Металл для города: где работают изделия Сталь Продукт",
          description,
          path,
          image: solovinaya.image,
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
        eyebrow="Инженерный журнал · Инженерная практика"
        title="Металл для города: где работают изделия Сталь Продукт"
        description="От крупной жилой застройки до новых медицинских корпусов и школ. Металлокассеты, вентиляционные решётки, кронштейны, корпуса и нестандартные изделия в реальных строительных проектах."
        image={solovinaya.image}
        imageAlt={solovinaya.imageAlt}
      >
        <article className="bg-[#0c1013] py-14 sm:py-20">
          <div className="container max-w-6xl">
            <div className="border-y border-white/12 py-5 text-xs uppercase tracking-[.08em] text-white/45">
              <span className="text-steel-orange">12 сентября 2026</span><span className="mx-3">·</span><span>Инженерная практика</span><span className="mx-3">·</span><Link href="/projects" className="text-steel-orange">Полное портфолио</Link>
            </div>

            <p className="mt-8 max-w-4xl text-lg leading-8 text-white/78">Готовое здание редко показывает, сколько разных металлических изделий находится за его архитектурой. На фасаде работают кассеты, решётки и доборные элементы; в инженерных зонах — кронштейны, корпуса и ящики. Для производства это одна задача: превратить документацию большого объекта в повторяемую, маркированную и комплектную серию деталей.</p>

            <section className="mt-10 border border-steel-orange/35 bg-[#111519] p-6 sm:p-8">
              <p className="eyebrow">Как читать эту публикацию</p>
              <p className="mt-4 text-sm leading-7 text-white/62">Состав поставок указан по подтверждённой информации компании. Фотографии идентифицируют соответствующий объект или проект там, где удалось подтвердить изображение; для нескольких объектов пока используется нейтральная отраслевая иллюстрация. Мы не утверждаем, что конкретный видимый на фотографии элемент изготовлен «Сталь Продукт», если такая привязка отдельно не подтверждена. Монтаж на объектах не выполняем.</p>
            </section>

            <section className="mt-14 overflow-hidden border border-steel-orange/45 bg-[#111519]">
              <div className="grid lg:grid-cols-[1.05fr_.95fr]">
                <div className="relative min-h-80 bg-[#172026] lg:min-h-[480px]">
                  <Image src={solovinaya.image} alt={solovinaya.imageAlt} fill priority sizes="(max-width:1023px) 100vw, 55vw" className="object-cover brightness-[.9]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0c1013]/75 via-transparent to-transparent" />
                  <span className="absolute bottom-4 left-4 bg-black/65 px-3 py-2 text-[10px] uppercase tracking-[.06em] text-white/65">{solovinaya.imageCredit}</span>
                </div>
                <div className="flex flex-col p-6 sm:p-8">
                  <p className="font-mono text-sm font-bold text-steel-orange">01 · Ключевой кластер</p>
                  <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">«Соловьиная роща»: масштаб больше одного дома</h2>
                  <p className="mt-5 text-base leading-8 text-white/68">Это не единичная поставка, а многолетняя работа с несколькими очередями крупного микрорайона и его социальной инфраструктурой. В разные периоды для проектов поставлялись металлокассеты, кронштейны, металлические корпуса и ящики, а также другие изделия по рабочей документации.</p>
                  <p className="mt-5 text-sm leading-7 text-white/55">Официальный сайт застройщика показывает несколько очередей «Нового квартала», территорию проекта 78 га и парк площадью 27 га. В истории застройщика также указано более 260 тыс. м² введённого жилья за 2020–2025 годы.</p>
                  <div className="mt-6 flex flex-wrap gap-2">{solovinaya.supply.map((item) => <span key={item} className="border border-white/12 px-3 py-2 text-xs text-white/68">{item}</span>)}</div>
                  <div className="mt-auto flex flex-wrap gap-4 pt-7">
                    <Link href="/projects/solovinaya-roshcha" className="text-xs font-bold uppercase text-steel-orange">Большой кейс&nbsp; →</Link>
                    <a href={solovinaya.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase text-white/45 hover:text-white">Застройщик&nbsp; ↗</a>
                  </div>
                </div>
              </div>
            </section>

            {(["medical", "education", "residential"] as RealProjectCategory[]).map((category, index) => {
              const projects = selectedProjects.filter((project) => project.category === category && project.slug !== "solovinaya-roshcha");
              const intro = category === "medical"
                ? "Медицинские объекты показывают, как в одной поставке сходятся фасадные и инженерные изделия. Для нового онкодиспансера подтверждена поставка металлокассет, вентиляционных решёток и других металлических изделий; для нового корпуса ОДКБ — металлических изделий и фасадных элементов."
                : category === "education"
                  ? "В образовательном направлении есть и новое строительство, и капитальный ремонт: лицей в «Соловьиной роще», техношкола «Феникс» в Печерске, медицинский колледж и Стодолищенская школа."
                  : "Помимо «Ваш дом», портфолио включает работу с проектами «Кловский», «Юнити Девелопмент», «Метрум Груп» и «ВостокСтрой». Состав конкретной партии всегда определяется документацией отдельного объекта.";
              return (
                <section key={category} className="mt-16">
                  <p className="font-mono text-sm font-bold text-steel-orange">0{index + 2}</p>
                  <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">{sectionNames[category]}</h2>
                  <p className="mt-5 max-w-4xl text-base leading-8 text-white/68">{intro}</p>
                  <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {projects.map((project) => <ProjectCard key={project.slug} project={project} />)}
                  </div>
                </section>
              );
            })}

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
              <div>
                <h2 className="text-xl font-semibold uppercase">Все объекты — в портфолио поставок</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Полная подборка с составом поставки, официальными источниками и отдельным кейсом «Соловьиная роща».</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/projects" className="clip-corner bg-steel-orange-deep px-6 py-4 text-xs font-bold uppercase">Открыть проекты&nbsp; →</Link>
                <Link href="/products/metallokassety" className="border border-white/25 px-6 py-4 text-xs font-bold uppercase">Металлокассеты&nbsp; →</Link>
              </div>
            </div>
          </div>
        </article>
      </PageLayout>
    </>
  );
}
