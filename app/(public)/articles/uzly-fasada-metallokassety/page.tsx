import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { JsonLd } from "@/components/JsonLd";
import { articleSchema, breadcrumbSchema, faqSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

const path = "/articles/uzly-fasada-metallokassety";
const title = "Узлы фасада из металлокассет: окна, углы, парапет";
const description = "Какие узлы проверить до запуска металлокассет в серию: окна, наружные и внутренние углы, парапет, цоколь, деформационный шов и водоотведение.";

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path,
  image: "/images/web/hero-main.webp",
  keywords: [
    "узлы фасада металлокассеты",
    "примыкание металлокассет к окну",
    "угол фасада металлокассеты",
    "парапет металлокассеты",
    "цоколь металлокассеты",
    "узлы вентфасада металлокассеты",
    "доборные элементы фасада",
  ],
  openGraphType: "article",
  publishedTime: "2026-09-12",
  modifiedTime: "2026-09-12",
});

const faqItems = [
  {
    question: "Почему узлы нужно прорабатывать до запуска рядовых кассет?",
    answer: "Потому что окно, угол, парапет и цоколь задают границы рядовой сетки. Если сначала выпустить большой объём типовых кассет, а потом решать примыкания, часто приходится менять крайние размеры и доборные элементы.",
  },
  {
    question: "Можно ли использовать один узел для открытых и закрытых кассет?",
    answer: "Механически переносить узел нельзя. У закрытой кассеты верхний и нижний борта имеют разную замковую геометрию и монтажную последовательность, поэтому нужно проверять возможность физической установки и зацепа в конкретном примыкании.",
  },
  {
    question: "Какие данные нужны производителю для проверки узлов?",
    answer: "Нужны фасадная раскладка, разрезы и узлы проёмов, углов, парапета и цоколя, размеры кассет, направление монтажа, материал и покрытие, а также требования к доборным элементам.",
  },
];

const nodes = [
  ["Окно", "Отлив, откосы, верхнее примыкание, торцы, доступ к креплению и вывод воды."],
  ["Наружный угол", "Стык двух фасадных плоскостей, геометрия углового элемента и сохранение шага сетки."],
  ["Внутренний угол", "Монтажный доступ, компенсация отклонений основания и сопряжение доборов."],
  ["Парапет", "Завершение верхнего ряда, крышка, свес, водоотвод и возможность поставить последнюю кассету."],
  ["Цоколь", "Старт фасада, нижний добор, выпуск воды и согласование отметки нижнего ряда."],
  ["Деформационный шов", "Разделение фасадных полей и сохранение проектной подвижности узла."],
] as const;

export default function FacadeNodesArticle() {
  return (
    <>
      <JsonLd data={[
        articleSchema({
          headline: "Узлы важнее рядовой кассеты: где фасад из металлокассет теряет геометрию",
          description,
          path,
          image: "/images/web/hero-main.webp",
          datePublished: "2026-09-12",
          dateModified: "2026-09-12",
          citations: ["/documents/katalog-fasadnyh-resheniy-stal-produkt.pdf"],
        }),
        breadcrumbSchema([
          { name: "Главная", path: "/" },
          { name: "Инженерный журнал", path: "/articles" },
          { name: "Узлы фасада из металлокассет", path },
        ]),
        faqSchema(faqItems),
      ]} />

      <PageLayout
        path={path}
        eyebrow="Инженерный журнал · Фасадная практика"
        title="Узлы важнее рядовой кассеты"
        description="Рядовая кассета повторяется сотни раз, но геометрия фасада чаще всего решается в местах, которые встречаются один раз: у окна, угла, парапета, цоколя и деформационного шва."
        image="/images/web/hero-main.webp"
      >
        <article className="bg-[#0c1013] py-14 sm:py-20">
          <div className="container max-w-5xl">
            <div className="border-y border-white/12 py-5 text-xs uppercase tracking-[.08em] text-white/45">
              <span className="text-steel-orange">12 сентября 2026</span>
              <span className="mx-3">·</span>
              <span>10 минут чтения</span>
              <span className="mx-3">·</span>
              <Link href="/products/metallokassety" className="text-steel-orange">Фасадные решения</Link>
            </div>

            <p className="mt-8 max-w-4xl text-lg leading-8 text-white/78">
              Большая плоскость фасада обычно не самая сложная часть проекта. Сетка рядовых кассет повторяется, и после настройки геометрии становится предсказуемой. Ошибки чаще проявляются там, где повторяемость заканчивается: возле окна, на углу, у парапета, внизу фасада или в зоне деформационного шва. Именно эти места стоит согласовать до того, как рядовые элементы уйдут в серию.
            </p>

            <section className="mt-10 border border-steel-orange/35 bg-[#111519] p-6 sm:p-8">
              <p className="eyebrow">Шесть узлов, которые стоит закрыть заранее</p>
              <div className="mt-5 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2">
                {nodes.map(([name, text], index) => (
                  <div key={name} className="bg-[#0d1114] p-5">
                    <p className="font-mono text-sm font-bold text-steel-orange">0{index + 1}</p>
                    <h2 className="mt-2 text-base font-semibold uppercase">{name}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/58">{text}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-12 space-y-14">
              <section>
                <p className="font-mono text-sm font-bold text-steel-orange">01</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Начинать нужно не с красивой сетки, а с границ этой сетки</h2>
                <p className="mt-5 text-base leading-8 text-white/68">Архитектурная раскладка задаёт ритм фасада, но реальная плоскость ограничена проёмами, углами, верхом и низом здания. Если сетку строить отдельно от этих зон, крайние кассеты почти неизбежно окажутся нестандартными — и это нормально. Проблема начинается, когда нестандартные размеры обнаруживаются после запуска серии.</p>
                <p className="mt-5 text-base leading-8 text-white/68">Практичнее сначала зафиксировать контрольные линии: границы окон, наружные и внутренние углы, отметку низа, парапет и деформационные швы. После этого рядовой шаг раскладывается между уже понятными узлами, а не наоборот.</p>
              </section>

              <section>
                <p className="font-mono text-sm font-bold text-steel-orange">02</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Окно: один проём — минимум четыре разных задачи</h2>
                <p className="mt-5 text-base leading-8 text-white/68">Нижняя зона окна должна отводить воду наружу фасада. Боковые откосы должны состыковаться с лицевой плоскостью и завершить торцы рядов. Верхнее примыкание должно закрыть верх проёма и при этом не сделать последнюю кассету физически неустанавливаемой. Отдельно проверяются углы и стыки этих доборов между собой.</p>
                <p className="mt-5 text-base leading-8 text-white/68">Для открытого типа важно не перекрыть доступ к монтажным полкам. Для закрытого типа этого недостаточно: нужно проверить траекторию установки и зацеп верхнего и нижнего бортов. Узел, который визуально подходит к открытому типу, может оказаться несобираемым для закрытого.</p>
                <div className="mt-6 border-l-2 border-steel-orange bg-[#111519] p-5 text-sm leading-7 text-white/68">Проверочный вопрос для любого оконного узла: можно ли поставить последнюю кассету в реальной последовательности монтажа, не разбирая уже собранные соседние элементы?</div>
              </section>

              <section>
                <p className="font-mono text-sm font-bold text-steel-orange">03</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Наружный и внутренний угол: место встречи двух раскладок</h2>
                <p className="mt-5 text-base leading-8 text-white/68">Угол — не просто согнутый лист. В нём встречаются две фасадные плоскости со своими рядами, допусками основания и привязками проёмов. Если обе раскладки независимо «дотянуть» до геометрического угла, последняя кассета на одной стороне может получиться неудобной ширины или разрушить ритм шва.</p>
                <p className="mt-5 text-base leading-8 text-white/68">Поэтому угловой элемент полезно рассматривать как часть общей сетки: заранее определить, какая сторона ведёт размер, где проходит видимая линия стыка и какие размеры крайних кассет допустимы для архитектуры и изготовления.</p>
              </section>

              <section>
                <p className="font-mono text-sm font-bold text-steel-orange">04</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Парапет: верх фасада должен быть не только закрыт, но и собираем</h2>
                <p className="mt-5 text-base leading-8 text-white/68">На парапете сходятся последняя кассета, верхний завершающий элемент и парапетная крышка. Здесь легко получить аккуратный чертёж, который невозможно собрать в принятой последовательности. Особенно чувствителен к этому закрытый тип, где зацеп соседних элементов задаёт направление установки.</p>
                <p className="mt-5 text-base leading-8 text-white/68">До выпуска металла проверяют высоту последнего ряда, способ его крепления, сопряжение с крышкой и возможность отвода воды за внешнюю плоскость. Конкретные свесы и уклоны назначаются проектом — универсальное число здесь опаснее отсутствия числа.</p>
              </section>

              <section>
                <p className="font-mono text-sm font-bold text-steel-orange">05</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Цоколь и низ фасада: стартовая линия задаёт весь верх</h2>
                <p className="mt-5 text-base leading-8 text-white/68">Первый ряд влияет на все последующие. Если нижняя отметка не увязана с отмосткой, цоколем, входными группами и проектной линией старта, ошибка повторяется по высоте или компенсируется в последнем ряду.</p>
                <p className="mt-5 text-base leading-8 text-white/68">В нижнем узле одновременно решаются геометрия стартового элемента, выпуск воды и вход воздуха в вентилируемый зазор по проектному решению. Производителю нужны не общие слова «закрыть низ», а понятный разрез с отметками и сопряжением элементов.</p>
              </section>

              <section>
                <p className="font-mono text-sm font-bold text-steel-orange">06</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Деформационный шов нельзя маскировать рядовой кассетой</h2>
                <p className="mt-5 text-base leading-8 text-white/68">Если проект предусматривает разделение фасадных полей, облицовка должна сохранить эту логику. Попытка визуально продолжить обычный ряд через зону, где конструкции должны работать независимо, превращает архитектурный приём в конструктивный конфликт.</p>
                <p className="mt-5 text-base leading-8 text-white/68">Для производства важно получить узел с границами полей и доборными элементами. Кассеты по обе стороны рассчитываются как части разных участков, а не как один непрерывный ряд.</p>
              </section>

              <section>
                <p className="font-mono text-sm font-bold text-steel-orange">07</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Водоотведение: отверстие работает только там, где после гибки действительно низ</h2>
                <p className="mt-5 text-base leading-8 text-white/68">В плоской развёртке технологическое отверстие выглядит просто как окружность. После гибки важна уже пространственная ориентация: слив должен оказаться на нижней полке установленной кассеты. Если изделие в раскладке развёрнуто на 90°, нижняя сторона меняется вместе с ним.</p>
                <p className="mt-5 text-base leading-8 text-white/68">Именно поэтому ориентация изделия должна быть частью подготовки заказа, а не устным замечанием у станка. Для длинных элементов количество точек водоотведения может увеличиваться по принятому производственному правилу, но их положение проверяется относительно монтажного низа.</p>
              </section>

              <section>
                <p className="font-mono text-sm font-bold text-steel-orange">08</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Минимальный комплект перед запуском серии</h2>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {["Фасадная раскладка с маркировкой кассет", "Разрез открытого или закрытого типа", "Оконные узлы: низ, бок, верх", "Наружные и внутренние углы", "Парапет и завершение верхнего ряда", "Цоколь и старт фасада", "Деформационные швы, если они есть", "Материал, толщина, покрытие и RAL"].map((item) => <div key={item} className="border border-white/10 bg-[#111519] p-4 text-sm leading-6 text-white/66">{item}</div>)}
                </div>
                <p className="mt-5 text-base leading-8 text-white/68">Такой комплект не отменяет рабочую документацию фасадной системы. Он позволяет изготовителю понять собственную часть задачи и обнаружить конфликт геометрии до раскроя листа, когда исправление ещё стоит времени инженера, а не готовой партии металла.</p>
              </section>
            </div>

            <section className="mt-14 border border-steel-orange/40 bg-gradient-to-r from-steel-orange/15 to-transparent p-6 sm:p-8">
              <p className="eyebrow">От узла к заказу</p>
              <h2 className="mt-3 text-2xl font-semibold uppercase">Передайте раскладку — проверим производственную часть</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/62">Можно приложить PDF, DXF, DWG, STEP, Excel или архив. «Сталь Продукт» производит и комплектует изделия; монтаж на объекте не выполняется.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/contacts#contact-form" className="clip-corner bg-steel-orange-deep px-6 py-4 text-xs font-bold uppercase">Передать проект&nbsp; →</Link>
                <Link href="/products/metallokassety" className="border border-white/25 px-6 py-4 text-xs font-bold uppercase">Металлокассеты&nbsp; →</Link>
              </div>
            </section>

            <section className="mt-14 border-t border-white/12 pt-8">
              <p className="eyebrow">Основание материала</p>
              <p className="mt-4 text-sm leading-7 text-white/58">Материал основан на рабочем каталоге узлов и примыканий «Сталь Продукт». В каталоге открытый и закрытый тип рассматриваются как разные конструкции, а узлы окон, углов, цоколя, парапета и деформационного шва — как отдельные проектные задачи.</p>
              <a href="/documents/katalog-fasadnyh-resheniy-stal-produkt.pdf" target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs font-bold uppercase text-steel-orange">Каталог узлов и примыканий&nbsp; ↗</a>
            </section>
          </div>
        </article>
      </PageLayout>
    </>
  );
}
