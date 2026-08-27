import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Проектные решения для типовых объектов",
  description:
    "Демонстрационные сценарии применения фасадных, промышленных и инженерных решений Сталь Продукт для разных типов объектов.",
  path: "/projects",
  image: "/images/industries/residential.jpg",
  keywords: [
    "проектные решения металлоконструкции",
    "металлокассеты для объектов",
    "типовые фасадные решения",
  ],
});

const projects = [
  {
    title: "Жилой комплекс",
    category: "Жилые комплексы",
    image: "/images/industries/residential.jpg",
    href: "/industries/zhilye-kompleksy",
    description:
      "Фасадные, климатические, кровельные и инженерные изделия по проектной документации и спецификации объекта.",
  },
  {
    title: "Производственное предприятие",
    category: "Промышленность",
    image: "/images/industries/production.jpg",
    href: "/industries/proizvodstvennye-predpriyatiya",
    description:
      "Корпуса, кожухи, ограждения, рамы, площадки и серийные детали по КД заказчика.",
  },
  {
    title: "Центр обработки данных",
    category: "ЦОД и технологическая инфраструктура",
    image: "/images/industries/data-center.jpg",
    href: "/industries/cod-i-tehnologicheskaya-infrastruktura",
    description:
      "Корпусные, защитные, монтажные и инженерные элементы для технологической инфраструктуры объекта.",
  },
  {
    title: "Агропромышленный комплекс",
    category: "АПК",
    image: "/images/industries/agro.jpg",
    href: "/industries/agropromyshlennyj-kompleks",
    description:
      "Защитные, корпусные и инженерные изделия из листового металла по рабочей документации проекта.",
  },
] as const;

export default function ProjectsPage() {
  return (
    <PageLayout
      className="type-pilot"
      path="/projects"
      eyebrow="Проектные сценарии"
      title="Решения для типовых объектов"
      description="Показываем возможный состав поставки для разных типов объектов. Это демонстрационные сценарии, а не заявления об участии в конкретных проектах."
      image="/images/industries/residential.jpg"
      imageAlt="Демонстрационный сценарий жилого комплекса с изделиями из листового металла"
    >
      <section className="bg-[#0c1013] py-12 sm:py-16">
        <div className="container">
          <div className="border border-steel-orange/40 bg-steel-orange/8 p-5 text-sm leading-relaxed text-white/68">
            <b className="text-white">Важно:</b> карточки ниже показывают структуру возможного решения для типа объекта. Они не подтверждают участие «Сталь Продукт» в конкретном проекте, объём поставки или применённые технические параметры.
          </div>

          <div className="mt-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="eyebrow">4 сценария</p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Выберите тип объекта</h2>
              <p className="mt-4 text-sm leading-7 text-white/60">
                Каждая карточка ведёт в соответствующее отраслевое решение с перечнем изделий, задач и исходных данных для расчёта.
              </p>
            </div>
            <Link href="/industries" className="text-[13px] font-bold uppercase text-steel-orange transition hover:text-orange-400">
              Все отрасли&nbsp; →
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {projects.map((project) => (
              <article key={project.title} className="group overflow-hidden border border-white/15 bg-[#111519] transition hover:border-steel-orange/70">
                <div className="relative aspect-video overflow-hidden bg-[#192026]">
                  <Image
                    src={project.image}
                    alt={`${project.title} — демонстрационный сценарий применения металлоизделий`}
                    fill
                    sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 25vw"
                    className="object-cover brightness-[1.07] contrast-[1.01] saturate-[1.02] transition duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex min-h-64 flex-col p-5">
                  <p className="text-xs font-bold uppercase tracking-[.1em] text-white/45">Демонстрационный сценарий</p>
                  <p className="mt-2 text-xs font-bold uppercase text-steel-orange">{project.category}</p>
                  <h3 className="mt-4 text-lg font-semibold">{project.title}</h3>
                  <p className="mt-4 text-sm leading-6 text-white/60">{project.description}</p>
                  <Link href={project.href} className="mt-auto border-t border-white/10 pt-5 text-[13px] font-bold text-steel-orange transition group-hover:text-orange-400">
                    Изучить отраслевое решение&nbsp; →
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 flex flex-col justify-between gap-5 border border-white/15 bg-[#14181b] p-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-semibold">Есть рабочий проект или спецификация?</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
                Передайте КД, чертёж, ведомость изделий или описание задачи. Проверим исходные данные и подготовим предметный расчёт без привязки к демонстрационным сценариям.
              </p>
            </div>
            <Link href="/contacts#contact-form" className="clip-corner whitespace-nowrap bg-steel-orange px-7 py-4 text-[13px] font-bold uppercase">
              Получить расчёт&nbsp; →
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
