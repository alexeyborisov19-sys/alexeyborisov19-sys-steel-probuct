import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { ProductionShowreel } from "@/components/ProductionVideo";
import { semanticKeywords } from "@/data/semantic";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Производство изделий из листового металла",
  description:
    "Современное производство полного цикла: инженерный отдел, лазерная резка, гибка, сварка, порошковая окраска, контроль качества и отгрузка.",
  path: "/production",
  image: "/images/real-production/workshop-team.jpg",
  keywords: semanticKeywords.production,
});

const stages = [
  ["Проектирование", "/images/real-production/engineering-department.jpg", "Проверяем технологичность, развёртки, соединения и допустимые отклонения."],
  ["Раскрой", "/images/real-production/laser-cutting-action.jpg", "Оптимизируем раскладку, контролируем геометрию и маркируем детали."],
  ["Гибка", "/images/real-production/press-brake-durma.jpg", "Подбираем инструмент и контролируем углы и размеры первой детали."],
  ["Сварка", "/images/real-production/welding-station.jpg", "Используем сборочные приспособления и проверяем геометрию."],
  ["Окраска", "/images/web/cycle-powder-coating.jpg", "Контролируем подготовку поверхности, цвет и качество покрытия."],
  ["Отгрузка", "/images/web/cycle-quality-control.jpg", "Проверяем комплектность, маркировку и защиту при перевозке."],
] as const;

const realProductionPhotos = [
  {
    image: "/images/real-production/laser-cutting-action.jpg",
    title: "Лазерная резка листового металла",
    description: "Рабочая зона лазерного комплекса в момент раскроя.",
  },
  {
    image: "/images/real-production/engineering-department.jpg",
    title: "Инженерная подготовка",
    description: "Проработка конструкции и производственной документации.",
  },
  {
    image: "/images/real-production/press-brake-durma.jpg",
    title: "Листогибочный комплекс Durma",
    description: "Гибка деталей с программным управлением и контролем геометрии.",
  },
  {
    image: "/images/real-production/panel-bending-tool.jpg",
    title: "Инструмент гибочного комплекса",
    description: "Оснастка для точного и повторяемого формообразования деталей.",
  },
  {
    image: "/images/real-production/welding-station.jpg",
    title: "Сварочный пост",
    description: "Сварка и сборка металлоизделий на производственном участке.",
  },
  {
    image: "/images/real-production/workshop-team.jpg",
    title: "Работа производственного участка",
    description: "Специалисты «Сталь Продукт» в действующем цехе.",
  },
  {
    image: "/images/real-production/panel-bender-hogi.jpg",
    title: "Автоматизированная гибка HOGI",
    description: "Оборудование для обработки сложных деталей из листового металла.",
  },
  {
    image: "/images/real-production/laser-complex-golden.jpg",
    title: "Лазерный комплекс Golden Laser",
    description: "Высокоточный раскрой серийных и индивидуальных деталей.",
  },
] as const;

const capabilities = [
  ["Инженерный отдел", "Прорабатываем конструкцию, технологию изготовления и состав поставки до запуска заказа."],
  ["3 лазерных комплекса с ЧПУ", "Точный раскрой листового металла для серийных и индивидуальных изделий."],
  ["4 листогибочных комплекса", "Формируем стабильную геометрию деталей и повторяемость партии."],
  ["Сварочные посты", "Выполняем сварку и сборку с контролем геометрии готового изделия."],
  ["Слесарный участок", "Проводим доводку, подгонку и подготовительные операции перед сборкой и покрытием."],
  ["3 камеры порошковой окраски", "Наносим защитно-декоративное покрытие и ведём параллельную обработку изделий."],
  ["Камера дробеструйной очистки", "Подготавливаем поверхность металла перед окраской для надёжного сцепления покрытия."],
  ["Контроль, упаковка и логистика", "Проверяем комплектацию, защищаем изделия при перевозке и организуем отгрузку."],
] as const;

export default function ProductionPage() {
  return (
    <PageLayout
      path="/production"
      eyebrow="Производство"
      title="Современное производство инженерных решений из листового металла"
      description="Полный цикл производства — от разработки и проектирования до упаковки и отгрузки готовой продукции. Контроль качества на каждом этапе."
      image="/images/real-production/workshop-team.jpg"
    >
      <section className="border-y border-white/10 bg-[#0c1013] py-7">
        <div className="container grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["2000 м²", "производственных площадей"],
            ["70+", "опытных специалистов"],
            ["3", "лазерных комплекса с ЧПУ"],
            ["Система", "контроля качества"],
            ["По графику", "контроль этапов заказа"],
          ].map(([value, label]) => (
            <div key={label} className="border-l border-white/10 px-4">
              <b className="text-3xl text-steel-orange">{value}</b>
              <p className="mt-1 text-[10px] uppercase text-white/55">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>
      <ProductionShowreel />
      <section className="bg-[#101112] py-14">
        <div className="container">
          <h2 className="text-3xl font-semibold">Производственный цикл</h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {stages.map(([title, image, description], index) => (
              <article
                key={title}
                className="overflow-hidden border border-white/10 bg-[#111519]"
              >
                <div className="relative aspect-video overflow-hidden bg-[#192026]">
                  <img
                    src={image}
                    width={428}
                    height={240}
                    alt={`${title} на производстве «Сталь Продукт»`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover brightness-[1.07] contrast-[1.01] saturate-[1.02]"
                  />
                </div>
                <div className="p-4">
                  <b className="text-xl text-steel-orange">
                    {String(index + 1).padStart(2, "0")}
                  </b>
                  <h3 className="mt-2 text-sm font-bold">{title}</h3>
                  <p className="mt-3 text-[11px] leading-relaxed text-white/50">
                    {description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="border-y border-white/10 bg-[#090c0e] py-16">
        <div className="container">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="eyebrow">Реальное производство</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-semibold sm:text-4xl">
                Оборудование и участки — без рендеров
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-white/55">
              Фотографии действующего производства «Сталь Продукт»: инженерная подготовка,
              лазерная резка, гибка, сварка и работа специалистов в цехе.
            </p>
          </div>

          <div className="mt-9 grid gap-3 lg:grid-cols-2">
            {realProductionPhotos.slice(0, 2).map((photo) => (
              <article
                key={photo.image}
                className="group relative aspect-[16/9] overflow-hidden border border-white/10 bg-[#111519]"
              >
                <img
                  src={photo.image}
                  width={1600}
                  height={900}
                  alt={`${photo.title} — реальное производство «Сталь Продукт»`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover brightness-[1.04] contrast-[1.03] saturate-[.98] transition duration-700 group-hover:scale-[1.025] group-hover:brightness-[1.1]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <span className="text-[9px] font-bold uppercase tracking-[.18em] text-steel-orange">
                    Реальный кадр
                  </span>
                  <h3 className="mt-2 text-lg font-semibold">{photo.title}</h3>
                  <p className="mt-2 max-w-lg text-xs leading-relaxed text-white/65">
                    {photo.description}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {realProductionPhotos.slice(2).map((photo) => (
              <article
                key={photo.image}
                className="group overflow-hidden border border-white/10 bg-[#111519] transition hover:border-steel-orange/60"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <img
                    src={photo.image}
                    width={1600}
                    height={900}
                    alt={`${photo.title} — реальное производство «Сталь Продукт»`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover brightness-[1.04] contrast-[1.03] saturate-[.98] transition duration-700 group-hover:scale-[1.035] group-hover:brightness-[1.1]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
                  <span className="absolute left-4 top-4 border border-steel-orange/60 bg-black/70 px-2 py-1 text-[8px] font-bold uppercase tracking-[.15em] text-steel-orange backdrop-blur-sm">
                    Производство
                  </span>
                </div>
                <div className="border-t border-white/10 p-5">
                  <h3 className="text-sm font-bold">{photo.title}</h3>
                  <p className="mt-2 text-[11px] leading-relaxed text-white/55">
                    {photo.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-[#0c1013] py-14">
        <div className="container">
          <h2 className="text-3xl font-semibold">Наши возможности</h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map(([title, description], index) => (
              <article
                key={title}
                className="border border-white/10 bg-[#111519] p-5"
              >
                <span className="text-2xl text-steel-orange">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 text-sm font-bold">{title}</h3>
                <p className="mt-3 text-[11px] leading-relaxed text-white/55">{description}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-col justify-between gap-5 border border-white/15 bg-[#14181b] p-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-semibold">Есть задача?</h3>
              <p className="mt-2 text-sm text-white/55">
                Изготовим решение под ваши требования.
              </p>
            </div>
            <Link
              href="/contacts#contact-form"
              className="bg-steel-orange px-7 py-4 text-xs font-bold uppercase"
            >
              Получить расчет&nbsp; →
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
