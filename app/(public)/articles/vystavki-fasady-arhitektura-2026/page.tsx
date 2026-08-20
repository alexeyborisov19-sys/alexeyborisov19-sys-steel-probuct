import Link from "next/link";
import type { Metadata } from "next";
import {
  ConfirmedExhibitionsTable,
  type ConfirmedExhibition,
} from "@/components/ConfirmedExhibitionsTable";
import { ExhibitionChoiceTable, type ExhibitionChoiceRow } from "@/components/ExhibitionChoiceTable";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import { TrackedPromotionLink } from "@/components/TrackedPromotionLink";
import { facadeExhibitions2026 } from "@/data/facade-exhibitions-2026";
import { articleSchema, breadcrumbSchema, eventListSchema, faqSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

const pagePath = "/articles/vystavki-fasady-arhitektura-2026";
const pageTitle = "Выставки фасадов и архитектурных инноваций — 2026–2027";
const pageDescription = "Проверенный календарь фасадных и архитектурных выставок России, Китая и Дубая на 2026–2027 годы: даты, технологии, аудитория и официальные сайты.";
const checkedAt = "2026-08-19";

export const metadata: Metadata = createPageMetadata({
  title: pageTitle,
  description: pageDescription,
  path: pagePath,
  image: "/images/industries/business-center.png",
  keywords: [
    "выставки фасадов 2026",
    "выставки фасадов 2027",
    "архитектурные выставки 2026",
    "архитектурные выставки 2027",
    "выставки фасадов Китай",
    "выставки фасадов Дубай",
    "выставки фасадов Россия",
    "календарь фасадных выставок 2026",
    "выставки навесных фасадов 2026",
    "выставки металлокассет и фасадных панелей",
    "выставки светопрозрачных конструкций 2026",
    "выставки архитектурного стекла 2026",
    "фасадный конгресс Россия 2026",
    "facade exhibition Dubai 2026",
    "facade expo China 2026",
    "FENESTRATION BAU CHINA 2026",
    "Facades of Russia 2026",
    "Big 5 Global Dubai 2026",
    "MosBuild 2027",
    "Building Skin Russia 2027",
    "АРХ Москва 2027",
    "RosBuild 2027",
  ],
});

const countryCode = {
  Россия: "RU",
  Китай: "CN",
  ОАЭ: "AE",
} as const;

const confirmedFacadeExhibitions2027 = [
  {
    id: "rosbuild-2027",
    name: "RosBuild 2027",
    shortName: "RosBuild",
    date: "24–26 февраля 2027",
    startDate: "2027-02-24",
    endDate: "2027-02-26",
    city: "Москва",
    countryCode: "RU",
    venue: "ВК «Тимирязев Центр»",
    focus:
      "Строительные и отделочные материалы, фасадные изделия, технологии строительства и деловая программа Российской строительной недели.",
    keywords: ["строительные материалы", "фасадные изделия", "технологии строительства"],
    audience: ["производители", "застройщики", "архитекторы", "строительные компании"],
    url: "https://rosbuild-expo.ru/",
  },
  {
    id: "building-skin-russia-2027",
    name: "Building Skin Russia 2027",
    shortName: "Building Skin Russia",
    date: "4–5 марта 2027",
    startDate: "2027-03-04",
    endDate: "2027-03-05",
    city: "Москва",
    countryCode: "RU",
    venue: "Деловой центр «Амбер Плаза»",
    focus:
      "Фасады, окна, кровля, изоляционные материалы, инженерные узлы и практические решения для оболочки здания.",
    keywords: ["фасады", "окна", "кровля", "изоляция", "оболочка здания"],
    audience: ["фасадные инженеры", "архитекторы", "проектировщики", "производители"],
    url: "https://buildingskin.ru/?EXPO77=2167",
  },
  {
    id: "mosbuild-2027",
    name: "MosBuild 2027",
    shortName: "MosBuild",
    date: "30 марта – 2 апреля 2027",
    startDate: "2027-03-30",
    endDate: "2027-04-02",
    city: "Москва",
    countryCode: "RU",
    venue: "МВЦ «Крокус Экспо»",
    focus:
      "Фасады и кровля, оконные технологии, строительные материалы, инструмент, инженерные решения и контакты участников российского рынка.",
    keywords: ["фасады и кровля", "оконные технологии", "строительные материалы"],
    audience: ["девелоперы", "архитекторы", "дистрибьюторы", "строительные компании"],
    url: "https://mosbuild.com/ru/about/",
  },
  {
    id: "arch-moscow-2027",
    name: "АРХ Москва 2027",
    shortName: "АРХ Москва",
    date: "26–29 мая 2027",
    startDate: "2027-05-26",
    endDate: "2027-05-29",
    city: "Москва",
    countryCode: "RU",
    venue: "Гостиный Двор",
    focus:
      "Архитектура, девелопмент, материалы и технологии, новые фасадные концепции, городская среда и профессиональные дискуссии.",
    keywords: ["архитектура", "девелопмент", "материалы", "фасадные концепции"],
    audience: ["архитекторы", "девелоперы", "дизайнеры", "производители материалов"],
    url: "https://www.archmoscow.ru/",
  },
] satisfies Array<
  ConfirmedExhibition & {
    id: string;
    shortName: string;
    startDate: string;
    endDate: string;
    countryCode: string;
    keywords: string[];
    audience: string[];
  }
>;

const faqItems = [
  {
    question: "Какие выставки фасадов ещё пройдут в 2026 году?",
    answer:
      "После 27 июля 2026 года в календаре остаются Фасадная неделя России в Москве, FENESTRATION BAU CHINA вместе с BAU China и CADE в Пекине, а также Big 5 Global в Дубае. Перед поездкой даты необходимо повторно проверить на официальном сайте организатора.",
  },
  {
    question: "Какая выставка полезнее производителю металлических фасадов и металлокассет?",
    answer:
      "Для российского рынка наиболее профильна Фасадная неделя России, для поиска систем, материалов и комплектующих в Китае — FENESTRATION BAU CHINA, а для международных партнёров и рынка стран Персидского залива — Big 5 Global Dubai.",
  },
  {
    question: "Куда ехать за оконными и светопрозрачными фасадными системами?",
    answer:
      "Наиболее насыщенная системная экспозиция представлена на Windoor Facade Expo и FENESTRATION BAU CHINA. Для архитектурного стекла и оборудования глубокой переработки особенно полезны China Glass и российская выставка «Мир стекла».",
  },
  {
    question: "Какая выставка подходит для выхода на рынок ОАЭ?",
    answer:
      "Big 5 Global полезна для коммерческих контактов, международных поставок и знакомства с рынком. Zak World of Façades Dubai больше ориентирована на фасадных инженеров, высотные оболочки и техническую практику жаркого климата.",
  },
  {
    question: "Какие фасадные выставки уже подтверждены на 2027 год?",
    answer:
      "Официально подтверждены RosBuild 24–26 февраля, Building Skin Russia 4–5 марта, MosBuild 30 марта – 2 апреля и АРХ Москва 26–29 мая 2027 года. Для остальных событий даты будут добавлены после публикации организаторами.",
  },
] as const;

const priorityStyles = {
  "Главная рекомендация": "border-steel-orange bg-steel-orange text-white",
  "Высокий приоритет": "border-steel-orange/55 bg-steel-orange/10 text-steel-orange",
  "По конкретной задаче": "border-white/25 bg-white/[.04] text-white/72",
  "Специализированная": "border-white/15 bg-transparent text-white/48",
} as const;

const countryStyles = {
  Россия: "border-sky-300/30 bg-sky-300/[.06] text-sky-200",
  Китай: "border-red-300/30 bg-red-300/[.06] text-red-200",
  ОАЭ: "border-amber-300/30 bg-amber-300/[.06] text-amber-200",
} as const;

const choiceRows: ExhibitionChoiceRow[] = [
  {
    task: "Металлические фасады и НВФ",
    primary: "Фасадная неделя России / Building Skin Russia",
    primaryDate: "21–24 сентября 2026 / 4–5 марта 2027",
    alternative: "MosBuild / FBC",
    alternativeDate: "MosBuild: 31 марта – 3 апреля 2026 / 30 марта – 2 апреля 2027; FBC: 28–30 октября 2026",
    focus: "Металлокассеты, панели, подсистемы, крепёж, утепление и противопожарные узлы",
  },
  {
    task: "Светопрозрачные фасады",
    primary: "FBC / Windoor Facade Expo",
    primaryDate: "28–30 октября / 11–13 марта 2026",
    alternative: "Мир стекла",
    alternativeDate: "4–6 марта 2026",
    focus: "Профильные системы, модульные фасады, фурнитура, герметизация и монтажные решения",
  },
  {
    task: "Архитектурное стекло",
    primary: "China Glass",
    primaryDate: "7–10 апреля 2026",
    alternative: "Мир стекла",
    alternativeDate: "4–6 марта 2026",
    focus: "Фасадное стекло, закалка, ламинация, покрытия, стеклопакеты и оборудование переработки",
  },
  {
    task: "Архитектурные материалы и идеи",
    primary: "CADE + FBC",
    primaryDate: "28–30 октября 2026",
    alternative: "АРХ Москва",
    alternativeDate: "27–30 мая 2026 / 26–29 мая 2027",
    focus: "Новые поверхности, выразительные фасады, цифровое проектирование и архитектурные концепции",
  },
  {
    task: "Российский строительный рынок",
    primary: "MosBuild",
    primaryDate: "31 марта – 3 апреля 2026 / 30 марта – 2 апреля 2027",
    alternative: "RosBuild / YugBuild",
    alternativeDate: "RosBuild: 4–6 марта 2026 / 24–26 февраля 2027; YugBuild: 25–28 февраля 2026",
    focus: "Готовые фасадные изделия, строительные материалы, комплектующие и контакты участников рынка",
  },
  {
    task: "Высотные фасады и жаркий климат",
    primary: "Zak World of Façades Dubai",
    primaryDate: "25 июня 2026",
    alternative: "Big 5 Global",
    alternativeDate: "23–26 ноября 2026",
    focus: "Высотные оболочки, солнцезащита, энергоэффективность, сложные узлы и инженерная практика",
  },
  {
    task: "Международный рынок и ОАЭ",
    primary: "Big 5 Global Dubai",
    primaryDate: "23–26 ноября 2026",
    alternative: "Zak World of Façades Dubai",
    alternativeDate: "25 июня 2026",
    focus: "Building Envelope, сертификация, материалы, подрядчики и международные поставки",
  },
];

function eventStatus(endDate: string) {
  return new Date(`${endDate}T23:59:59Z`).getTime() < Date.now() ? "Завершена" : "Предстоит";
}

export default function FacadeExhibitions2026Page() {
  const upcoming = facadeExhibitions2026.filter((event) => eventStatus(event.endDate) === "Предстоит");
  const editorialChoice = facadeExhibitions2026.filter(
    (event) => event.priority === "Главная рекомендация" && eventStatus(event.endDate) === "Предстоит",
  );

  return (
    <PageLayout
      path={pagePath}
      eyebrow="Фасады · Архитектура · Международный календарь"
      title="Выставки фасадов и архитектуры — 2026–2027"
      description="Профессиональные события 2026 года и уже подтверждённые даты 2027 года: материалы, фасадные системы, архитектурное стекло, оборудование и технологии оболочки здания."
      image="/images/industries/business-center.png" imageAlt="Фасад бизнес-центра, облицованный металлокассетами"
      imageBrightness
    >
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Главная", path: "/" },
            { name: "Инженерный журнал «Сталь Продукт»", path: "/articles" },
            { name: pageTitle, path: pagePath },
          ]),
          articleSchema({
            headline: pageTitle,
            description: pageDescription,
            path: pagePath,
            image: "/images/industries/business-center.png",
            datePublished: checkedAt,
            dateModified: checkedAt,
            citations: [
              ...facadeExhibitions2026.map((event) => event.url),
              ...confirmedFacadeExhibitions2027.map((event) => event.url),
            ],
          }),
          eventListSchema({
            name: pageTitle,
            description: pageDescription,
            path: pagePath,
            events: [
              ...facadeExhibitions2026.map((event) => ({
                id: event.id,
                name: event.name,
                shortName: event.shortName,
                startDate: event.startDate,
                endDate: event.endDate,
                city: event.city,
                countryCode: countryCode[event.country],
                venue: event.venue,
                officialUrl: event.url,
                description: event.focus,
                keywords: [...event.areas, ...event.technologies],
                audience: event.audience,
              })),
              ...confirmedFacadeExhibitions2027.map((event) => ({
                id: event.id,
                name: event.name,
                shortName: event.shortName,
                startDate: event.startDate,
                endDate: event.endDate,
                city: event.city,
                countryCode: event.countryCode,
                venue: event.venue,
                officialUrl: event.url,
                description: event.focus,
                keywords: event.keywords,
                audience: event.audience,
              })),
            ],
          }),
          faqSchema([...faqItems]),
        ]}
      />

      <section className="border-y border-white/10 bg-[#090d10] py-12 sm:py-16">
        <div className="container">
          <div className="grid gap-px border border-white/12 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["16", "событий 2026–2027"],
              [String(upcoming.length), "ещё пройдут в 2026 году"],
              ["3", "страны и рынка"],
              ["19.08", "дата проверки календаря"],
            ].map(([number, label]) => (
              <div key={label} className="bg-[#101519] p-6">
                <p className="font-mono text-3xl font-bold text-steel-orange">{number}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-[.1em] text-white/58">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            {[
              ["Россия", "7 событий", "Фасадные системы, архитектура, стекло и прямой контакт с российскими застройщиками."],
              ["Китай", "3 события", "Системы, материалы, комплектующие, глубокая переработка стекла и производственные технологии."],
              ["Дубай", "2 события", "Высотные оболочки, жаркий климат, инженерия сложных фасадов и рынок стран Персидского залива."],
            ].map(([country, count, copy]) => (
              <div key={country} className="border border-white/12 bg-[#111519] p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-lg font-semibold uppercase">{country}</h2>
                  <span className="font-mono text-sm font-bold text-steel-orange">{count}</span>
                </div>
                <p className="mt-4 text-sm leading-7 text-white/55">{copy}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 max-w-5xl text-sm leading-7 text-white/52">
            В календарь включены крупные отраслевые события, даты которых подтверждены официальными
            организаторами. Локальные мероприятия без опубликованной программы не учитывались.
            Перед покупкой билетов и бронированием поездки повторно проверьте расписание на сайте выставки.
          </p>
        </div>
      </section>

      <section className="bg-[#0c1013] py-14 sm:py-20">
        <div className="container">
          <div className="flex flex-col justify-between gap-5 border-b border-white/12 pb-6 lg:flex-row lg:items-end">
            <div>
              <p className="eyebrow">Выбор редакции</p>
              <h2 className="mt-3 max-w-4xl text-3xl font-semibold uppercase leading-tight sm:text-4xl">
                Куда ещё можно успеть в 2026 году
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-white/55">
              Три наиболее содержательные предстоящие площадки: российская инженерная практика,
              китайская продуктовая экосистема и международный рынок Дубая.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {editorialChoice.map((event, index) => (
              <a
                key={event.id}
                href={`#${event.id}`}
                className="group relative overflow-hidden border border-steel-orange/40 bg-[#111519] p-6 transition hover:-translate-y-1 hover:border-steel-orange"
              >
                <div className="flex items-start justify-between gap-5">
                  <span className="font-mono text-3xl font-bold text-steel-orange">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={`border px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] ${countryStyles[event.country]}`}>
                    {event.country}
                  </span>
                </div>
                <h3 className="mt-7 text-xl font-semibold leading-tight">{event.shortName}</h3>
                <p className="mt-3 text-sm font-bold text-steel-orange">{event.dateLabel}</p>
                <p className="mt-5 text-sm leading-7 text-white/58">{event.verdict}</p>
                <span className="mt-6 inline-block text-xs font-bold uppercase text-steel-orange">
                  Смотреть программу&nbsp; ↓
                </span>
                <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-steel-orange transition duration-500 group-hover:scale-x-100" />
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
            Таблица построена по типу задачи: основная выставка, дополнительная площадка и
            конкретные технологии, которые стоит искать в экспозиции.
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
              Отдельная таблица с датами, городами, площадками и направлением каждой выставки.
              Все даты сверены с официальными сайтами организаторов.
            </p>
          </div>
          <ConfirmedExhibitionsTable events={confirmedFacadeExhibitions2027} />
          <p className="mt-5 border-l-2 border-steel-orange bg-[#111519] px-5 py-4 text-sm leading-7 text-white/56">
            События в Китае и Дубае на 2027 год будут добавлены после официальной публикации
            расписания. Неподтверждённые даты в календаре не показываем.
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
            {facadeExhibitions2026.map((event, index) => {
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
                      <div className="mt-5 flex flex-wrap gap-2">
                        <span className={`border px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] ${countryStyles[event.country]}`}>
                          {event.country}
                        </span>
                        <span className={`border px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] ${status === "Предстоит" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/15 text-white/35"}`}>
                          {status}
                        </span>
                      </div>
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
                        <TrackedPromotionLink
                          href={event.url}
                          external
                          eventName="exhibition_official_click"
                          params={{
                            exhibition: event.shortName,
                            country: event.country,
                            location: "facade_exhibition_calendar",
                          }}
                          className="shrink-0 text-xs font-bold uppercase text-steel-orange"
                        >
                          Официальный сайт&nbsp; ↗
                        </TrackedPromotionLink>
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
                            {event.technologies.map((item) => (
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
            <p className="eyebrow">Важное уточнение</p>
            <h2 className="mt-3 text-2xl font-semibold uppercase">Building Skin Russia подтверждён на 2027 год</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/58">
              Весенний форум Building Skin Russia состоится 4–5 марта 2027 года в Москве,
              в деловом центре «Амбер Плаза». Дата внесена в таблицу 2027 года и связана
              с официальной страницей организатора.
            </p>
          </div>
          <TrackedPromotionLink
            href="/contacts#contact-form"
            eventName="exhibition_quote_click"
            params={{ location: "facade_exhibition_calendar", intent: "facade_project" }}
            className="clip-corner bg-steel-orange px-7 py-4 text-center text-xs font-bold uppercase"
          >
            Обсудить фасадную задачу&nbsp; →
          </TrackedPromotionLink>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0c1013] py-14 sm:py-20">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr]">
            <div>
              <p className="eyebrow">Практическая навигация</p>
              <h2 className="mt-3 text-3xl font-semibold uppercase leading-tight sm:text-4xl">
                Связанные фасадные решения
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/58">
                Календарь помогает выбрать выставку, а наши производственные разделы — перейти
                от идеи и найденной технологии к конкретному изделию из листового металла.
              </p>
            </div>
            <div className="grid gap-px border border-white/12 bg-white/10 sm:grid-cols-2">
              {[
                ["Металлокассеты", "Стандартные, премиальные, рельефные и ажурные решения.", "/products/metallokassety"],
                ["Доборные элементы", "Откосы, отливы, парапетные крышки, аквилоны и отсечки.", "/products/dobornye-elementy"],
                ["Инженерные системы", "Изделия для комплексного монтажа и инженерной инфраструктуры.", "/solutions/engineering"],
                ["Расчёт проекта", "Передайте чертёж или описание задачи инженерному отделу.", "/contacts#contact-form"],
              ].map(([title, copy, href]) => (
                <Link
                  key={title}
                  href={href}
                  className="group bg-[#111519] p-6 transition hover:bg-[#151b1f]"
                >
                  <h3 className="text-base font-semibold uppercase transition group-hover:text-steel-orange">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/52">{copy}</p>
                  <span className="mt-5 inline-block text-xs font-bold uppercase text-steel-orange">
                    Открыть&nbsp; →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#15191c] py-14 sm:py-20">
        <div className="container">
          <p className="eyebrow">Коротко о главном</p>
          <h2 className="mt-3 max-w-4xl text-3xl font-semibold uppercase leading-tight sm:text-4xl">
            Вопросы о фасадных выставках 2026–2027 годов
          </h2>
          <div className="mt-8 grid gap-3 lg:grid-cols-2">
            {faqItems.map((item, index) => (
              <details
                key={item.question}
                className="group border border-white/12 bg-[#101417] p-6 open:border-steel-orange/45"
              >
                <summary className="flex cursor-pointer list-none items-start gap-4 text-base font-semibold leading-6">
                  <span className="font-mono text-sm font-bold text-steel-orange">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{item.question}</span>
                  <span className="ml-auto text-steel-orange transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-5 border-t border-white/10 pt-5 text-sm leading-7 text-white/62">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
