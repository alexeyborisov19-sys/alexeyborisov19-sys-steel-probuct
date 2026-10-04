import { CustomerResources } from "@/components/commercial/CustomerResources";
import Image from "next/image";
import Link from "next/link";
import { AttributionLink } from "@/components/AttributionLink";
import { PageLayout } from "@/components/PageLayout";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { faqSchema, serviceSchema } from "@/lib/schema";
import {
  laserCuttingCapabilities,
  productionEquipment,
} from "@/data/manufacturing-facts";
import {
  EnquiryFinish,
  LandingNav,
  ProductionProof,
  SectionHeading,
} from "./LandingSections";
const faq = [
  {
    question: "Можно заказать изделие без готового чертежа?",
    answer:
      "Да. Начните с эскиза, фотографии, образца или описания функции. Инженер определит, каких данных не хватает, и согласует состав разработки. По одной фотографии нельзя гарантировать точное восстановление всех размеров и материалов.",
  },
  {
    question: "Какие файлы нужны для расчёта?",
    answer:
      "Для автоматического расчёта используйте DXF или STEP. Для проверки инженером передайте PDF, DXF, DWG, STEP, спецификацию или эскиз. Для гнутой детали полезны модель и чертёж с материалом, толщиной, размерами и требованиями к качеству.",
  },
  {
    question: "Онлайн-цена окончательная?",
    answer:
      "Нет. Калькулятор даёт предварительную оценку по распознанной геометрии и выбранным операциям. Сложные узлы, неполные данные и дополнительные требования проверяет инженер. Итоговую стоимость, комплектность и срок фиксируем в коммерческом предложении.",
  },
  {
    question: "Изготавливаете образцы и серийные партии?",
    answer:
      "Да. Можно начать с опытного образца, согласовать его исполнение и затем перейти к партии. Количество, требования к приёмке и график отгрузок обсуждаем для конкретного заказа.",
  },
  {
    question: "Можно работать с металлом заказчика?",
    answer:
      "Да. Марку, толщину, состояние и объём материала, а также требования к его передаче согласуем перед запуском заказа.",
  },
  {
    question: "Какие допуски вы обеспечиваете?",
    answer:
      "Допуски и контрольные размеры определяются рабочим чертежом и согласованной технологией. Универсальную точность для всех материалов, операций и размеров не обещаем; критические требования проверяем до расчёта.",
  },
];
const route = [
  {
    title: "Инженерная подготовка",
    text: "Проверяем комплектность КД, материал, размеры и технологичность. Уточняем критические требования.",
    image: "/images/real-production/engineering-department.jpg",
    href: "/production",
  },
  {
    title: "Раскрой и формообразование",
    text: "Связываем лазерную резку, гибку и слесарно-доводочные операции в маршрут вашей детали.",
    image: "/images/real-production/press-brake-durma.jpg",
    href: "/production/gibka-listovogo-metalla",
  },
  {
    title: "Сварка и сборка",
    text: "Согласуем соединения, взаимное положение деталей и состав сборочной единицы.",
    image: "/images/real-production/welding-station.jpg",
    href: "/production",
  },
];
export function CustomFabricationPage() {
  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: "Изготовление изделий из листового металла по чертежам",
            description:
              "Инженерная подготовка, изготовление деталей и сборок, окраска, контроль и комплектация партии по документации заказчика.",
            path: "/solutions/custom",
            serviceType: "Изготовление металлоизделий по чертежам",
          }),
          faqSchema(faq),
        ]}
      />
      <PageLayout
        path="/solutions/custom"
        eyebrow="От КД до готовой партии"
        title="Изготовление деталей из листового металла по чертежам"
        description="Изготавливаем детали и изделия из листового металла: от опытного образца до серии. Инженерная подготовка, резка, гибка, сварка, окраска и комплектация — в одном производственном маршруте."
        image="/images/real-production/engineering-department.jpg"
        imageAlt="Инженерно-конструкторская подготовка на производстве «Сталь Продукт»"
        breadcrumbs={[
          { name: "Главная", path: "/" },
          { name: "Решения", path: "/solutions" },
          { name: "Изделия по чертежам", path: "/solutions/custom" },
        ]}
      >
        <LandingNav
          items={[
            { id: "start", label: "Рассчитать заказ" },
            { id: "products", label: "Что изготавливаем" },
            { id: "route", label: "Производственный маршрут" },
            { id: "files", label: "Подготовить файлы" },
            { id: "quality", label: "Приёмка и поставка" },
          ]}
        />
        <section
          id="start"
          className="scroll-mt-28 bg-[#101416] py-14 sm:py-20"
        >
          <div className="container">
            <SectionHeading
              eyebrow="01 / Два способа начать"
              title="Получите оценку или разберите задачу с инженером"
              text="Выберите путь под ваши исходные данные. Для понятной детали можно начать с калькулятора, для сборки или нестандартного изделия — сразу с инженерной заявки."
            />
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <article className="border border-steel-orange/60 bg-[#1b2023] p-6 sm:p-9">
                <span className="font-mono text-sm text-steel-orange">
                  DXF / STEP / РАЗМЕРЫ
                </span>
                <h3 className="mt-5 text-2xl font-semibold">
                  Бесплатный онлайн-расчёт
                </h3>
                <p className="mt-4 leading-7 text-white/80">
                  Загрузите CAD-файл или задайте внешние размеры и отверстия
                  вручную. Выберите материал, количество и нужные операции.
                </p>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  Предварительная стоимость — ориентир для обсуждения, а не
                  готовое коммерческое предложение.
                </p>
                <AttributionLink
                  href="/online-order"
                  className="clip-corner mt-7 inline-flex min-h-12 items-center bg-steel-orange-deep px-6 py-4 text-sm font-bold"
                >
                  Открыть калькулятор →
                </AttributionLink>
              </article>
              <article className="border border-white/20 p-6 sm:p-9">
                <span className="font-mono text-sm text-white/75">
                  ЧЕРТЁЖ / СБОРКА / ЭСКИЗ
                </span>
                <h3 className="mt-5 text-2xl font-semibold">
                  Расчёт с инженером
                </h3>
                <p className="mt-4 leading-7 text-white/80">
                  Передайте документацию, спецификацию или описание задачи.
                  Разберём состав изделия, дополнительные операции и требования
                  к поставке.
                </p>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  Нет готовой КД? Уточним исходные данные и согласуем инженерную
                  подготовку.
                </p>
                <AttributionLink
                  href="/contacts#contact-form"
                  className="mt-7 inline-flex min-h-12 items-center border border-white/35 px-6 py-4 text-sm font-bold hover:border-steel-orange"
                >
                  Отправить чертежи →
                </AttributionLink>
              </article>
            </div>
          </div>
        </section>
        <ProductionProof />
        <section
          id="products"
          className="scroll-mt-28 bg-[#101416] py-14 sm:py-20"
        >
          <div className="container">
            <SectionHeading
              eyebrow="02 / Детали, узлы, комплекты"
              title="Из листового металла — в готовое изделие"
              text="Работаем с документацией заказчика и задачами, которым ещё нужна инженерная проработка. Материал, допуски и комплектность подтверждаем для конкретного заказа."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                [
                  "Детали и заготовки",
                  "Пластины, панели, кронштейны и гнутые элементы с отверстиями и вырезами.",
                  "/production/lazernaya-rezka-metalla",
                ],
                [
                  "Корпуса и кожухи",
                  "Корпусные детали, защитные панели и сборочные единицы под оборудование.",
                  "/products/metallicheskie-korpusa",
                ],
                [
                  "Сварные и сборные узлы",
                  "Несколько деталей в одном комплекте с согласованными соединениями и контролем.",
                  "/production",
                ],
                [
                  "Фасадные изделия",
                  "Кассеты, доборные элементы, экраны и корзины с покрытием под архитектуру.",
                  "/products/metallokassety",
                ],
                [
                  "Крепёжные элементы",
                  "Закладные, опорные и соединительные детали по проектным узлам.",
                  "/products/zakladnye-detali",
                ],
                [
                  "Опытный образец и серия",
                  "Проверка исполнения на образце, фиксация согласованной версии и повторяемый выпуск.",
                  "/contacts#contact-form",
                ],
              ].map(([title, text, href], i) => (
                <article
                  key={title}
                  className="flex flex-col border border-white/20 p-6"
                >
                  <span className="font-mono text-sm text-steel-orange">
                    0{i + 1}
                  </span>
                  <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                  <p className="mb-5 mt-3 flex-1 text-sm leading-7 text-white/75">
                    {text}
                  </p>
                  <AttributionLink
                    href={href}
                    className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
                  >
                    {href.startsWith("/contacts")
                      ? "Обсудить задачу"
                      : "Подробнее"}{" "}
                    →
                  </AttributionLink>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section
          id="route"
          className="scroll-mt-28 border-y border-white/15 bg-[#1a1e21] py-14 sm:py-20"
        >
          <div className="container">
            <SectionHeading
              eyebrow="03 / Собственные участки"
              title="Одна производственная цепочка"
              text="Передаём согласованные требования между участками — от конструкторской подготовки до контроля и упаковки. Состав операций зависит от изделия."
            />
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {route.map((item, i) => (
                <article
                  key={item.title}
                  className="overflow-hidden border border-white/20 bg-[#101416]"
                >
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={item.image}
                      alt={item.title + " на производстве «Сталь Продукт»"}
                      fill
                      sizes="(max-width:1023px) 100vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <span className="font-mono text-sm text-steel-orange">
                      0{i + 1}
                    </span>
                    <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-white/75">
                      {item.text}
                    </p>
                    <Link
                      href={item.href}
                      className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
                    >
                      Возможности участка →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-6 grid gap-6 border-l-2 border-steel-orange bg-black/20 p-6 md:grid-cols-2">
              <div>
                <h3 className="font-semibold">
                  Окраска и доводка — в составе заказа
                </h3>
                <p className="mt-3 text-sm leading-7 text-white/80">
                  Согласуем подготовку поверхности, порошковое покрытие, цвет и
                  требования к внешнему виду. Резьбы, зенковки и другие
                  дополнительные операции укажите в документации.
                </p>
              </div>
              <div>
                <h3 className="font-semibold">Подтверждённые возможности</h3>
                <p className="mt-3 text-sm leading-7 text-white/80">
                  Лазерная резка: {laserCuttingCapabilities.material},{" "}
                  {laserCuttingCapabilities.thicknessRange}; рабочее поле{" "}
                  {laserCuttingCapabilities.tableWorkingArea}. Дополнительно к
                  листогибочным комплексам — {productionEquipment.panelBenders}{" "}
                  панельгиб. Технологичность конкретной детали проверяем
                  отдельно.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section
          id="files"
          className="scroll-mt-28 bg-[#101416] py-14 sm:py-20"
        >
          <div className="container grid gap-10 lg:grid-cols-[1.15fr_.85fr]">
            <div>
              <SectionHeading
                eyebrow="04 / Исходные данные"
                title="Меньше уточнений — точнее предложение"
              />
              <div className="mt-7 divide-y divide-white/20">
                {[
                  [
                    "DXF · плоский контур",
                    "Геометрия для раскроя, единицы измерения, материал, толщина и количество. Укажите, какие линии относятся к резке.",
                  ],
                  [
                    "STEP · объёмная деталь",
                    "Модель и чертёж с критическими размерами. Для листовой детали важно определить гибы и проверенную развёртку.",
                  ],
                  [
                    "PDF / DWG · документация",
                    "Чертежи с материалом, толщиной, допусками и требованиями к операциям. DWG передаётся на инженерную проверку.",
                  ],
                  [
                    "Эскиз / фото / образец",
                    "Опишите назначение, габариты и сопряжения. Перед изготовлением потребуется согласование недостающих данных.",
                  ],
                ].map(([title, text]) => (
                  <div key={title} className="py-5">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-7 text-white/75">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <aside className="self-start border border-white/20 bg-[#1b2023] p-6 sm:p-8">
              <p className="eyebrow">Короткое задание</p>
              <h3 className="mt-4 text-2xl font-semibold">
                Что указать вместе с файлом
              </h3>
              <ol className="mt-6 space-y-4">
                {[
                  "Материал и толщина металла",
                  "Количество по каждой позиции",
                  "Гибка, сварка, резьбы, зенковки, покрытие",
                  "Критические размеры и требования к приёмке",
                  "Нужная дата и город отгрузки",
                ].map((text, i) => (
                  <li key={text} className="flex gap-3 text-sm leading-6">
                    <span className="font-mono text-steel-orange">
                      0{i + 1}
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 border-t border-white/20 pt-5 text-sm leading-6 text-white/75">
                Неизвестные параметры оставьте для уточнения. На форме можно
                приложить до 10 файлов: до 7 МБ каждый и до 10 МБ суммарно.
              </p>
              <a
                href="/documents/zadanie-na-izgotovlenie.txt"
                download
                className="mt-5 inline-flex min-h-12 items-center text-sm font-bold text-steel-orange underline underline-offset-4"
              >
                Скачать шаблон задания ↓
              </a>
            </aside>
          </div>
        </section>
        <section
          id="quality"
          className="scroll-mt-28 border-y border-white/15 bg-[#1a1e21] py-14 sm:py-20"
        >
          <div className="container">
            <SectionHeading
              eyebrow="05 / Зафиксировать до запуска"
              title="Согласованный результат, а не просто набор операций"
            />
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                [
                  "Стоимость и срок",
                  "На предложение влияют материал, расход металла, объём партии, операции, покрытие и контроль. Точный срок подтверждаем после проверки документации.",
                ],
                [
                  "Контроль и версия КД",
                  "Определяем контрольные размеры, требования к поверхности и состав приёмки. Перед повторной партией сверяем актуальную версию чертежей и изменения.",
                ],
                [
                  "Комплектность и отгрузка",
                  "Фиксируем состав сборок, маркировку, упаковку и сопроводительные документы. Поставляем изделия; монтаж на объекте не оказываем.",
                ],
              ].map(([title, text]) => (
                <article key={title} className="border-t border-white/25 pt-5">
                  <h3 className="text-xl font-semibold">{title}</h3>
                  <p className="mt-4 leading-7 text-white/75">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <FaqSection items={faq} title="Вопросы об изготовлении по чертежам" />
        <EnquiryFinish
          title="Давайте превратим ваш чертёж в изделие"
          text="Передайте файл, спецификацию или описание. Проверим исходные данные и подготовим предложение по согласованному составу работ."
        />
      <CustomerResources />
      </PageLayout>
    </>
  );
}
