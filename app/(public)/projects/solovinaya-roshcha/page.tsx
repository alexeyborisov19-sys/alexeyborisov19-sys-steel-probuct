import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import { createPageMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

const path = "/projects/solovinaya-roshcha";

export const metadata: Metadata = createPageMetadata({
  title: "Соловьиная роща — поставки металлоизделий",
  description: "Многолетняя работа с объектами микрорайона «Соловьиная роща» в Смоленске: металлокассеты, кронштейны, металлические корпуса, ящики и изделия по проектной документации.",
  path,
  image: "/images/industries/residential.jpg",
  keywords: [
    "Соловьиная роща Смоленск металлокассеты",
    "Сталь Продукт Соловьиная роща",
    "металлоизделия для жилого комплекса",
    "металлокассеты для застройщика",
  ],
});

const houses = [
  "ул. Александра Степанова, 12",
  "ул. Александра Степанова, 14",
  "ул. Александра Степанова, 4",
  "ул. Александра Степанова, 6",
  "ул. Александра Степанова, 6, стр. 1",
];

const caseSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Соловьиная роща: многолетняя работа с крупным микрорайоном",
  url: absoluteUrl(path),
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
        image="/images/industries/residential.jpg"
        imageAlt="Иллюстрация жилой застройки — кейс микрорайона «Соловьиная роща»"
      >
        <article className="bg-[#0c1013] py-14 sm:py-20">
          <div className="container max-w-6xl">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-start">
              <div>
                <p className="eyebrow">Масштаб сотрудничества</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">От отдельных партий к системной работе по объектам микрорайона</h2>
                <p className="mt-5 text-base leading-8 text-white/68">«Соловьиная роща» — один из наиболее значимых кластеров в портфолио поставок. Это длительная работа не с одной фасадной плоскостью, а с несколькими жилыми объектами и социальной инфраструктурой развивающегося микрорайона.</p>
                <p className="mt-5 text-base leading-8 text-white/68">В разные периоды для проектов микрорайона поставлялись металлокассеты, кронштейны, металлические корпуса и ящики, а также другие изделия по рабочей документации. Мы сознательно не приписываем одинаковый состав поставки каждому из перечисленных домов: конкретная номенклатура определялась документацией отдельного заказа.</p>
              </div>
              <div className="border border-steel-orange/35 bg-[#111519] p-6">
                <p className="text-xs font-bold uppercase tracking-[.12em] text-steel-orange">Партнёр / застройщик</p>
                <p className="mt-3 text-xl font-semibold">АО СЗ «Ваш дом»</p>
                <p className="mt-4 text-sm leading-7 text-white/58">Официальные материалы застройщика описывают «Соловьиную рощу» как крупный развивающийся микрорайон и показывают несколько очередей «Нового квартала».</p>
                <a href="https://zao-vash-dom.ru/" target="_blank" rel="noreferrer" className="mt-5 inline-flex text-xs font-bold uppercase text-steel-orange">Официальный сайт&nbsp; ↗</a>
              </div>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                ["78 га", "территория проекта по данным застройщика"],
                ["27 га", "площадь парковой зоны по данным застройщика"],
                ["Несколько очередей", "жилые дома и общественная инфраструктура"],
              ].map(([value, label]) => (
                <div key={value} className="border border-white/12 bg-[#111519] p-5">
                  <p className="text-3xl font-semibold text-steel-orange">{value}</p>
                  <p className="mt-2 text-sm leading-6 text-white/52">{label}</p>
                </div>
              ))}
            </div>

            <section className="mt-14 grid gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
              <div className="relative aspect-[4/3] overflow-hidden border border-white/12 bg-[#172026]">
                <Image src="/images/industries/residential.jpg" alt="Иллюстрация категории жилой застройки для кейса «Соловьиная роща»" fill sizes="(max-width: 1023px) 100vw, 45vw" className="object-cover brightness-[.85]" />
                <span className="absolute bottom-3 left-3 border border-white/15 bg-black/60 px-3 py-2 text-[10px] uppercase tracking-[.08em] text-white/60">Иллюстрация категории — не фотография конкретной поставки</span>
              </div>
              <div>
                <p className="font-mono text-sm font-bold text-steel-orange">01</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Жилые очереди «Нового квартала»</h2>
                <p className="mt-5 text-base leading-8 text-white/68">На официальном сайте застройщика представлены уже сданные и строящиеся дома по улице Александра Степанова. Для производственного партнёра такой масштаб означает повторяемые серии, большое количество типоразмеров и необходимость устойчиво работать с изменениями между очередями.</p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {houses.map((house) => <div key={house} className="border-l border-steel-orange/55 pl-3 text-sm leading-6 text-white/58">{house}</div>)}
                </div>
                <p className="mt-5 text-xs leading-6 text-white/42">Перечень выше показывает масштаб текущей застройки по официальному сайту. Он не означает одинаковую поставку «Сталь Продукт» на каждый адрес.</p>
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
                ].map(([title, text]) => (
                  <div key={title} className="bg-[#111519] p-5">
                    <h3 className="font-semibold text-steel-orange">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/55">{text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-14 grid gap-6 border-y border-white/12 py-9 lg:grid-cols-[1fr_.9fr]">
              <div>
                <p className="font-mono text-sm font-bold text-steel-orange">03</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Лицей — инфраструктура того же микрорайона</h2>
                <p className="mt-5 text-base leading-8 text-white/68">Работа с «Соловьиной рощей» не ограничивается жилыми домами. В микрорайоне создан многопрофильный лицей, а для образовательного объекта также поставлялись металлические изделия по проекту. Это важная часть кейса: производство поддерживает не отдельную категорию здания, а разную инфраструктуру одной территории.</p>
                <a href="https://zao-vash-dom.ru/news/tpost/3pdd77zkf1-mnogoprofilnii-litsei-v-solovinoi-rosche" target="_blank" rel="noreferrer" className="mt-5 inline-flex text-xs font-bold uppercase text-steel-orange">Материал застройщика о лицее&nbsp; ↗</a>
              </div>
              <div className="relative min-h-72 overflow-hidden border border-white/12 bg-[#172026]">
                <Image src="/images/industries/educational.jpg" alt="Иллюстрация образовательного объекта — лицей в «Соловьиной роще»" fill sizes="(max-width: 1023px) 100vw, 45vw" className="object-cover brightness-[.9]" />
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
                ].map(([title, text]) => (
                  <div key={title} className="border border-white/12 bg-[#111519] p-5">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/55">{text}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-14 flex flex-col justify-between gap-5 border border-steel-orange/35 bg-gradient-to-r from-steel-orange/12 to-transparent p-6 sm:flex-row sm:items-center sm:p-8">
              <div>
                <h2 className="text-xl font-semibold uppercase">Посмотреть другие реальные объекты</h2>
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
