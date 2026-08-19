import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
import { PageLayout } from "@/components/PageLayout";
import { ProductCard } from "@/components/ProductCard";
import { productBySlug, productGroups, products } from "@/data/products";
import { faqSchema, itemListSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Фасадные металлокассеты и доборные элементы",
  description: "Фасадные металлокассеты, откосы, отливы, парапетные крышки, аквилоны и пожарные отсечки: изготовление по размерам, чертежи и расчёт.",
  path: "/products",
  keywords: ["фасадные металлокассеты", "кассетный вентилируемый фасад", "доборные элементы", "отливы", "парапетные крышки", "купить металлокассеты", "фасадные изделия по RAL"],
});

const faqItems = [
  { question: "Какие фасадные изделия представлены в каталоге?", answer: "В каталоге собраны металлокассеты открытого и скрытого крепления, перфорированные и объёмные кассеты, откосы, отливы, аквилоны, парапетные крышки и пожарные отсечки." },
  { question: "Можно изготовить элементы по размерам объекта?", answer: "Да. Размеры, полки, материал, толщина, крепление и цвет по RAL согласуются по раскладке, узлам или рабочим чертежам." },
  { question: "Как получить цену и срок изготовления?", answer: "Передайте спецификацию, площадь или фасадную раскладку, выбранное исполнение, материал, цвет и количество. После проверки документации подготовим расчёт." },
  { question: "Чем отличается открытое крепление кассет от скрытого?", answer: "При открытом креплении элементы фиксации видны на фасаде, монтаж проще, а отдельную кассету можно снять без демонтажа соседних. Скрытое крепление даёт ровную плоскость без видимого крепежа, но требует более точной геометрии и аккуратной подсистемы. Выбор влияет и на внешний вид, и на обслуживание фасада." },
  { question: "Какой металл используется для фасадных элементов?", answer: "Обычно оцинкованная сталь с полимерным покрытием, реже нержавеющая сталь или алюминий. Материал подбирают по среде: городская атмосфера, близость к дороге с реагентами, влажный или промышленный воздух дают разные требования к защите." },
  { question: "Можно ли подобрать цвет под уже смонтированный фасад?", answer: "Цвет задают по каталогу RAL. Если часть фасада уже смонтирована, укажите номер применённого цвета и тип поверхности — глянец, мат или структура: при одном номере разные фактуры выглядят по-разному, и это заметно на большой плоскости." },
  { question: "Что такое пожарные отсечки и когда они нужны?", answer: "Это элементы, перекрывающие воздушный зазор вентилируемого фасада, чтобы он не работал как канал для распространения огня. Необходимость, расположение и исполнение определяются проектом — мы изготавливаем их по переданной документации." },
  { question: "Изготавливаете ли доборные элементы нестандартной формы?", answer: "Да. Откосы, отливы, парапетные крышки, аквилоны и примыкания делают по фактическим размерам проёмов и узлов. Для нетиповых форм достаточно эскиза с размерами или узла из проекта." },
  { question: "Как считать количество для заказа?", answer: "Для кассет отправной точкой служит фасадная раскладка или площадь с размерами карт, для доборных элементов — погонные метры по узлам и количество примыканий. Если раскладки нет, помогает планировка фасада с проёмами: по ней можно оценить состав, а точное количество зафиксировать после уточнения." },
  { question: "Что происходит с изделиями при повреждении покрытия на объекте?", answer: "Царапина до основания в уличной конструкции становится точкой старта коррозии, поэтому такие места подкрашивают. Правила обращения, хранения на площадке и подкраски лучше запросить вместе с поставкой, чтобы ремонт не откладывался до появления следов ржавчины." },
];

export default function ProductsPage() {
  return <><JsonLd data={[itemListSchema({
    name: "Фасадные решения и продукция из листового металла",
    description: "Каталог металлокассет, доборных и фасонных элементов с техническими характеристиками и чертежами.",
    path: "/products",
    items: products.map((product) => ({
      name: product.title,
      path: `/products/${product.slug}`,
    })),
  }), faqSchema(faqItems)]} /><PageLayout path="/products" eyebrow="Архитектурные решения" title="Фасадные решения из листового металла" description="Металлокассеты, доборные и фасонные элементы, изготовленные под параметры конкретного объекта." image="/images/web/hero-main.webp">
    <section className="bg-[#0c1013] py-14 sm:py-20">
      <div className="container">
        <div className="max-w-3xl border-l-2 border-steel-orange pl-5">
          <p className="text-lg font-semibold leading-relaxed">Технические данные и чертежи из каталога встроены в каждую карточку. Подберём исполнение, размеры, покрытие и цвет по RAL под ваш объект.</p>
          <div className="mt-5 flex flex-wrap gap-5 text-xs font-bold uppercase text-steel-orange"><a href="/documents/katalog-fasadnyh-resheniy-stal-produkt.pdf" target="_blank" rel="noreferrer">Скачать полный каталог PDF&nbsp; ↗</a><a href="/documents/katalog-fasadnyh-resheniy-kratkij-4-stranicy.pdf" target="_blank" rel="noreferrer">Краткий каталог - 4 страницы&nbsp; ↗</a><Link href="/contacts#contact-form">Отправить проект на расчёт&nbsp; →</Link></div>
        </div>
        {productGroups.map((group) => <section key={group.title} id={group.href?.startsWith("/products#") ? group.href.split("#")[1] : undefined} className="mt-16 first:mt-12">
          <div className="flex flex-col justify-between gap-4 border-b border-white/12 pb-5 sm:flex-row sm:items-end">
            <div><p className="eyebrow">Каталог продукции</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">{group.title}</h2></div>
            <div className="max-w-xl"><p className="text-sm leading-relaxed text-white/55">{group.description}</p>{group.href && <Link href={group.href} className="mt-3 inline-block text-xs font-bold uppercase text-steel-orange">Открыть раздел&nbsp; →</Link>}</div>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{group.slugs.map((slug) => <ProductCard key={slug} product={productBySlug[slug]} />)}</div>
        </section>)}
      </div>
    </section>
    <section className="border-t border-white/10 bg-[#101112] py-14 sm:py-20">
      <div className="container">
        <p className="eyebrow">Что определяет результат</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
          Четыре вещи, которые решают, как фасад будет выглядеть через пять лет
        </h2>
        <div className="mt-9 grid gap-6 lg:grid-cols-2">
          <article className="border border-white/12 bg-[#111519] p-6">
            <h3 className="text-lg font-semibold">Геометрия важнее толщины</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/62">Ровную плоскость держит не запас металла, а точность карты и жёсткость краёв. Отбортовка, рёбра, верный радиус гиба — кассета не «играет» на солнце и не собирает волну по шву.</p>
            <p className="mt-3 text-sm leading-relaxed text-white/62">Толщина тут решает редко. Чаще решает краевой узел. А лишний металл — это масса на подсистему и цена на весь фасад.</p>
          </article>
          <article className="border border-white/12 bg-[#111519] p-6">
            <h3 className="text-lg font-semibold">Шов — это решение, а не зазор</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/62">Ширина и ритм шва — это рисунок фасада и запас на температурное расширение сразу. Узкий шов подчёркивает любое отклонение. Широкий превращает плоскость в сетку.</p>
            <p className="mt-3 text-sm leading-relaxed text-white/62">Раскладку согласуют до раскроя. Тогда шов попадает в оси проёмов и этажей, а карты не подрезают на объекте.</p>
          </article>
          <article className="border border-white/12 bg-[#111519] p-6">
            <h3 className="text-lg font-semibold">Кромка стареет первой</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/62">На остром ребре покрытие тоньше, чем на плоскости. Значит, повредится раньше. Кромки притупляют. Сварные зоны обрабатывают отдельно: там выгорел цинк и остались брызги.</p>
            <p className="mt-3 text-sm leading-relaxed text-white/62">Это не косметика. Коррозия на фасаде начинается с кромок и стыков. Видно её через сезон-два — когда до элемента уже не добраться.</p>
          </article>
          <article className="border border-white/12 bg-[#111519] p-6">
            <h3 className="text-lg font-semibold">Комплект собирается на объекте, а не на складе</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/62">Кассеты, откосы, отливы, парапетные крышки, примыкания — это один контур. Разные партии и разная маркировка превращают монтаж в сортировку.</p>
            <p className="mt-3 text-sm leading-relaxed text-white/62">Поэтому состав ведут по зонам объекта. Маркировка, упаковка и очередь отгрузки — так, чтобы на площадке вскрывали ровно то, что идёт на фасад сегодня.</p>
          </article>
        </div>
      </div>
    </section>
    <FaqSection items={faqItems} title="Вопросы о фасадной продукции" />
  </PageLayout></>;
}
