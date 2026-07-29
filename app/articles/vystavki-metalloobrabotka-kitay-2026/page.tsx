import Link from "next/link";
import type { Metadata } from "next";
import { ArticleCommercialLinks } from "@/components/ArticleCommercialLinks";
import {
  ConfirmedExhibitionsTable,
  type ConfirmedExhibition,
} from "@/components/ConfirmedExhibitionsTable";
import { ExhibitionChoiceTable, type ExhibitionChoiceRow } from "@/components/ExhibitionChoiceTable";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import { chinaExhibitions2026 } from "@/data/china-exhibitions-2026";
import { articleSchema, breadcrumbSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

const pagePath = "/articles/vystavki-metalloobrabotka-kitay-2026";
const pageTitle = "Календарь выставок по металлообработке в Китае — 2026–2027";
const pageDescription = "Проверенный календарь выставок Китая на 2026–2027 годы: станки, лазерная резка, гибка, штамповка, сварка, роботизация, мехобработка, литьё и материалы.";
const checkedAt = "2026-07-28";

export const metadata: Metadata = createPageMetadata({
  title: pageTitle,
  description: pageDescription,
  path: pagePath,
  image: "/images/web/cycle-laser-cutting.jpg",
  keywords: [
    "выставки металлообработки Китай 2026",
    "выставки металлообработки Китай 2027",
    "выставки станков Китай 2026",
    "выставки станков Китай 2027",
    "выставки лазерной резки Китай",
    "выставки робототехники Китай",
    "MetalForm China 2026",
    "MWCS 2026",
    "CCMT 2026",
    "ITES China 2027",
  ],
});

const priorityStyles = {
  "Главная рекомендация": "border-steel-orange bg-steel-orange text-white",
  "Высокий приоритет": "border-steel-orange/55 bg-steel-orange/10 text-steel-orange",
  "По конкретной задаче": "border-white/25 bg-white/[.04] text-white/72",
  "Специализированная": "border-white/15 bg-transparent text-white/48",
} as const;

const confirmedExhibitions2027: ConfirmedExhibition[] = [
  {
    name: "ITES China 2027",
    date: "24–27 марта 2027",
    city: "Шэньчжэнь, Китай",
    venue: "Shenzhen World Exhibition & Convention Center, Bao’an",
    focus:
      "Листовая и трубная металлообработка, лазерные комплексы, гибка, сварка, станки, роботизация, автоматизация и точное производство.",
    url: "https://global.iteschina.com/en/about",
  },
];

const choiceRows: ExhibitionChoiceRow[] = [
  {
    task: "Лазерная резка и лазерная сварка",
    primary: "Laser World of Photonics / MWCS",
    primaryDate: "18–20 марта / 12–16 октября 2026",
    alternative: "MetalForm China / CIEX",
    alternativeDate: "24–27 июня / 18–21 марта 2026",
    focus: "Лазерные комплексы, источники, автоматическая загрузка, контроль реза и сварочные ячейки",
  },
  {
    task: "Гибка, панелегибы и штамповка",
    primary: "MetalForm China",
    primaryDate: "24–27 июня 2026",
    alternative: "CCMT / MWCS",
    alternativeDate: "21–25 апреля / 12–16 октября 2026",
    focus: "Листогибы, панелегибы, прессы, оснастка, роботизированная подача и контроль геометрии",
  },
  {
    task: "Механическая обработка",
    primary: "CCMT",
    primaryDate: "21–25 апреля 2026",
    alternative: "ITES / DMP",
    alternativeDate: "ITES: 31 марта – 3 апреля 2026 / 24–27 марта 2027; DMP: 3–6 декабря 2026",
    focus: "Обрабатывающие центры, токарные станки, инструмент, измерение и цифровое управление",
  },
  {
    task: "Роботизация производства",
    primary: "MWCS + Robotics Show",
    primaryDate: "12–16 октября 2026",
    alternative: "ITES / SIA",
    alternativeDate: "ITES: 31 марта – 3 апреля 2026 / 24–27 марта 2027; SIA: 3–5 июня 2026",
    focus: "Роботы, манипуляторы, машинное зрение, автоматические склады и интеграция линий",
  },
  {
    task: "Сварка и сборка",
    primary: "MWCS / MetalForm China",
    primaryDate: "12–16 октября / 24–27 июня 2026",
    alternative: "AMTS / CIEX",
    alternativeDate: "8–10 июля / 18–21 марта 2026",
    focus: "Роботизированная сварка, позиционеры, сборочные стенды, контроль шва и безопасность",
  },
  {
    task: "Трубы и профили",
    primary: "Tube China",
    primaryDate: "21–24 сентября 2026",
    alternative: "DMP",
    alternativeDate: "3–6 декабря 2026",
    focus: "Резка труб, профилегибочное оборудование, сварные линии, измерение и обработка торцов",
  },
  {
    task: "Литьё и термообработка",
    primary: "Metal China",
    primaryDate: "6–9 мая 2026",
    alternative: "Northeast Asia Foundry",
    alternativeDate: "1–4 сентября 2026",
    focus: "Литьё, дробемётная очистка, печи, термообработка и подготовка тяжёлых деталей",
  },
  {
    task: "Металл, сплавы и снабжение",
    primary: "Shanghai Metals Expo",
    primaryDate: "16–19 ноября 2026",
    alternative: "Tube China",
    alternativeDate: "21–24 сентября 2026",
    focus: "Листовой металл, специальные сплавы, покрытия, трубы, профили и поставщики сырья",
  },
];

function eventStatus(endDate: string) {
  return new Date(`${endDate}T23:59:59+08:00`).getTime() < Date.now() ? "Завершена" : "Предстоит";
}

export default function ChinaExhibitions2026Page() {
  const upcoming = chinaExhibitions2026.filter((event) => eventStatus(event.endDate) === "Предстоит");
  const editorialChoice = chinaExhibitions2026.filter((event) => event.priority === "Главная рекомендация");

  return (
    <PageLayout
      path={pagePath}
      eyebrow="Промышленный календарь · Китай"
      title={pageTitle}
      description="Крупные профессиональные площадки 2026 года и уже подтверждённые даты 2027 года: официальные ссылки, состав оборудования и понятная навигация по задачам."
      image="/images/web/cycle-laser-cutting.jpg"
      imageBrightness
    >
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Главная", path: "/" },
            { name: "Статьи", path: "/articles" },
            { name: pageTitle, path: pagePath },
          ]),
          articleSchema({
            headline: pageTitle,
            description: pageDescription,
            path: pagePath,
            image: "/images/web/cycle-laser-cutting.jpg",
            datePublished: checkedAt,
            dateModified: checkedAt,
            citations: [
              ...chinaExhibitions2026.map((event) => event.url),
              ...confirmedExhibitions2027.map((event) => event.url),
            ],
          }),
        ]}
      />

      <section className="border-y border-white/10 bg-[#090d10] py-12 sm:py-16">
        <div className="container">
          <div className="grid gap-px border border-white/12 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["14", "выставок 2026–2027"],
              [String(upcoming.length), "ещё пройдут в 2026 году"],
              ["9", "направлений технологий"],
              ["28.07", "дата проверки календаря"],
            ].map(([number, label]) => (
              <div key={label} className="bg-[#101519] p-6">
                <p className="font-mono text-3xl font-bold text-steel-orange">{number}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-[.1em] text-white/58">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-4xl text-sm leading-7 text-white/52">
            В Китае проходят сотни региональных промышленных мероприятий. В календарь включены
            крупные международные и национальные выставки с подтверждёнными датами и понятной
            ценностью для металлообработки. Перед покупкой билетов повторно проверьте дату на
            официальном сайте организатора.
          </p>
        </div>
      </section>

      <section className="bg-[#0c1013] py-14 sm:py-20">
        <div className="container">
          <div className="flex flex-col justify-between gap-5 border-b border-white/12 pb-6 lg:flex-row lg:items-end">
            <div>
              <p className="eyebrow">Выбор редакции</p>
              <h2 className="mt-3 max-w-4xl text-3xl font-semibold uppercase leading-tight sm:text-4xl">
                Ключевые выставки по листовой металлообработке
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-white/55">
              Выделили площадки, наиболее близкие к листовой обработке, гибке, лазеру,
              сварке и производственной автоматизации.
            </p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {editorialChoice.map((event, index) => (
              <a
                key={event.id}
                href={`#${event.id}`}
                className="group border border-steel-orange/40 bg-[#111519] p-6 transition hover:-translate-y-1 hover:border-steel-orange"
              >
                <div className="flex items-start justify-between gap-5">
                  <span className="font-mono text-2xl font-bold text-steel-orange">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[.12em] text-white/38">
                    {event.city}
                  </span>
                </div>
                <h3 className="mt-7 text-xl font-semibold leading-tight">{event.shortName}</h3>
                <p className="mt-3 text-sm font-bold text-steel-orange">{event.dateLabel}</p>
                <p className="mt-5 text-sm leading-7 text-white/58">{event.verdict}</p>
                <span className="mt-6 inline-block text-xs font-bold uppercase text-steel-orange">
                  Смотреть программу&nbsp; ↓
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#15191c] py-14 sm:py-20">
        <div className="container">
          <p className="eyebrow">Быстрый выбор</p>
          <h2 className="mt-3 text-3xl font-semibold uppercase sm:text-4xl">Выставка под вашу задачу</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/55">
            Сначала выберите технологию, затем основную площадку. Последняя колонка показывает,
            какое оборудование и решения искать на стендах.
          </p>
          <ExhibitionChoiceTable rows={choiceRows} />
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#0c1013] py-14 sm:py-20">
        <div className="container">
          <div className="flex flex-col justify-between gap-5 border-b border-white/12 pb-6 lg:flex-row lg:items-end">
            <div>
              <p className="eyebrow">Календарь 2027</p>
              <h2 className="mt-3 max-w-4xl text-3xl font-semibold uppercase leading-tight sm:text-4xl">
                Подтверждённые выставки 2027 года
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-white/55">
              В таблицу включаем только даты, уже опубликованные организаторами на официальных
              сайтах. Неподтверждённые даты не прогнозируем.
            </p>
          </div>
          <ConfirmedExhibitionsTable events={confirmedExhibitions2027} />
          <p className="mt-5 border-l-2 border-steel-orange bg-[#111519] px-5 py-4 text-sm leading-7 text-white/56">
            Для остальных китайских выставок расписание 2027 года организаторами пока не
            опубликовано. Таблица будет дополняться по мере официального подтверждения дат.
          </p>
        </div>
      </section>

      <section className="bg-[#0c1013] py-14 sm:py-20">
        <div className="container">
          <div className="flex flex-col justify-between gap-5 border-b border-white/12 pb-6 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Полный календарь</p>
              <h2 className="mt-3 text-3xl font-semibold uppercase sm:text-4xl">Выставки по датам</h2>
            </div>
            <p className="text-xs uppercase tracking-[.12em] text-white/38">Данные проверены 28 июля 2026</p>
          </div>

          <div className="mt-8 space-y-5">
            {chinaExhibitions2026.map((event, index) => {
              const status = eventStatus(event.endDate);
              return (
                <article
                  id={event.id}
                  key={event.id}
                  className="scroll-mt-24 overflow-hidden border border-white/12 bg-[#111519] transition hover:border-white/25"
                >
                  <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="relative border-b border-white/10 bg-[#0b0f12] p-6 lg:border-b-0 lg:border-r">
                      <span className="font-mono text-3xl font-bold text-steel-orange">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p className="mt-8 text-lg font-semibold leading-tight">{event.dateLabel}</p>
                      <p className="mt-3 text-sm text-white/48">{event.city}</p>
                      <span className={`mt-6 inline-block border px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] ${status === "Предстоит" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/15 text-white/35"}`}>
                        {status}
                      </span>
                    </div>

                    <div className="p-6 sm:p-8">
                      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                        <div>
                          <span className={`inline-block border px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] ${priorityStyles[event.priority]}`}>
                            {event.priority}
                          </span>
                          <h3 className="mt-4 text-2xl font-semibold leading-tight">{event.name}</h3>
                          <p className="mt-2 text-sm font-semibold text-steel-orange">{event.shortName}</p>
                        </div>
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-xs font-bold uppercase text-steel-orange"
                        >
                          Официальный сайт&nbsp; ↗
                        </a>
                      </div>

                      <p className="mt-5 max-w-4xl text-sm leading-7 text-white/60">{event.focus}</p>
                      <p className="mt-3 text-xs leading-5 text-white/38">{event.venue}</p>

                      <div className="mt-7 flex flex-wrap gap-2">
                        {event.areas.map((area) => (
                          <span key={area} className="border border-white/12 bg-white/[.025] px-3 py-2 text-[10px] font-bold uppercase tracking-[.08em] text-white/58">
                            {area}
                          </span>
                        ))}
                      </div>

                      <div className="mt-8 grid gap-8 xl:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-steel-orange">
                            Что будет представлено
                          </p>
                          <ul className="mt-4 space-y-3">
                            {event.equipment.map((item) => (
                              <li key={item} className="flex gap-3 text-sm leading-6 text-white/64">
                                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 bg-steel-orange" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-steel-orange">
                            Для кого
                          </p>
                          <ul className="mt-4 space-y-3">
                            {event.audience.map((item) => (
                              <li key={item} className="flex gap-3 text-sm leading-6 text-white/64">
                                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 border border-steel-orange" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-8 border-l-2 border-steel-orange bg-[#0c1013] px-5 py-4">
                        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/38">Практический смысл</p>
                        <p className="mt-2 text-sm font-medium leading-6 text-white/78">{event.verdict}</p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#15191c] py-12">
        <div className="container grid gap-6 border border-white/12 bg-[#101214] p-7 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="eyebrow">Перед поездкой</p>
            <h2 className="mt-3 text-2xl font-semibold uppercase">Сформируйте технический маршрут</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/58">
              Заранее определите нужные операции, производительность, материал, размеры деталей,
              уровень автоматизации и бюджет. Тогда выставка превратится из прогулки по стендам в
              предметное сравнение оборудования.
            </p>
          </div>
          <Link href="/contacts#contact-form" className="clip-corner bg-steel-orange px-7 py-4 text-center text-xs font-bold uppercase">
            Обсудить производственную задачу&nbsp; →
          </Link>
        </div>
      </section>

      <section className="bg-[#0c1013] py-14 sm:py-20">
        <div className="container">
          <ArticleCommercialLinks direction="metalworking" />
        </div>
      </section>
    </PageLayout>
  );
}
