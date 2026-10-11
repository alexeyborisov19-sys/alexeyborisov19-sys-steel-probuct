import Link from "next/link";
import type { Metadata } from "next";
import {
  ConfirmedExhibitionsTable,
  type ConfirmedExhibition,
} from "@/components/ConfirmedExhibitionsTable";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import { articleSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

const pagePath = "/articles/vystavki-svarka-2026-2027";
const pageTitle = "Выставки сварки и сварочных технологий — 2026–2027";
const checkedAt = "2026-10-11";
const description =
  "Предстоящие выставки сварки и резки в России и Китае: подтверждённые даты, места проведения и ссылки на организаторов. Обновлено 11 октября 2026 года.";

export const metadata: Metadata = createPageMetadata({
  title: pageTitle,
  description,
  path: pagePath,
  image: "/images/web/cycle-laser-cutting.jpg",
  keywords: [
    "выставки сварки 2027",
    "выставки сварочных технологий",
    "Weldex 2027",
    "Beijing Essen Welding Cutting 2027",
    "выставки сварки и резки Китай 2026",
  ],
});

const exhibitions: ConfirmedExhibition[] = [
  {
    name: "DMP Greater Bay Area Industrial Expo — раздел Welding & Cutting",
    date: "3–6 декабря 2026",
    city: "Шэньчжэнь, Китай",
    venue: "Shenzhen World Exhibition & Convention Center (Bao’an)",
    focus:
      "Многопрофильная промышленная выставка с отдельным направлением Welding & Cutting. Это не самостоятельная выставка, посвящённая только сварке.",
    url: "https://www.dmpshow.com/en/exhibition-info/shenzhen/",
  },
  {
    name: "Beijing Essen Welding & Cutting Fair 2027",
    date: "23–26 июня 2027",
    city: "Шанхай, Китай",
    venue: "Shanghai New International Expo Centre (SNIEC)",
    focus:
      "Специализированная выставка сварочных технологий и резки. Несмотря на название Beijing Essen, площадка 2027 года находится в Шанхае.",
    url: "https://www.schweissen-schneiden.com/joining-cutting-surfacing/schweissen-schneiden-worldwide/bewc/",
  },
  {
    name: "Weldex 2027",
    date: "12–15 октября 2027",
    city: "Москва, Россия",
    venue: "МВЦ «Крокус Экспо», павильон 1, зал 4",
    focus:
      "Специализированная выставка сварочных материалов, оборудования, технологий резки и автоматизации производства.",
    url: "https://weldex.ru/ru/about/venue/",
  },
];

export default function WeldingExhibitionsPage() {
  return (
    <PageLayout
      path={pagePath}
      breadcrumbs={[
        { name: "Главная", path: "/" },
        { name: "Инженерный журнал", path: "/articles" },
        { name: "Выставки сварки", path: pagePath },
      ]}
      eyebrow="Инженерный журнал · Календарь сварочных выставок"
      title={pageTitle}
      description="Россия и Китай: профильные сварочные выставки и промышленные события с отдельной экспозицией сварки. Указаны только сроки, подтверждённые организаторами."
      image="/images/web/cycle-laser-cutting.jpg"
      imageAlt="Лазерная резка листового металла"
      imageBrightness
    >
      <JsonLd
        data={[
          articleSchema({
            headline: pageTitle,
            description,
            path: pagePath,
            image: "/images/web/cycle-laser-cutting.jpg",
            datePublished: checkedAt,
            dateModified: checkedAt,
            citations: exhibitions.map((event) => event.url),
          }),
        ]}
      />
      <section className="border-y border-white/10 bg-[#090d10] py-12 sm:py-16">
        <div className="container">
          <p className="eyebrow">Сверено с организаторами 11 октября 2026 года</p>
          <h2 className="mt-4 text-2xl font-semibold uppercase text-white sm:text-3xl">
            Предстоящие выставки
          </h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-white/65">
            В календаре отдельно обозначены специализированные сварочные выставки
            и многопрофильные мероприятия, где сварка представлена самостоятельным
            тематическим направлением. Даты и площадки могут измениться — актуальную
            информацию следует сверять на сайте организатора.
          </p>
          <ConfirmedExhibitionsTable events={exhibitions} />
          <div className="mt-10 border border-white/12 bg-[#101519] p-6">
            <h2 className="text-lg font-semibold uppercase text-white">
              Что не включено в список предстоящих
            </h2>
            <p className="mt-3 text-sm leading-7 text-white/65">
              Weldex 2026 проходила 6–9 октября и на дату обновления уже завершилась.
              MWCS 2026 в Шанхае (12–16 октября) включена в общий календарь
              металлообработки: организатор позиционирует её прежде всего как
              выставку станков и технологий обработки металла, а не отдельную
              выставку сварочных технологий.
            </p>
            <Link
              href="/articles/vystavki-metalloobrabotka-kitay-2026"
              className="mt-4 inline-block text-sm font-semibold text-steel-orange underline underline-offset-4"
            >
              Общий календарь выставок металлообработки →
            </Link>
          </div>
          <p className="mt-6 text-sm leading-7 text-white/55">
            Принцип отбора: у каждой указанной даты есть прямая ссылка на
            официальный сайт организатора или соорганизатора. Мероприятия без
            подтверждённых сроков в календарь не добавляются.
          </p>
        </div>
      </section>
    </PageLayout>
  );
}
