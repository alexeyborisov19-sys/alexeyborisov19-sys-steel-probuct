import Image from "next/image";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { commercialProductLandingBySlug } from "@/data/commercial-product-landings";
import { faqSchema } from "@/lib/schema";
import { productSchema } from "@/components/CommercialProductLandingPage";
import { basketSizeExamples } from "@/lib/quote/basket-brief";
import { BasketConfigurator } from "./BasketConfigurator";
import {
  EnquiryFinish,
  LandingNav,
  ProductionProof,
  SectionHeading,
} from "./LandingSections";

const faq = [
  {
    question: "Есть ли единый стандарт размеров корзины для кондиционера?",
    answer:
      "Размерный ряд производителя — не универсальный стандарт совместимости. На странице приведены примеры наружных габаритов из открытого каталога. Рабочие размеры выбирают по модели блока, его инструкции, сервисным зонам и проекту фасада.",
  },
  {
    question:
      "Как выбрать корзину, если известна только мощность кондиционера?",
    answer:
      "Мощности недостаточно: у разных моделей отличаются габариты, расположение патрубков и требования к воздухообмену. Передайте марку и модель наружного блока либо паспорт. До проверки оборудование не считается совместимым с выбранной корзиной.",
  },
  {
    question: "Можно изготовить корзину нестандартного размера?",
    answer:
      "Да, рассматриваем индивидуальные размеры и групповые решения. В заявке укажите габариты, количество, расположение блоков и требования проекта; конструкцию, материал и крепление согласуем до изготовления.",
  },
  {
    question: "Входят ли кронштейны и крепёж в комплект?",
    answer:
      "Комплектность фиксируем в предложении: экран, боковины, рама, кронштейны и крепёж могут входить в согласованный комплект. Несущую способность и анкеры подбирают по основанию, массе оборудования и расчётным нагрузкам.",
  },
  {
    question: "Можно выбрать цвет и рисунок перфорации?",
    answer:
      "Да, согласуем цвет по RAL, фактуру и технологичный рисунок экрана. Изображение на экране показывает цвет приблизительно; окончательный вариант подтверждают по образцу. Открытое сечение проверяют с учётом работы оборудования.",
  },
  {
    question: "Вы устанавливаете корзины на объекте?",
    answer:
      "Мы выполняем инженерную подготовку, изготовление и поставку. Монтаж на объекте не оказываем. Узел крепления и комплект поставки согласуем для работы монтажной организации.",
  },
];
export function BasketLandingPage() {
  const landing = commercialProductLandingBySlug["korziny-dlya-konditsionerov"];
  return (
    <>
      <JsonLd data={[productSchema(landing), faqSchema(faq)]} />
      <PageLayout
        path="/products/korziny-dlya-konditsionerov"
        eyebrow="Кондиционер — часть архитектуры"
        title="Корзины для кондиционеров под ваш фасад"
        description="От одной корзины до комплекта на здание. Согласуем размеры, экран, цвет и крепление — изготовим и подготовим партию к отгрузке."
        image="/images/web/solution-climate.jpg"
        imageAlt="Вариант размещения перфорированных корзин на фасаде"
      >
        <LandingNav
          items={[
            { id: "selection", label: "Размеры и цвет" },
            { id: "design", label: "Исполнения" },
            { id: "engineering", label: "Технические требования" },
            { id: "delivery", label: "Комплект поставки" },
          ]}
        />
        <section
          id="selection"
          className="scroll-mt-28 bg-[#101416] py-14 sm:py-20"
        >
          <div className="container">
            <SectionHeading
              eyebrow="01 / Подбор под задачу"
              title="Начните с размеров. Остальное согласуем."
              text="Выберите пример или введите свой наружный габарит. Сохраните задание либо передайте параметры инженеру — они автоматически появятся в заявке."
            />
            <BasketConfigurator />
            <details className="mt-5 border border-white/20 p-5">
              <summary className="cursor-pointer py-1 font-semibold">
                Откуда размеры и как проверить совместимость
              </summary>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <div className="text-sm leading-7 text-white/80">
                  <p>
                    Примеры взяты из открытого размерного ряда КОРБАС и
                    приведены в порядке «ширина × высота × глубина». Это
                    ориентиры для задания, не складские позиции «Сталь Продукт»
                    и не гарантия установки конкретного блока.
                  </p>
                  <p className="mt-3">
                    Наружный габарит корзины и полезное внутреннее пространство
                    различаются. До изготовления проверяют раму, зазоры для
                    воздуха, трасс и обслуживания по паспорту кондиционера.
                  </p>
                  <a
                    className="mt-3 inline-flex min-h-11 items-center text-steel-orange underline underline-offset-4"
                    href="https://korbas.ru/modelnyy-ryad/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Источник размерных примеров ↗
                  </a>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="pb-3 text-left text-white/75">
                      Примеры наружных размеров, мм
                    </caption>
                    <thead>
                      <tr>
                        {["Ширина", "Высота", "Глубина"].map((s) => (
                          <th
                            key={s}
                            scope="col"
                            className="border-b border-white/25 p-3"
                          >
                            {s}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {basketSizeExamples.map((s) => (
                        <tr key={s.width}>
                          {[s.width, s.height, s.depth].map((n, i) => (
                            <td
                              key={i}
                              className="border-b border-white/15 p-3 font-mono"
                            >
                              {n}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          </div>
        </section>
        <section
          id="design"
          className="scroll-mt-28 border-y border-white/15 bg-[#1a1e21] py-14 sm:py-20"
        >
          <div className="container grid gap-10 lg:grid-cols-2">
            <div>
              <SectionHeading
                eyebrow="02 / Архитектурное исполнение"
                title="Один фасад. Согласованный рисунок."
                text="Экран, боковины и цвет работают вместе с фасадной сеткой. Подбираем исполнение под архитектуру здания и расположение наружных блоков."
              />
              <div className="mt-8 space-y-5">
                {[
                  [
                    "Перфорированный экран",
                    "Круглые или щелевые отверстия; рисунок согласуется с учётом жёсткости и открытого сечения.",
                  ],
                  [
                    "Одиночная или групповая конструкция",
                    "Под один блок или несколько: количество секций и взаимное размещение фиксируем в проекте.",
                  ],
                  [
                    "Доступ для обслуживания",
                    "Сторону доступа и съёмные элементы определяем до производства — с учётом подключения и ремонта оборудования.",
                  ],
                  [
                    "Цвет и фактура",
                    "Порошковая окраска по согласованному RAL. Для серии фиксируем выбранное исполнение и контрольный образец.",
                  ],
                ].map(([title, text], i) => (
                  <article
                    key={title}
                    className="grid grid-cols-[2rem_1fr] gap-3 border-t border-white/20 pt-5"
                  >
                    <span className="font-mono text-steel-orange">
                      0{i + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/75">
                        {text}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <figure className="self-start">
              <div className="relative aspect-[4/5] overflow-hidden">
                <Image
                  src="/images/web/climate-ac-basket-r01.jpg"
                  alt="Вариант корзины с перфорированными лицевой и боковой панелями"
                  fill
                  sizes="(max-width: 1023px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="border-b border-white/20 py-4 text-sm leading-6 text-white/75">
                Визуальный пример исполнения. Геометрия, рисунок и крепление
                вашего изделия определяются согласованным чертежом.
              </figcaption>
            </figure>
          </div>
        </section>
        <section
          id="engineering"
          className="scroll-mt-28 bg-[#101416] py-14 sm:py-20"
        >
          <div className="container">
            <SectionHeading
              eyebrow="03 / До запуска в производство"
              title="Размер — только начало подбора"
              text="Для корзины важны не только внешний вид и габарит. Проверяем исходные данные, которые определяют конструкцию и её работу на фасаде."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {[
                [
                  "Воздухообмен",
                  "Положение воздухозабора и выброса, препятствия и открытое сечение экрана проверяются по инструкции конкретного кондиционера. Универсальный зазор для всех моделей не назначаем.",
                ],
                [
                  "Основание и нагрузки",
                  "Нужны тип стены или фасадной подсистемы, масса оборудования и условия размещения. Кронштейн и анкеры требуют проверки; декоративная панель сама по себе не подтверждает несущую способность.",
                ],
                [
                  "Доступ и коммуникации",
                  "Оставляем предусмотренные проектом зоны для трубопроводов, подключения, дренажа и снятия сервисных панелей. Уточняем сторону доступа до изготовления.",
                ],
                [
                  "Материал и покрытие",
                  "Материал, толщина, подготовка поверхности и система защиты выбираются по конструкции и условиям эксплуатации. Цвет RAL не заменяет требования к защите от коррозии.",
                ],
              ].map(([title, text], i) => (
                <article
                  key={title}
                  className="border border-white/20 p-6 sm:p-8"
                >
                  <span className="font-mono text-sm text-steel-orange">
                    ПРОВЕРКА 0{i + 1}
                  </span>
                  <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                  <p className="mt-3 leading-7 text-white/75">{text}</p>
                </article>
              ))}
            </div>
            <aside className="mt-6 border-l-2 border-steel-orange bg-white/[.04] p-6">
              <h3 className="font-semibold">Какие нормы учитывать</h3>
              <p className="mt-3 text-sm leading-7 text-white/80">
                Для расчёта нагрузок проектировщик использует применимую
                редакцию СП 20.13330.2016 «Нагрузки и воздействия» с
                изменениями. Воздушные и сервисные зазоры — из инструкции
                оборудования. Размеры и узел крепления — из проектной
                документации. Это разные проверки: типоразмер из каталога не
                подтверждает соответствие всему проекту.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <a
                  className="inline-flex min-h-11 items-center text-steel-orange underline underline-offset-4"
                  href="https://protect.gost.ru/sp/details/bac9e1fe-45f1-401b-8e32-949f4ee27821"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  СП 20 в фонде Росстандарта ↗
                </a>
                <a
                  className="inline-flex min-h-11 items-center text-steel-orange underline underline-offset-4"
                  href="https://www.daikin.eu/content/dam/document-library/installation-manuals/ac/split/ftxn-l/FTXN-L-RXN-L_Installation%20manuals_English.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Пример инструкции производителя · PDF ↗
                </a>
              </div>
            </aside>
          </div>
        </section>
        <section className="border-y border-white/15 bg-[#181c1f] py-6">
          <div className="container flex flex-wrap gap-x-8 gap-y-2">
            {[
              [
                "/solutions/climate",
                "Комплексные решения для климатического оборудования",
              ],
              [
                "/production/poroshkovaya-okraska-metalla",
                "Порошковая окраска",
              ],
              ["/solutions/custom", "Изготовление по чертежам"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
              >
                {label} →
              </Link>
            ))}
          </div>
        </section>
        <ProductionProof />
        <section
          id="delivery"
          className="scroll-mt-28 bg-[#101416] py-14 sm:py-20"
        >
          <div className="container">
            <SectionHeading
              eyebrow="04 / Заказ и поставка"
              title="Комплект, который понятен до отгрузки"
            />
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                [
                  "01",
                  "Задание",
                  "Модель и паспорт блока, фото или чертёж фасада, количество, цвет и город объекта. Если чего-то нет — начните с описания.",
                ],
                [
                  "02",
                  "Согласование",
                  "Фиксируем габариты, материал, экран, крепление, покрытие и состав комплекта. Стоимость и срок зависят от этого состава и объёма партии.",
                ],
                [
                  "03",
                  "Поставка",
                  "Проверяем количество, маркировку и упаковку. Разделение по секциям или очередям объекта согласуем заранее. Монтаж на объекте не оказываем.",
                ],
              ].map(([n, title, text]) => (
                <article key={n} className="border-t border-white/25 pt-6">
                  <span className="font-mono text-3xl text-steel-orange">
                    {n}
                  </span>
                  <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                  <p className="mt-3 leading-7 text-white/75">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <FaqSection items={faq} title="Вопросы о корзинах для кондиционеров" />
        <EnquiryFinish
          title="Обсудим корзины для вашего объекта"
          text="Пришлите модель оборудования или задание с выбранными параметрами. Инженер уточнит исходные данные и согласует исполнение перед расчётом."
        />
      </PageLayout>
    </>
  );
}
