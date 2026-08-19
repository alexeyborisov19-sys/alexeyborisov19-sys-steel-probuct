import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Проектные решения для типовых объектов",
  description:
    "Типовые сценарии применения фасадных, промышленных и инженерных решений Сталь Продукт.",
  path: "/projects",
  image: "/images/web/project-residential.jpg",
  keywords: [
    "проектные решения металлоконструкции",
    "металлокассеты для объектов",
    "типовые фасадные решения",
  ],
});

const projects = [
  [
    "Жилой комплекс",
    "Жилой комплекс",
    "Россия",
    "Состав по проекту",
    "Типовой сценарий",
  ],
  [
    "Производственное предприятие",
    "Производственное предприятие",
    "Россия",
    "Состав по проекту",
    "Типовой сценарий",
  ],
  [
    "Центр обработки данных",
    "ЦОД",
    "Россия",
    "Состав по проекту",
    "Типовой сценарий",
  ],
  [
    "Агропромышленный комплекс",
    "Агропромышленный комплекс",
    "Россия",
    "Состав по проекту",
    "Типовой сценарий",
  ],
];
const supplied = [
  ["Металлокассеты", "по спецификации"],
  ["Парапеты", "по спецификации"],
  ["Корзины для кондиционеров", "по спецификации"],
  ["Кронштейны для кондиционеров", "по спецификации"],
  ["Вентиляционные решётки", "по спецификации"],
  ["Электротехнические шкафы", "по спецификации"],
  ["Люки доступа", "по спецификации"],
  ["Кровельные ограждения", "по спецификации"],
  ["Закладные детали", "по спецификации"],
];

export default function ProjectsPage() {
  return (
    <PageLayout
      path="/projects"
      eyebrow="Проектные сценарии"
      title="Решения для типовых объектов"
      description="Показываем возможный состав поставки для разных типов объектов. Это демонстрационные сценарии, а не заявления об участии в конкретных проектах."
      image="/images/web/project-residential.jpg" imageAlt="Жилой комплекс с фасадными металлокассетами и доборными элементами производства «Сталь Продукт»"
    >
      <section className="bg-[#0c1013] py-10">
        <div className="container">
          <div className="mb-7 border border-steel-orange/40 bg-steel-orange/8 p-5 text-sm leading-relaxed text-white/68">
            <b className="text-white">Важно:</b> карточки ниже объясняют структуру возможного решения. Названия, изображения и параметры не подтверждают реализацию конкретного объекта. Реальные кейсы публикуются только после проверки документов, объёмов и прав на материалы.
          </div>
          <div className="grid gap-5 border border-white/10 bg-[#111519] p-4 lg:grid-cols-5">
            {[
              "Направление",
              "Отрасль / Тип объекта",
              "Продукция",
              "Регион",
            ].map((label) => (
              <label
                key={label}
                className="border-b border-white/10 pb-3 lg:border-b-0 lg:border-r lg:px-3"
              >
                <span className="block text-[10px] text-white/45">{label}</span>
                <select className="mt-2 w-full appearance-none bg-transparent text-sm outline-none">
                  <option>Все {label.toLowerCase()}</option>
                </select>
              </label>
            ))}
            <label className="border border-white/20 px-3 py-2">
              <span className="sr-only">Поиск по проектам</span>
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-white/45"
                placeholder="Поиск по проектам  ⌕"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "Все проекты",
              "Жилые комплексы",
              "Бизнес-центры",
              "Производственные предприятия",
              "Агропромышленный комплекс",
              "ЦОД",
              "Энергетика",
            ].map((label, index) => (
              <button
                key={label}
                className={`border px-3 py-2 text-[10px] font-bold uppercase ${index === 0 ? "border-steel-orange bg-steel-orange" : "border-white/20 text-white/65"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {projects.map(([title, category, city, count, year], index) => (
              <article
                key={title}
                className="overflow-hidden border border-white/15 bg-[#111519]"
              >
                <div className="relative aspect-video overflow-hidden bg-[#192026]">
                  <img
                    src={
                      index % 2
                        ? "/images/web/solution-industry.jpg"
                        : "/images/web/project-residential.jpg"
                    }
                    width={1080}
                    height={608}
                    alt={`${title}, ${city} — металлоизделия из листового металла на объекте`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover brightness-[1.07] contrast-[1.01] saturate-[1.02]"
                  />
                </div>
                <div className="p-5">
                  <p className="text-[10px] font-bold uppercase text-white/55">
                    {category}
                  </p>
                  <h2 className="mt-4 text-lg font-semibold">{title}</h2>
                  <p className="mt-2 text-xs text-white/50">⌖&nbsp; {city}</p>
                  <p className="mt-4 min-h-10 text-xs leading-relaxed text-white/60">
                    Комплексные решения из листового металла для объекта.
                  </p>
                  <div className="mt-5 flex justify-between border-t border-white/10 pt-4 text-[11px] text-white/50">
                    <span>{count}</span>
                    <span>{year}</span>
                  </div>
                  <Link
                    href="#project-detail"
                    className="mt-5 block text-xs font-bold text-steel-orange"
                  >
                    Открыть сценарий&nbsp; →
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <button className="mx-auto mt-8 block border border-white/25 px-5 py-3 text-xs font-bold">
            Показать ещё сценарии
          </button>
        </div>
      </section>
      <section
        id="project-detail"
        className="border-t border-white/10 bg-[#101112] py-14"
      >
        <div className="container">
          <p className="text-xs text-white/40">
            Главная　›　Проектные сценарии　›　Жилой комплекс
          </p>
          <div className="mt-7 grid gap-5 xl:grid-cols-[.85fr_2fr_1.1fr]">
            <aside className="border border-white/10 bg-[#111519] p-5">
              <Link
                href="/projects"
                className="border border-white/20 px-3 py-2 text-xs"
              >
                ← К списку сценариев
              </Link>
              <h3 className="mt-7 text-xs font-bold uppercase">О проекте</h3>
              <dl className="mt-4 space-y-3 text-xs">
                {[
                  ["Тип объекта", "Жилой комплекс"],
                  ["География", "Российская Федерация"],
                  ["Статус", "Демонстрационный сценарий"],
                  ["Исходные данные", "Проект и спецификация заказчика"],
                  ["Объёмы", "Определяются после расчёта"],
                ].map(([term, value]) => (
                  <div
                    key={term}
                    className="flex justify-between gap-3 text-white/55"
                  >
                    <dt>{term}</dt>
                    <dd className="text-right text-white">{value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
            <div>
              <h2 className="text-3xl font-semibold">Жилой комплекс — типовой сценарий</h2>
              <p className="mt-3 text-sm text-white/60">
                Комплексные решения из листового металла для фасадов, кровли,
                технических зон и инженерных систем.
              </p>
              <div className="relative mt-6 aspect-video overflow-hidden bg-[#192026]">
                <img
                  src="/images/web/project-residential.jpg"
                  width={1080}
                  height={608}
                  alt="Визуализация жилого комплекса"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="mt-5 grid grid-cols-4 gap-3">
                {[
                  ["Фасад", "архитектурные элементы"],
                  ["Климат", "корзины и кронштейны"],
                  ["Кровля", "парапеты и ограждения"],
                  ["Инженерия", "люки и решётки"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <b className="text-2xl text-steel-orange">{value}</b>
                    <p className="mt-1 text-[10px] text-white/50">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <aside className="border border-white/10 bg-[#111519] p-5">
              <h3 className="text-lg font-semibold">Возможный состав поставки</h3>
              <ul className="mt-5 space-y-3">
                {supplied.map(([item, value]) => (
                  <li
                    key={item}
                    className="flex justify-between gap-3 text-xs text-white/65"
                  >
                    <span className="before:mr-2 before:text-steel-orange before:content-['•']">
                      {item}
                    </span>
                    <b className="whitespace-nowrap text-white">{value}</b>
                  </li>
                ))}
              </ul>
              <Link
                href="/solutions"
                className="mt-6 block border border-white/25 px-4 py-3 text-xs font-bold"
              >
                Смотреть все изделия проекта&nbsp; →
              </Link>
            </aside>
          </div>
          <div className="mt-8 flex flex-col justify-between gap-5 border border-white/15 bg-[#14181b] p-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-semibold">Есть похожий проект?</h3>
              <p className="mt-2 text-sm text-white/55">
                Рассчитаем стоимость и предложим оптимальное решение.
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
