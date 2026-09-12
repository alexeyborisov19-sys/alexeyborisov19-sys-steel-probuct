import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { JsonLd } from "@/components/JsonLd";
import { articleSchema, breadcrumbSchema, faqSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

const path = "/articles/ploshchad-fasada-raskhod-metalla-metallokassety";
const title = "Расход металла на фасаде: русты и замки";
const description = "Почему площадь фасада не равна расходу металла: русты, крайние кассеты, замковый стык закрытого типа, проёмы и правильный предварительный расчёт.";

export const metadata: Metadata = createPageMetadata({
  title,
  description,
  path,
  image: "/images/web/hero-main.webp",
  keywords: [
    "расчет металлокассет",
    "расход металла на фасад",
    "расчет количества металлокассет",
    "руст металлокассет",
    "замок металлокассет закрытого типа",
    "фасадные металлокассеты цена",
  ],
  openGraphType: "article",
  publishedTime: "2026-09-12",
  modifiedTime: "2026-09-12",
});

const faqItems = [
  {
    question: "Почему нельзя просто разделить площадь фасада на площадь одной кассеты?",
    answer: "Потому что реальная раскладка состоит из целых рядов и колонн, между соседними открытыми кассетами есть русты, а крайние элементы не создают дополнительный шов за пределами фасада. Проёмы и обрезки также зависят от их положения, а не только от суммарной площади.",
  },
  {
    question: "Одинаково ли считают открытые и закрытые металлокассеты?",
    answer: "Нет. У открытого типа рядовой шов остаётся открытым и задаётся раскладкой. У закрытого типа горизонтальный стык формируется замковой геометрией, поэтому рабочий шаг рядов нельзя получать простым добавлением такого же руста к высоте кассеты.",
  },
  {
    question: "Можно ли получить точную стоимость только по площади стены?",
    answer: "По площади можно получить полезный бюджетный ориентир. Для точной спецификации нужны размеры стен, положение проёмов, углы, примыкания, тип кассеты, материал, покрытие и фасадная раскладка.",
  },
];

export default function FacadeAreaMetalConsumptionArticle() {
  return (
    <>
      <JsonLd data={[
        articleSchema({
          headline: "Почему площадь фасада не равна площади металла: русты, замки и реальный расход металлокассет",
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
          { name: "Расход металла на фасаде", path },
        ]),
        faqSchema(faqItems),
      ]} />

      <PageLayout
        path={path}
        eyebrow="Инженерный журнал · Фасадная практика"
        title="Почему площадь фасада не равна площади металла"
        description="Русты, замки, крайние кассеты и проёмы меняют количество изделий и фактический расход. Разбираем расчёт без производственных формул и без иллюзии точности там, где нужна раскладка."
        image="/images/web/hero-main.webp"
      >
        <article className="bg-[#0c1013] py-14 sm:py-20">
          <div className="container max-w-5xl">
            <div className="border-y border-white/12 py-5 text-xs uppercase tracking-[.08em] text-white/45">
              <span className="text-steel-orange">12 сентября 2026</span>
              <span className="mx-3">·</span>
              <span>9 минут чтения</span>
              <span className="mx-3">·</span>
              <Link href="/products/metallokassety" className="text-steel-orange">Металлокассеты</Link>
            </div>

            <p className="mt-8 max-w-4xl text-lg leading-8 text-white/78">
              Фраза «фасад 100 м²» кажется достаточной для расчёта только до первой раскладки. На практике одинаковая площадь может означать компактную стену, длинную ленту, фасад с большим количеством окон или плоскость без единого проёма. Количество кассет, число швов и доля крайних элементов будут разными — следовательно, будет отличаться и расход металла.
            </p>

            <section className="mt-10 border border-steel-orange/35 bg-[#111519] p-6 sm:p-8">
              <p className="eyebrow">Короткий инженерный вывод</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  "Площадь стены нужна для бюджета, но не заменяет раскладку.",
                  "У открытого типа руст существует только между соседними кассетами.",
                  "У закрытого типа горизонтальный шаг задаётся замком, а не вторым условным рустом.",
                  "Площадь проёмов без их положения не даёт точного количества кассет.",
                ].map((item) => <p key={item} className="border-l-2 border-steel-orange pl-4 text-sm leading-7 text-white/68">{item}</p>)}
              </div>
            </section>

            <div className="mt-12 space-y-14">
              <section>
                <p className="font-mono text-sm font-bold text-steel-orange">01</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Почему простое деление площади даёт ложную точность</h2>
                <p className="mt-5 text-base leading-8 text-white/68">Если взять площадь стены и разделить её на площадь одного лицевого элемента, получится дробное число, которое легко округлить вверх. Но такая операция не знает, сколько кассет реально помещается по ширине и высоте. Кассета — не плитка без шва: фасад собирается по архитектурной сетке, а край стены завершает ряд.</p>
                <p className="mt-5 text-base leading-8 text-white/68">Поэтому более полезная модель начинается не с квадратных метров, а с рядов и колонн. Для открытого типа между соседними кассетами задан руст. Если в ряду N кассет, межкассетных швов N−1. Добавлять ещё один полный руст после последней кассеты — значит искусственно увеличивать размер ряда.</p>
                <div className="mt-6 border border-white/12 bg-[#111519] p-5 font-mono text-sm leading-7 text-white/72">
                  Занятая ширина ряда = N × ширина кассеты + (N − 1) × руст
                </div>
              </section>

              <section>
                <p className="font-mono text-sm font-bold text-steel-orange">02</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Открытая кассета: шов виден и участвует в архитектурной сетке</h2>
                <p className="mt-5 text-base leading-8 text-white/68">У открытого типа крепёж доступен со стороны межкассетного шва, а сам рядовой шов остаётся визуально открытым. Его размер задаёт раскладка объекта. Поэтому шаг сетки по направлению ряда — это рабочий размер лицевой части плюс один межкассетный руст, но сам руст учитывается именно как расстояние между соседними элементами.</p>
                <p className="mt-5 text-base leading-8 text-white/68">Для типового примера 1170 × 545 мм при шве 20 мм шаг сетки составляет 1190 × 565 мм. Но когда известна ширина стены, количество элементов правильнее считать целыми колоннами, а не делением площади на 1190 × 565. Так крайняя кассета и последний шов учитываются логично.</p>
              </section>

              <section>
                <p className="font-mono text-sm font-bold text-steel-orange">03</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Закрытый тип: замок нельзя считать как ещё один руст</h2>
                <p className="mt-5 text-base leading-8 text-white/68">Закрытая кассета устроена иначе. Верхний и нижний борта имеют разную геометрию, нижний борт формирует рабочий зацеп, а крепёж предыдущего элемента закрывается следующей кассетой. Горизонтальный стык здесь определяется замковой геометрией и последовательностью установки.</p>
                <p className="mt-5 text-base leading-8 text-white/68">Из этого следует важное правило калькулятора: формулу открытого типа нельзя копировать и просто добавлять условные 20 мм к высоте закрытой кассеты. Рабочий шаг ряда должен соответствовать собранному замку. Именно поэтому в публичном калькуляторе «Сталь Продукт» открытый и закрытый тип считаются отдельными конструкциями.</p>
                <p className="mt-5 text-sm leading-7 text-white/50">Конкретная производственная геометрия замка и развёртки не публикуется в клиентском калькуляторе: она относится к конструкторской подготовке заказа.</p>
              </section>

              <section>
                <p className="font-mono text-sm font-bold text-steel-orange">04</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Окна: почему «вычесть 15 м²» недостаточно</h2>
                <p className="mt-5 text-base leading-8 text-white/68">Представим две стены одинаковой площади и с одинаковыми 15 м² остекления. На первой — одно большое окно, на второй — десять небольших. Вычитаемая площадь одинакова, но количество подрезок, коротких элементов и примыканий совершенно разное.</p>
                <p className="mt-5 text-base leading-8 text-white/68">Поэтому простой калькулятор может уменьшить бюджетную площадь на суммарную площадь проёмов, но не должен обещать точную спецификацию. Точное количество появляется только после того, как известны положение и размеры проёмов и построена фасадная сетка.</p>
              </section>

              <section>
                <p className="font-mono text-sm font-bold text-steel-orange">05</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Пример: стена 12 × 6 м</h2>
                <p className="mt-5 text-base leading-8 text-white/68">Для стены шириной 12 000 мм и высотой 6 000 мм открытая типовая кассета 1170 × 545 мм с рустом 20 мм даёт 11 колонн и 11 рядов — 121 позицию до корректировки на проёмы. Это результат геометрии сетки, а не просто площади 72 м².</p>
                <p className="mt-5 text-base leading-8 text-white/68">Если в стене 8 м² окон, быстрый клиентский калькулятор может дать уменьшенную предварительную оценку. Но инженер всё равно проверит раскладку: окно может совпасть с несколькими целыми модулями или, наоборот, пересечь много кассет и увеличить количество нестандартных деталей.</p>
              </section>

              <section>
                <p className="font-mono text-sm font-bold text-steel-orange">06</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Цена: почему квадратный метр фасада и квадратный метр металла — разные вещи</h2>
                <p className="mt-5 text-base leading-8 text-white/68">Лицевая площадь показывает, сколько поверхности закрывает фасад. Но за лицевой плоскостью есть борта и монтажные участки, а у закрытого типа — замковая геометрия. Поэтому производственный расход листа всегда определяется конструкцией изделия, а не одной лицевой площадью.</p>
                <p className="mt-5 text-base leading-8 text-white/68">Для клиента полезнее видеть ориентир стоимости на площадь облицовки и общую сумму заказа. Для производства используется уже другая, внутренняя модель: реальные развёртки, карта раскроя, материал, покрытие и технологический маршрут. Смешивать эти два уровня в публичном интерфейсе не нужно.</p>
              </section>

              <section>
                <p className="font-mono text-sm font-bold text-steel-orange">07</p>
                <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Что достаточно знать заказчику</h2>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {["Площадь фасада — для первого бюджета", "Ширина и высота стены — для более точного количества", "Открытый или закрытый тип кассеты", "Предполагаемая толщина металла", "Площадь проёмов — для предварительной корректировки", "Фасадная раскладка — для окончательной спецификации"].map((item) => <div key={item} className="border border-white/10 bg-[#111519] p-4 text-sm leading-6 text-white/66">{item}</div>)}
                </div>
              </section>
            </div>

            <section className="mt-14 border border-steel-orange/40 bg-gradient-to-r from-steel-orange/15 to-transparent p-6 sm:p-8">
              <p className="eyebrow">Проверить на своём объекте</p>
              <h2 className="mt-3 text-2xl font-semibold uppercase">Посчитайте площадь, количество и ориентировочный бюджет</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/62">Калькулятор работает в двух режимах: по площади и по размерам стены. Для точного предложения можно затем прикрепить раскладку или чертёж.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/calculator-metallokassety" className="clip-corner bg-steel-orange-deep px-6 py-4 text-xs font-bold uppercase">Открыть калькулятор&nbsp; →</Link>
                <Link href="/contacts#contact-form" className="border border-white/25 px-6 py-4 text-xs font-bold uppercase">Передать проект&nbsp; →</Link>
              </div>
            </section>

            <section className="mt-14 border-t border-white/12 pt-8">
              <p className="eyebrow">Основание материала</p>
              <p className="mt-4 text-sm leading-7 text-white/58">Конструктивные различия ОТ и ЗТ в этой статье опираются на рабочий каталог узлов «Сталь Продукт», подготовленный по рабочим STEP-моделям кассет. Конкретные проектные размеры и узлы всегда проверяются по документации объекта.</p>
              <a href="/documents/katalog-fasadnyh-resheniy-stal-produkt.pdf" target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs font-bold uppercase text-steel-orange">Каталог узлов и примыканий&nbsp; ↗</a>
            </section>
          </div>
        </article>
      </PageLayout>
    </>
  );
}
