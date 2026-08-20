import Link from "next/link";
import type { Metadata } from "next";
import { CompanyVideo } from "@/components/CompanyVideo";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import { createPageMetadata } from "@/lib/seo";
import { faqSchema } from "@/lib/schema";
import {
  customerMaterialSummary,
  laserCuttingCapabilities,
  productionLeadTimeSummary,
} from "@/data/manufacturing-facts";

export const metadata: Metadata = createPageMetadata({
  title: "О компании — производство полного цикла",
  description: `Сталь Продукт: производство по КД, лазерная резка чёрной стали ${laserCuttingCapabilities.thicknessRange}, гибка, сварка, окраска и поставка по России.`,
  path: "/company",
  keywords: ["производство металлоизделий", "завод металлоизделий", "листовой металл", "Смоленск"],
});

const metrics = [
  ["2000+", "м² производственных площадей"],
  ["70+", "опытных специалистов"],
  ["3", "лазерных комплекса"],
  ["4", "листогибочных комплекса"],
];

const solutions = [
  ["Архитектурные решения", "Фасадные элементы, металлокассеты, декоративные панели, парапеты, отливы и доборные элементы для современных объектов."],
  ["Решения для климатического оборудования", "Корзины, экраны, кронштейны и монтажные конструкции для аккуратного и надёжного размещения оборудования."],
  ["Решения для промышленности", "Корпуса, шкафы, кожухи, рамы, металлоконструкции и комплектующие для оборудования и производственных линий."],
  ["Инженерные системы", "Кронштейны, монтажные и опорные конструкции, вентиляционные решётки, люки и решения для инженерной инфраструктуры."],
  ["Индивидуальные решения", "Разработка конструкции, КД, опытные образцы и серийное изготовление изделий по вашим чертежам и техническому заданию."],
];

const advantages = [
  ["Один ответственный партнёр", "Берём задачу от инженерной проработки до готовой поставки, поэтому не перекладываем ответственность между подрядчиками."],
  ["Производство полного цикла", "Лазерная резка, гибка, сварочные посты, слесарный участок, три камеры порошковой окраски, контроль качества и упаковка объединены в едином процессе."],
  ["Инженерная экспертиза", "Анализируем чертежи, предлагаем технологичные решения и помогаем подготовить изделие к стабильному производству."],
  ["Предсказуемый результат", "Планируем изготовление, контролируем качество на каждом этапе и готовим продукцию к безопасной отгрузке."],
];

const productionCapabilities = [
  ["3 лазерных комплекса с ЧПУ", `Чёрная сталь ${laserCuttingCapabilities.thicknessRange}; рабочее поле стола ${laserCuttingCapabilities.tableWorkingArea}.`],
  ["4 листогибочных комплекса", "Гибка по чертежам с проверкой развёртки, инструмента, углов, полок и общей геометрии."],
  ["Панельгиб", "Формообразование фасадных и корпусных деталей с контролем повторяемых размеров партии."],
  ["Сварочные посты", "Сварка и сборка металлоизделий с контролем геометрии и подготовкой к следующему этапу производства."],
  ["Слесарный участок", "Доводка, подгонка, подготовка к сварке и сборочные операции по согласованной технологии."],
  ["3 камеры порошковой окраски", "Подготовка и нанесение полимерного покрытия по согласованным цвету, фактуре и требованиям к поверхности."],
  ["Камера дробеструйной очистки", "Подготавливаем поверхность металла перед нанесением покрытия: удаляем загрязнения и создаём равномерную шероховатость для надёжной адгезии."],
];

const companyFaq = [
  { question: "Где находится производство?", answer: "Производственная площадка «Сталь Продукт» находится в Смоленске. Заказы комплектуем для поставки в Москву, Московскую область, ЦФО и другие регионы России." },
  { question: "Какие операции выполняются на собственной площадке?", answer: "Производственный маршрут включает инженерную подготовку, лазерную резку, гибку на ЧПУ, сварочные и слесарные операции, порошковую окраску, контроль качества и упаковку." },
  { question: "Работаете как контрактный производитель?", answer: "Да. Можем выпускать изделия по документации заказчика, сопровождать опытный образец и организовать повторяемое серийное производство, включая OEM-проекты." },
  { question: "Какой ориентировочный срок изготовления?", answer: productionLeadTimeSummary },
  { question: "Можно передать собственный металл?", answer: customerMaterialSummary },
];

export default function CompanyPage() {
  return <><JsonLd data={faqSchema(companyFaq)} /><PageLayout
    path="/company"
    eyebrow="Компания"
    title="Сталь Продукт — инженерные решения из листового металла"
    description="Инженерно-производственная компания полного цикла. Проектируем, производим и поставляем металлоизделия для строительства, промышленности и инженерной инфраструктуры."
  >
    <CompanyVideo />

    <section className="bg-[#151719] py-16 sm:py-20">
      <div className="container relative overflow-hidden border border-white/12 bg-[#101214] p-6 sm:p-9 lg:p-12">
        <span className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 border border-steel-orange/20" />
        <span className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 border border-white/10" />
        <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)] lg:items-start">
          <div className="border-l-2 border-steel-orange pl-5 sm:pl-7">
            <p className="eyebrow">О компании</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-[1.08] sm:text-4xl lg:text-5xl">Связываем конструкторскую документацию с реальным производственным маршрутом</h2>
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-white/62 sm:text-base">До запуска проверяем материал, раскрой, гибы, соединения, покрытие и контрольные размеры. Это позволяет согласовать не отдельную операцию, а изготовление готовой детали или сборочной единицы.</p>
          </div>

          <div className="relative border border-white/12 bg-[#15191c] p-6 sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">Единая ответственность</p>
            <p className="mt-5 text-lg font-semibold leading-snug">От исходных данных до промаркированной и упакованной партии.</p>
            <p className="mt-4 text-sm leading-relaxed text-white/60">«Сталь Продукт» объединяет инженерную подготовку, изготовление, контроль, комплектацию и отгрузку. В работу принимаем готовую КД, 3D-модель, эскиз или техническое задание.</p>
            <span className="absolute bottom-0 right-0 h-10 w-10 border-l border-t border-steel-orange/55" />
          </div>
        </div>

        <div className="relative mt-10 grid border-t border-white/12 pt-5 sm:grid-cols-3 sm:pt-0">
          {[
            ["01", "Разрабатываем", "От КД и опытного образца до готовности к серийному изготовлению."],
            ["02", "Производим", "Работаем по чертежам заказчика или разрабатываем решение с нуля."],
            ["03", "Поставляем", "Не передаём критичные операции подрядчикам и контролируем результат до отгрузки."],
          ].map(([number, title, description]) => <article key={number} className="border-white/12 px-0 py-5 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0">
            <span className="text-2xl font-bold text-steel-orange">{number}</span>
            <h3 className="mt-4 text-sm font-semibold uppercase tracking-[.08em]">{title}</h3>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">{description}</p>
          </article>)}
        </div>
      </div>
    </section>

    <section className="border-y border-white/10 bg-[#0c1013] py-8">
      <div className="container grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([number, label]) => <article key={label} className="border-l border-white/10 px-5 py-2">
          <strong className="text-3xl text-steel-orange sm:text-4xl">{number}</strong>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[.1em] text-white/58">{label}</p>
        </article>)}
      </div>
    </section>

    <section className="bg-[#151719] py-16 sm:py-20">
      <div className="container">
        <p className="eyebrow">Оборудование и участки</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">Возможности, которые позволяют держать качество и срок под контролем</h2>
        <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {productionCapabilities.map(([title, description], index) => <article key={title} className="border border-white/12 bg-[#101214] p-6">
            <span className="text-2xl font-bold text-steel-orange">0{index + 1}</span>
            <h3 className="mt-6 text-lg font-semibold">{title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/60">{description}</p>
          </article>)}
        </div>
      </div>
    </section>

    <section className="bg-[#101112] py-16 sm:py-20">
      <div className="container">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Направления</p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Решения для задач, а не набор отдельных услуг</h2>
          </div>
          <Link href="/solutions" className="text-xs font-bold uppercase text-steel-orange transition hover:text-orange-400">Все решения&nbsp; →</Link>
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {solutions.map(([title, description], index) => <article key={title} className="border border-white/10 bg-[#15191c] p-6 transition hover:border-steel-orange/60">
            <span className="text-sm font-bold text-steel-orange">0{index + 1}</span>
            <h3 className="mt-7 text-lg font-semibold leading-tight">{title}</h3>
            <p className="mt-4 text-sm leading-relaxed text-white/60">{description}</p>
          </article>)}
        </div>
      </div>
    </section>

    <section id="advantages" className="scroll-mt-24 bg-[#0c1013] py-16 sm:py-20">
      <div className="container">
        <p className="eyebrow">Почему Сталь Продукт</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">Производственная мощность важна. Но для заказчика важнее уверенность в результате.</h2>
        <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {advantages.map(([title, description], index) => <article key={title} className="border border-white/10 bg-[#111519] p-6">
            <span className="text-2xl font-bold text-steel-orange">0{index + 1}</span>
            <h3 className="mt-6 text-base font-semibold">{title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/57">{description}</p>
          </article>)}
        </div>
      </div>
    </section>

    <section className="bg-[#151719] py-12">
      <div className="container flex flex-col justify-between gap-7 border border-white/15 bg-[linear-gradient(110deg,rgba(234,91,12,.12),transparent_38%)] p-7 sm:flex-row sm:items-center sm:p-9">
        <div className="max-w-2xl">
          <p className="eyebrow">Обсудим задачу</p>
          <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Есть чертёж, идея или нестандартная задача?</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/62">Отправьте исходные данные. Инженер проверит технологичность и определит состав операций, необходимые уточнения и данные для расчёта.</p>
        </div>
        <Link href="/contacts#contact-form" className="clip-corner shrink-0 bg-steel-orange px-7 py-4 text-center text-xs font-bold uppercase transition hover:bg-orange-600">Получить расчёт&nbsp; →</Link>
      </div>
    </section>
    <FaqSection items={companyFaq} title="Вопросы о компании и производстве" />
  </PageLayout></>;
}
