import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { solutions } from "@/data/solutions";
import { createPageMetadata } from "@/lib/seo";
import { faqSchema, itemListSchema } from "@/lib/schema";

export const metadata: Metadata = createPageMetadata({
  title: "Инженерные решения из листового металла",
  description:
    "Архитектурные, климатические, промышленные и инженерные решения из листового металла: проектирование, производство по чертежам и поставка по России.",
  path: "/solutions",
  keywords: [
    "инженерные решения из листового металла",
    "металлоизделия на заказ",
    "производство по чертежам",
    "металлоизделия для промышленности",
    "контрактное производство изделий",
  ],
});

const faqItems = [
  { question: "Как выбрать подходящий раздел решений?", answer: "Для фасадов и архитектурных элементов откройте каталог продукции, для корпусов и оборудования — промышленное направление, для кронштейнов и опор — инженерные системы. Нестандартные изделия ведём как индивидуальный проект." },
  { question: "Можно заказать только изготовление по готовым чертежам?", answer: "Да. Работаем по КД заказчика, DXF, DWG, STEP и спецификациям. При необходимости инженер проверит технологичность до запуска." },
  { question: "Можно объединить несколько изделий в одну поставку?", answer: "Да. Состав решения можно комплектовать по узлам, зонам объекта или сборочным единицам с согласованной маркировкой и упаковкой." },
  { question: "Что нужно передать, чтобы получить расчёт?", answer: "Чертёж, модель или эскиз, материал и толщину, количество, требования к покрытию и условия эксплуатации. Если изделие встраивается в существующий узел, нужны сведения о креплении и сопрягаемых деталях. При отсутствии чертежей достаточно образца, фотографии или описания задачи." },
  { question: "Изготавливаете единичные изделия или только серии?", answer: "И то и другое. В единичном изделии доля подготовительных операций в стоимости выше, чем в партии, поэтому при повторяющейся потребности выгоднее сразу обсудить объём и периодичность поставок." },
  { question: "Что делать, если чертежей нет, а есть образец?", answer: "Снимаем геометрию с образца и готовим документацию, по которой изделие можно повторять. Это же применимо к импортным изделиям, снятым с поставки: конструкцию адаптируем под доступные материалы и технологию." },
  { question: "Из каких материалов изготавливаете изделия?", answer: "Работаем с холоднокатаной, оцинкованной и нержавеющей сталью, а также с алюминием. Материал подбирают по среде эксплуатации, нагрузке, требованиям к массе и внешнему виду — выбор фиксируют в документации до запуска." },
  { question: "Можно ли доработать конструкцию после опытного образца?", answer: "Да, это штатная часть работы. На образце видно поведение материала после гибки, фактическую геометрию сварной сборки, качество покрытия и собираемость с ответными деталями. Согласованные изменения вносят в документацию до серии." },
  { question: "Как изделия упаковывают и готовят к перевозке?", answer: "Способ упаковки зависит от геометрии, покрытия и условий перевозки: видимые поверхности защищают от истирания, острые кромки — от повреждения соседних деталей. Маркировку согласовывают заранее, чтобы на объекте изделия расходились по зонам без пересортицы." },
  { question: "Чем инженерная проверка отличается от изготовления по чертежам?", answer: "Изготовление по чертежам воспроизводит переданную документацию. Инженерная проверка выполняется до запуска и отвечает на другой вопрос: изготовимо ли изделие в таком виде, нет ли избыточных требований и не помешает ли конструкция сборке. Проверка не заменяет расчёт ответственных конструкций." },
];

export default function SolutionsPage() {
  return (
    <>
    <JsonLd data={[itemListSchema({ name: "Инженерные решения из листового металла", description: "Решения для архитектуры, климатического оборудования, промышленности и инженерной инфраструктуры.", path: "/solutions", items: solutions.map((solution) => ({ name: solution.title, path: solution.href })) }), faqSchema(faqItems)]} />
    <PageLayout
      path="/solutions"
      eyebrow="Решения"
      title="Инженерные решения из листового металла"
      description="Готовые решения и производство изделий по техническому заданию для строительства, промышленности и инженерной инфраструктуры."
      image="/images/web/hero-main.webp"
    >
      <section className="bg-[#0c1013] py-14">
        <div className="container grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {solutions.map((solution, index) => (
            <article
              key={solution.title}
              className="border border-white/10 bg-[#111519] p-6"
            >
              <div
                className={`solution-media -mx-6 -mt-6 mb-6 aspect-video ${solution.imageClassName ?? ""}`}
                style={{ backgroundImage: `url('${solution.image}')` }}
              />
              <span className="text-2xl text-steel-orange">
                {solution.icon}
              </span>
              <h2 className="mt-3 text-xl font-semibold uppercase">
                {solution.title}
              </h2>
              <p className="mt-4 min-h-14 text-sm leading-relaxed text-white/60">
                {solution.text}
              </p>
              <ul className="mt-5 border-t border-white/10">
                {solution.items.slice(0, 5).map((item) => (
                  <li key={item} className="border-b border-white/10 text-sm">
                    <Link
                      href={solution.href}
                      className="flex items-center justify-between py-3 transition hover:text-steel-orange"
                    >
                      <span>{item}</span>
                      <span className="text-steel-orange">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={solution.href}
                className="mt-6 inline-block border border-steel-orange px-4 py-3 text-xs font-bold uppercase text-steel-orange"
              >
                Перейти в раздел&nbsp; →
              </Link>
              {index === 0 && (
                <a
                  href="/documents/katalog-fasadnyh-resheniy-stal-produkt.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-4 mt-6 inline-block text-xs font-bold uppercase text-white/55 transition hover:text-steel-orange"
                >
                  PDF-каталог&nbsp; ↗
                </a>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="border-t border-white/10 bg-[#101112] py-14 sm:py-20">
        <div className="container">
          <p className="eyebrow">Порядок работы</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
            Как решение проходит путь от задачи до поставки
          </h2>
          <div className="mt-9 grid gap-6 lg:grid-cols-2">
            <article className="border border-white/12 bg-[#111519] p-6">
              <h3 className="text-lg font-semibold">Разбор задачи и исходных данных</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/62">Работа начинается с того, что изделие должно делать: какую нагрузку нести, в какой среде стоять, с чем сопрягаться и как обслуживаться. Ответы определяют материал, толщину, тип соединений и покрытие — и обычно сразу отсекают часть вариантов.</p>
              <p className="mt-3 text-sm leading-relaxed text-white/62">Исходными данными может быть комплект документации, модель, эскиз или существующий образец. Недостающее уточняем до запуска, чтобы неоднозначные размеры и требования не всплывали уже внутри партии.</p>
            </article>
            <article className="border border-white/12 bg-[#111519] p-6">
              <h3 className="text-lg font-semibold">Проверка технологичности</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/62">Конструкция, безупречная на экране, не всегда изготовима без потерь. Проверяем развёртки и радиусы гиба, доступ инструмента, последовательность сборки, расстояния до края у крепёжных элементов и то, как деталь поведёт себя после сварки.</p>
              <p className="mt-3 text-sm leading-relaxed text-white/62">Часть замечаний снимается заменой одного элемента: увеличенный внутренний радиус, другой тип крепежа, отбортовка вместо шва. Это не меняет функцию, но заметно влияет на стоимость и на стабильность результата в серии.</p>
            </article>
            <article className="border border-white/12 bg-[#111519] p-6">
              <h3 className="text-lg font-semibold">Опытный образец до серии</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/62">На образце видно то, чего не показывает документация: пружинение после гибки, фактическую геометрию сварного узла, поведение покрытия на кромках и собираемость с ответными деталями.</p>
              <p className="mt-3 text-sm leading-relaxed text-white/62">По результатам корректируем конструкцию и последовательность операций, фиксируем версию документации — и только после этого запускаем партию. Так вторая и пятидесятая единицы получаются такими же, как первая.</p>
            </article>
            <article className="border border-white/12 bg-[#111519] p-6">
              <h3 className="text-lg font-semibold">Изготовление, контроль и отгрузка</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/62">Маршрут планируем целиком: раскрой, формообразование, сварка и сборка, подготовка поверхности и покрытие. Порядок операций важен не меньше их качества — часть элементов устанавливают до окраски, часть после, и это фиксируют в технологии.</p>
              <p className="mt-3 text-sm leading-relaxed text-white/62">Перед отгрузкой проверяем функциональные параметры: диагонали, плоскостность посадочных поверхностей, собираемость с ответными деталями, состояние покрытия. Упаковку и маркировку согласовываем под условия перевозки и приёмки на объекте.</p>
            </article>
          </div>
        </div>
      </section>
      <FaqSection items={faqItems} title="Вопросы об инженерных решениях" />
    </PageLayout>
    </>
  );
}
