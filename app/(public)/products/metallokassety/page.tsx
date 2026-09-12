import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
import { MetalCassetteCalculator } from "@/components/MetalCassetteCalculator";
import { ManufacturingProofSection } from "@/components/ManufacturingProofSection";
import { ProductCard } from "@/components/ProductCard";
import { metalCassetteSpecs, productBySlug } from "@/data/products";
import { faqSchema, productGroupSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Фасадные металлокассеты от производителя | Сталь Продукт",
  description: "Фасадные металлокассеты открытого и закрытого типа от производителя. Расчёт количества и ориентировочной цены онлайн, изготовление по размерам, RAL и проектной документации.",
  path: "/products/metallokassety",
  keywords: [
    "фасадные металлокассеты",
    "металлокассеты цена",
    "металлокассеты от производителя",
    "кассетный фасад",
    "металлокассеты открытого типа",
    "металлокассеты закрытого типа",
    "металлокассеты скрытого крепления",
    "изготовление металлокассет",
    "фасадные кассеты цена за м2",
    "угловые металлокассеты",
  ],
});

const faqItems = [
  { question: "Чем отличаются металлокассеты открытого и закрытого типа?", answer: "У открытого исполнения крепёж остаётся доступным на монтажных полках, а рядовой шов визуально открыт. У закрытого верхний и нижний борта имеют разную геометрию, крепёж предыдущего элемента закрывается следующей кассетой, а горизонтальный стык формируется замком. Поэтому раскладка и узлы для двух типов считаются отдельно." },
  { question: "Можно ли заранее оценить цену металлокассет?", answer: "Да. Калькулятор на странице показывает ориентировочную стоимость и количество по площади фасада или размерам стены. Финальная цена подтверждается после проверки раскладки, покрытия, проёмов, углов, доборных элементов и объёма партии." },
  { question: "Какие толщины доступны в онлайн-калькуляторе?", answer: "Для предварительного расчёта доступны 0,65; 0,7; 1,0 и 1,2 мм. Финальная толщина определяется требованиями проекта, размером кассеты и принятой конструкцией фасада." },
  { question: "Можно изготовить кассеты нестандартного размера и цвета?", answer: "Да. Размеры, полки, материал, покрытие, цвет по RAL и другие параметры согласуются по фасадной раскладке, узлам или рабочим чертежам объекта." },
  { question: "Что нужно для точного расчёта фасада?", answer: "Лучше всего передать фасадные развёртки или раскладку, размеры и тип кассет, цвет, толщину, сведения о проёмах, наружных и внутренних углах, парапете, цоколе и доборных элементах. На форме можно прикрепить PDF, DXF, DWG, STEP, Excel и архивы." },
  { question: "Поставляете металлокассеты в Москву и другие регионы?", answer: "Да. Производство находится в Смоленске. Комплектацию, упаковку и логистику согласуем под объект и объём партии; монтаж на объекте не выполняем." },
];

const series = [
  ["Стандарт", "Открытый крепёж", "Рациональное исполнение с доступным крепежом и открытым швом. Подходит, когда важны понятная монтажная схема и локальная замена отдельных элементов."],
  ["Премиум", "Скрытый крепёж", "Несимметричная замковая геометрия скрывает точки фиксации и формирует более цельную фасадную плоскость. Узлы и последовательность установки проверяются отдельно."],
  ["Рельеф", "3D-геометрия", "Объёмные кассеты создают выраженную светотень. Профиль, глубина и технологичность согласуются по архитектурной задаче и рабочей документации."],
  ["Ажур", "Перфорация", "Перфорация формирует рисунок, прозрачность и работу фасада со светом. Паттерн и процент открытой площади проверяются до серийного выпуска."],
] as const;

const cassetteSlugs = [
  "metallokassety-standart",
  "metallokassety-premium",
  "metallokassety-relef",
  "metallokassety-azhur",
];

const comparison = [
  ["Крепёж", "Доступен со стороны межкассетного шва", "Скрывается следующей кассетой"],
  ["Горизонтальный стык", "Открытый руст по раскладке", "Формируется замковой геометрией"],
  ["Последовательность", "Проще локально обслуживать", "Важно соблюдать направление установки"],
  ["Расчёт количества", "Учитываются межкассетные русты", "Учитывается рабочий шаг замка"],
  ["Применение", "Технологичный выраженный ритм", "Визуально более цельная плоскость"],
] as const;

export default function MetalCassetteCollectionPage() {
  const cassetteProducts = cassetteSlugs.map((slug) => productBySlug[slug]);

  return (
    <>
      <JsonLd data={[
        productGroupSchema({
          name: "Фасадные металлокассеты «Сталь Продукт»",
          description: "Фасадные металлокассеты открытого и закрытого типа, объёмные и перфорированные решения, изготовление по проектным размерам.",
          path: "/products/metallokassety",
          groupId: "steelprodukt-metallokassety",
          products: cassetteProducts,
        }),
        faqSchema(faqItems),
      ]} />

      <PageLayout
        path="/products/metallokassety"
        eyebrow="Фасадные решения"
        title="Фасадные металлокассеты от производителя"
        description="Открытые и закрытые металлокассеты, угловые и архитектурные исполнения. Рассчитайте ориентировочную цену и количество онлайн или передайте фасадную раскладку для точного коммерческого расчёта."
        image="/images/web/hero-main.webp"
      >
        <section className="bg-[#0c1013] py-14 sm:py-20">
          <div className="container">
            <div className="grid gap-6 border border-white/12 bg-[#111519] p-6 lg:grid-cols-[1.1fr_.9fr] lg:p-8">
              <div>
                <p className="eyebrow">Производство полного цикла</p>
                <h2 className="mt-3 max-w-2xl text-2xl font-semibold uppercase leading-tight sm:text-3xl">От фасадной раскладки до готовой партии</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62">«Сталь Продукт» производит металлокассеты и связанные фасонные элементы по проектным размерам. Открытый и закрытый тип рассматриваются как разные конструкции: отличается крепление, рядовой стык, монтажная последовательность и логика расчёта.</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="#calculator-metallokasset" className="clip-corner bg-steel-orange-deep px-5 py-3 text-xs font-bold uppercase">Рассчитать цену&nbsp; ↓</Link>
                  <Link href="/contacts#contact-form" className="border border-white/25 px-5 py-3 text-xs font-bold uppercase transition hover:border-steel-orange hover:text-steel-orange">Отправить проект&nbsp; →</Link>
                  <a href="/documents/katalog-fasadnyh-resheniy-stal-produkt.pdf" target="_blank" rel="noreferrer" className="border border-steel-orange/45 px-5 py-3 text-xs font-bold uppercase text-steel-orange">Каталог PDF&nbsp; ↗</a>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs leading-5 text-white/50">Параметры конкретного заказа подтверждаются по проекту и рабочим узлам до запуска партии.</p>
                <dl className="grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2">
                  {metalCassetteSpecs.map((spec) => (
                    <div key={spec.label} className="bg-[#0d1012] p-4">
                      <dt className="text-xs font-bold uppercase tracking-[.12em] text-steel-orange">{spec.label}</dt>
                      <dd className="mt-2 text-xs leading-relaxed text-white/70">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            <section className="mt-12 border-y border-white/12 py-8">
              <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
                <div>
                  <p className="eyebrow">Цена металлокассет</p>
                  <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Сначала бюджет — затем точная раскладка</h2>
                </div>
                <div className="space-y-4 text-sm leading-7 text-white/62">
                  <p>Цена фасада зависит не только от площади стены. На расход и количество влияют формат кассеты, межкассетные швы, замковая геометрия закрытого типа, проёмы, углы и доборные элементы.</p>
                  <p>Поэтому публичный калькулятор показывает ориентировочный бюджет и количество, но не раскрывает производственные развёртки и не подменяет рабочую документацию.</p>
                </div>
              </div>
            </section>

            <MetalCassetteCalculator />

            <section className="mt-16">
              <div className="border-b border-white/12 pb-5">
                <p className="eyebrow">Открытый или закрытый тип</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Две разные конструкции, а не один профиль крепежа</h2>
              </div>
              <div className="mt-6 overflow-x-auto border border-white/12">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead className="bg-[#111519] text-xs uppercase tracking-[.08em] text-white/55">
                    <tr><th className="p-4">Параметр</th><th className="p-4 text-steel-orange">Открытая ОТ</th><th className="p-4 text-steel-orange">Закрытая ЗТ</th></tr>
                  </thead>
                  <tbody>
                    {comparison.map((row) => (
                      <tr key={row[0]} className="border-t border-white/10">
                        <th className="bg-[#0f1316] p-4 font-semibold text-white/78">{row[0]}</th>
                        <td className="p-4 leading-6 text-white/60">{row[1]}</td>
                        <td className="p-4 leading-6 text-white/60">{row[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold uppercase">
                <Link href="/products/metallokassety-standart" className="text-steel-orange">Открытые кассеты&nbsp; →</Link>
                <Link href="/products/metallokassety-premium" className="text-steel-orange">Закрытые кассеты&nbsp; →</Link>
              </div>
            </section>

            <section className="mt-16">
              <div className="border-b border-white/12 pb-5">
                <p className="eyebrow">Выберите исполнение</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Четыре серии металлокассет</h2>
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {series.map(([title, badge, text], index) => (
                  <article key={title} className="border border-white/10 bg-[#111519] p-5">
                    <p className="text-2xl font-semibold text-steel-orange">0{index + 1}</p>
                    <h3 className="mt-5 text-lg font-semibold uppercase">{title}</h3>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[.12em] text-white/45">{badge}</p>
                    <p className="mt-4 text-sm leading-7 text-white/60">{text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-16 grid gap-4 lg:grid-cols-2">
              <Link href="/articles/ploshchad-fasada-raskhod-metalla-metallokassety" className="group border border-white/12 bg-[#111519] p-6 transition hover:border-steel-orange/60 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[.12em] text-steel-orange">Инженерный журнал · Расчёт</p>
                <h2 className="mt-3 text-xl font-semibold uppercase leading-tight sm:text-2xl">Почему площадь фасада не равна площади металла</h2>
                <p className="mt-3 text-sm leading-7 text-white/58">Разбираем русты, крайние кассеты, замки закрытого типа, проёмы и причину, по которой одинаковые 100 м² фасада могут давать разный расход.</p>
                <span className="mt-5 inline-flex text-xs font-bold uppercase text-steel-orange">Читать материал&nbsp; →</span>
              </Link>
              <Link href="/articles/uzly-fasada-metallokassety" className="group border border-white/12 bg-[#111519] p-6 transition hover:border-steel-orange/60 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[.12em] text-steel-orange">Инженерный журнал · Узлы</p>
                <h2 className="mt-3 text-xl font-semibold uppercase leading-tight sm:text-2xl">Узлы важнее рядовой кассеты: где фасад теряет геометрию</h2>
                <p className="mt-3 text-sm leading-7 text-white/58">Окна, углы, парапет, цоколь, деформационные швы и водоотведение: что проверить до запуска металла в серию.</p>
                <span className="mt-5 inline-flex text-xs font-bold uppercase text-steel-orange">Читать материал&nbsp; →</span>
              </Link>
            </section>

            <div className="mt-16 flex flex-col justify-between gap-5 border-b border-white/12 pb-5 sm:flex-row sm:items-end">
              <div><p className="eyebrow">Серии в деталях</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Каталог металлокассет</h2></div>
              <a href="/documents/katalog-fasadnyh-resheniy-stal-produkt.pdf" target="_blank" rel="noreferrer" className="text-xs font-bold uppercase text-steel-orange">Открыть полный PDF-каталог&nbsp; ↗</a>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {cassetteProducts.map((product) => <ProductCard key={product.slug} product={product} />)}
            </div>
          </div>
        </section>

        <ManufacturingProofSection />
        <FaqSection items={faqItems} title="Вопросы о фасадных металлокассетах" />

        <section className="border-t border-white/10 bg-[#17191a] py-10">
          <div className="container flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="eyebrow">Расчёт под объект</p>
              <h2 className="mt-2 text-2xl font-semibold uppercase">Есть фасадная раскладка или спецификация?</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/58">Передайте исходные данные. Проверим тип кассет, узлы, размеры и состав поставки и подготовим точное коммерческое предложение.</p>
            </div>
            <Link href="/contacts#contact-form" className="clip-corner whitespace-nowrap bg-steel-orange-deep px-8 py-4 text-sm font-bold uppercase">Получить расчёт&nbsp; →</Link>
          </div>
        </section>
      </PageLayout>
    </>
  );
}
