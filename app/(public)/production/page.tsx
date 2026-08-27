import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { FaqSection } from "@/components/FaqSection";
import { ProductionShowreel } from "@/components/ProductionVideo";
import { JsonLd } from "@/components/JsonLd";
import { productionServices } from "@/data/production-services";
import { semanticKeywords } from "@/data/semantic";
import {
  customerMaterialSummary,
  laserCuttingCapabilities,
  productionEquipment,
  productionLeadTimeSummary,
} from "@/data/manufacturing-facts";
import { createPageMetadata } from "@/lib/seo";
import { faqSchema, itemListSchema } from "@/lib/schema";

export const metadata: Metadata = createPageMetadata({
  title: "Производство полного цикла изделий из листового металла",
  description:
    `Инженерно-конструкторский центр и своё производство: ${productionEquipment.laserComplexes} лазерных и ${productionEquipment.pressBrakes} листогибочных комплекса, панельгиб, ${productionEquipment.weldingStations} сварочных поста, ${productionEquipment.powderCoatingBooths} камеры окраски. От КД до партии.`,
  path: "/production",
  image: "/images/real-production/workshop-team.jpg",
  keywords: semanticKeywords.production,
});

const stages = [
  ["Инженерно-конструкторский центр", "/images/real-production/engineering-department.jpg", "КД, технологическая подготовка, опытный образец и подготовка изделия к серийному выпуску.", "/production/proektirovanie-metalloizdeliy"],
  ["Лазерный раскрой", "/images/real-production/laser-cutting-action.jpg", "Раскрой деталей на собственных лазерных комплексах и подготовка партии к следующим операциям.", "/production/lazernaya-rezka-metalla"],
  ["Гибочное производство", "/images/real-production/press-brake-durma.jpg", "Листогибочные комплексы и панельгиб для формирования геометрии и повторяемости деталей.", "/production/gibka-listovogo-metalla"],
  ["Сварочно-сборочное направление", "/images/real-production/welding-station.jpg", "Слесарно-доводочные операции, сварка и сборка деталей и узлов в одном производственном контуре.", "/production/svarka-i-sborka-metalloizdeliy"],
  ["Подготовка поверхности и порошковая окраска", "/images/web/cycle-powder-coating.jpg", "Дробеструйная и лазерная очистка по согласованной технологии, затем порошковая окраска.", "/production/poroshkovaya-okraska-metalla"],
  ["Контроль, комплектация и упаковка", "/images/web/cycle-quality-control.jpg", "Финальный контроль, маркировка, комплектация, упаковка и подготовка партии к отгрузке.", "/production/kontrol-kachestva-i-upakovka"],
] as const;

const realProductionPhotos = [
  {
    image: "/images/real-production/laser-cutting-action.jpg",
    title: "Лазерная резка листового металла",
    description: "Рабочая зона лазерного комплекса в момент раскроя.",
  },
  {
    image: "/images/real-production/engineering-department.jpg",
    title: "Инженерно-конструкторский центр",
    description: "Разработка и проверка КД, технологическая подготовка и сопровождение изделия до запуска в производство.",
  },
  {
    image: "/images/real-production/press-brake-durma.jpg",
    title: "Листогибочный комплекс Durma",
    description: "Гибка деталей с программным управлением и контролем геометрии.",
  },
  {
    image: "/images/real-production/panel-bending-tool.jpg",
    title: "Инструмент гибочного комплекса",
    description: "Оснастка для точного и повторяемого формообразования деталей.",
  },
  {
    image: "/images/real-production/welding-station.jpg",
    title: "Сварочный пост",
    description: "Сварка и сборка металлоизделий на одном из четырёх сварочных постов.",
  },
  {
    image: "/images/real-production/workshop-team.jpg",
    title: "Производственная команда",
    description: "Специалисты «Сталь Продукт» в действующем цехе.",
  },
  {
    image: "/images/real-production/panel-bender-hogi.jpg",
    title: "Автоматизированная гибка HOGI",
    description: "Оборудование для обработки сложных деталей из листового металла.",
  },
  {
    image: "/images/real-production/laser-complex-golden.jpg",
    title: "Лазерный комплекс Golden Laser",
    description: "Высокоточный раскрой серийных и индивидуальных деталей.",
  },
] as const;

const capabilities = [
  ["Инженерно-конструкторский центр", "Разрабатываем и проверяем КД, прорабатываем технологию, опытный образец и готовность изделия к серийному выпуску."],
  [`${productionEquipment.laserComplexes} лазерных комплекса с ЧПУ`, `Раскрой чёрной стали ${laserCuttingCapabilities.thicknessRange}; рабочее поле стола ${laserCuttingCapabilities.tableWorkingArea}.`],
  [`${productionEquipment.pressBrakes} листогибочных комплекса + ${productionEquipment.panelBenders} панельгиб`, "Формируем стабильную геометрию деталей и повторяемость партии."],
  [`${productionEquipment.weldingStations} сварочных поста`, "Сварочно-сборочное направление для изготовления деталей и узлов с контролем геометрии."],
  ["Слесарно-доводочные операции", "Выполняем подгонку, зачистку, доводку и подготовку деталей к сварке, сборке и покрытию."],
  ["Сборочное производство", "Собираем детали и узлы в готовые сборочные единицы перед финальным контролем по технологическому маршруту."],
  [`${productionEquipment.powderCoatingBooths} камеры порошковой окраски`, "Наносим защитно-декоративное покрытие и ведём параллельную обработку изделий."],
  [`${productionEquipment.shotBlastingChambers} дробеструйная камера`, "Дробеструйная очистка: подготавливаем поверхность металла по согласованной технологии перед дальнейшими операциями и нанесением покрытия."],
  [`${productionEquipment.laserCleaningSystems} система лазерной очистки`, "Лазерная очистка: удаляем локальные загрязнения, окислы и покрытия в рамках согласованной технологической подготовки поверхности."],
  ["Контроль качества, комплектация и упаковка", "Проверяем изделия и комплектность, маркируем партии, упаковываем и готовим к отгрузке."],
] as const;

const productionFaq = [
  {
    question: "Какие изделия можно заказать на производстве?",
    answer:
      "Изготавливаем детали, корпуса, шкафы, кожухи, рамы, фасадные элементы и нестандартные сборочные единицы из листового металла. Состав операций определяется по чертежам, модели или техническому заданию.",
  },
  {
    question: "Можно работать по КД, DXF, DWG или STEP?",
    answer:
      "Да. Принимаем конструкторскую документацию, PDF, DXF, DWG, STEP, IGES и другие распространённые форматы. Перед запуском инженер проверяет технологичность и достаточность исходных данных.",
  },
  {
    question: "Возможен выпуск от прототипа до серии?",
    answer:
      "Да. Новый проект можно начать с опытного образца, затем зафиксировать изменения и перейти к мелкосерийному, среднесерийному или регулярному контрактному выпуску.",
  },
  {
    question: "Как заказать изготовление и узнать стоимость?",
    answer:
      "Передайте чертежи, материал, количество и требования к покрытию. После проверки документации сообщим состав производственного маршрута, срок подготовки расчёта и необходимые уточнения.",
  },
  {
    question: "Какой средний производственный срок?",
    answer: productionLeadTimeSummary,
  },
  {
    question: "Работаете с материалом заказчика?",
    answer: customerMaterialSummary,
  },
];

export default function ProductionPage() {
  return (
    <>
    <JsonLd
      data={[itemListSchema({
        name: "Производственные операции «Сталь Продукт»",
        description: "Основные этапы производства изделий из листового металла.",
        path: "/production",
        items: productionServices.map((service) => ({
          name: service.title,
          path: `/production/${service.slug}`,
        })),
      }), faqSchema(productionFaq)]}
    />
    <PageLayout
      path="/production"
      eyebrow="Производство полного цикла"
      title="От КД до готовой партии из листового металла"
      description="От инженерно-конструкторской подготовки до готовой партии: раскрой, гибка, сварка, сборка, подготовка поверхности, порошковая окраска, контроль, комплектация и упаковка."
      image="/images/real-production/workshop-team.jpg" imageAlt="Производственный участок «Сталь Продукт»: специалисты за работой с изделиями из листового металла"
    >
      <section className="border-y border-white/10 bg-[#0c1013] py-7">
        <div className="container grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [laserCuttingCapabilities.thicknessRange, "Лазерная резка чёрной стали"],
            [laserCuttingCapabilities.tableWorkingArea, "Формат обрабатываемого листа"],
            ["От 1 детали до серии", "Изготовление по КД и ТЗ заказчика"],
            ["Полный производственный цикл", "От инженерной подготовки до готовой партии"],
          ].map(([value, label]) => (
            <div key={label} className="border-l border-white/10 px-4">
              <b className="text-3xl text-steel-orange">{value}</b>
              <p className="mt-1 text-xs uppercase text-white/55">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="border-b border-white/10 bg-[#0c1013] py-12 sm:py-16">
        <div className="container grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Производство полного цикла", "От инженерно-конструкторской подготовки до готовой партии: раскрой, гибка, сварка, сборка, подготовка поверхности, порошковая окраска, контроль, комплектация и упаковка."],
            ["От задачи до серийного выпуска", "Работаем по КД, техническому заданию или образцу. Прорабатываем технологию, изготавливаем опытный образец и переводим согласованное изделие в повторяемую серию."],
            ["Собственная производственная база", `${productionEquipment.laserComplexes} лазерных комплекса, ${productionEquipment.pressBrakes} листогибочных комплекса, панельгиб, ${productionEquipment.weldingStations} сварочных поста, дробеструйная и лазерная очистка, ${productionEquipment.powderCoatingBooths} камеры порошковой окраски, сборка и упаковка.`],
            ["Инженерия + производство в одном контуре", "Инженерно-конструкторский центр работает вместе с производством: конструкция сразу прорабатывается с учётом технологии изготовления, сборки и дальнейшего серийного выпуска."],
          ].map(([title, text], index) => <article key={title} className="border border-white/12 bg-[#111519] p-5"><span className="font-mono text-sm font-bold text-steel-orange">{String(index + 1).padStart(2, "0")}</span><h2 className="mt-5 text-base font-semibold uppercase">{title}</h2><p className="mt-3 text-sm leading-6 text-white/58">{text}</p></article>)}
        </div>
      </section>
      <ProductionShowreel />
      <section className="bg-[#101112] py-14">
        <div className="container">
          <p className="eyebrow">Инженерия + производство в одном контуре</p>
          <h2 className="mt-3 text-3xl font-semibold">Производственный маршрут от задачи до готовой партии</h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {stages.map(([title, image, description, href], index) => (
              <Link
                key={title}
                href={href}
                className="group overflow-hidden border border-white/10 bg-[#111519] transition hover:border-steel-orange"
              >
                <div className="relative aspect-video overflow-hidden bg-[#192026]">
                  <Image
                    src={image}
                    fill
                    sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 16.7vw"
                    alt={`${title} на производстве «Сталь Продукт»`}
                    className="object-cover brightness-[1.07] contrast-[1.01] saturate-[1.02] transition duration-500 group-hover:scale-[1.035]"
                  />
                </div>
                <div className="p-4">
                  <b className="text-xl text-steel-orange">
                    {String(index + 1).padStart(2, "0")}
                  </b>
                  <h3 className="mt-2 text-sm font-bold">{title}</h3>
                  <p className="mt-3 text-[13px] leading-relaxed text-white/50">
                    {description}
                  </p>
                  <span className="mt-4 block text-xs font-bold uppercase text-steel-orange">
                    Подробнее&nbsp; →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="border-y border-white/10 bg-[#090c0e] py-16">
        <div className="container">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="eyebrow">Реальное производство</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-semibold sm:text-4xl">
                Реальное производство — без рендеров
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-white/55">
              Фотографии действующего производства «Сталь Продукт»: инженерно-конструкторский центр,
              лазерные комплексы, гибочное производство, сварочно-сборочное направление и работа специалистов в цехе.
            </p>
          </div>

          <div className="mt-9 grid gap-3 lg:grid-cols-2">
            {realProductionPhotos.slice(0, 2).map((photo) => (
              <article
                key={photo.image}
                className="group relative aspect-[16/9] overflow-hidden border border-white/10 bg-[#111519]"
              >
                <Image
                  src={photo.image}
                  fill
                  sizes="(max-width: 1023px) 100vw, 50vw"
                  alt={`${photo.title} — реальное производство «Сталь Продукт»`}
                  className="object-cover brightness-[1.04] contrast-[1.03] saturate-[.98] transition duration-700 group-hover:scale-[1.025] group-hover:brightness-[1.1]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <span className="text-xs font-bold uppercase tracking-[.18em] text-steel-orange">
                    Реальный кадр
                  </span>
                  <h3 className="mt-2 text-lg font-semibold">{photo.title}</h3>
                  <p className="mt-2 max-w-lg text-xs leading-relaxed text-white/65">
                    {photo.description}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {realProductionPhotos.slice(2).map((photo) => (
              <article
                key={photo.image}
                className="group overflow-hidden border border-white/10 bg-[#111519] transition hover:border-steel-orange/60"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image
                    src={photo.image}
                    fill
                    sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33.3vw"
                    alt={`${photo.title} — реальное производство «Сталь Продукт»`}
                    className="object-cover brightness-[1.04] contrast-[1.03] saturate-[.98] transition duration-700 group-hover:scale-[1.035] group-hover:brightness-[1.1]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
                  <span className="absolute left-4 top-4 border border-steel-orange/60 bg-black/70 px-2 py-1 text-xs font-bold uppercase tracking-[.15em] text-steel-orange backdrop-blur-sm">
                    Производство
                  </span>
                </div>
                <div className="border-t border-white/10 p-5">
                  <h3 className="text-sm font-bold">{photo.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/55">
                    {photo.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-[#0c1013] py-14">
        <div className="container">
          <p className="eyebrow">Собственная производственная база</p>
          <h2 className="mt-3 text-3xl font-semibold">Мощности полного производственного цикла</h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map(([title, description], index) => (
              <article
                key={title}
                className="border border-white/10 bg-[#111519] p-5"
              >
                <span className="text-2xl text-steel-orange">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 text-sm font-bold">{title}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-white/55">{description}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-col justify-between gap-5 border border-white/15 bg-[#14181b] p-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-semibold">Есть задача?</h3>
              <p className="mt-2 text-sm text-white/55">
                Проверим документацию и согласуем производственный маршрут для детали или партии.
              </p>
            </div>
            <Link
              href="/contacts#contact-form"
              className="bg-steel-orange-deep px-7 py-4 text-xs font-bold uppercase"
            >
              Получить расчёт&nbsp; →
            </Link>
          </div>
        </div>
      </section>
      <FaqSection items={productionFaq} title="Вопросы о производстве металлоизделий" />
    </PageLayout>
    </>
  );
}
