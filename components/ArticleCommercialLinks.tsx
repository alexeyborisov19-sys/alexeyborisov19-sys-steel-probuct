import Link from "next/link";
import type { ArticleDirection } from "@/data/articles";

type CommercialLink = {
  title: string;
  description: string;
  href: string;
};

const linksByDirection: Record<ArticleDirection, CommercialLink[]> = {
  news: [
    {
      title: "Лазерная резка металла",
      description: "Подготовка файлов, раскладка, контроль геометрии и передача деталей на следующие операции.",
      href: "/production/lazernaya-rezka-metalla",
    },
    {
      title: "Решения для промышленности",
      description: "Корпуса, шкафы, кожухи, рамы и изделия для промышленного оборудования.",
      href: "/solutions/industry",
    },
    {
      title: "Изготовление по чертежам",
      description: "Передайте модель, чертёж или техническое задание для инженерной оценки.",
      href: "/solutions/custom",
    },
  ],
  facades: [
    {
      title: "Металлокассеты",
      description: "Виды, исполнения и технические особенности фасадных металлокассет.",
      href: "/products/metallokassety",
    },
    {
      title: "Калькулятор металлокассет",
      description: "Предварительная оценка стоимости по площади и толщине металла.",
      href: "/calculator-metallokassety",
    },
    {
      title: "Решения для объектов",
      description: "Состав изделий для жилых, коммерческих и промышленных объектов.",
      href: "/industries",
    },
  ],
  metalworking: [
    {
      title: "Гибка листового металла",
      description: "Подбор инструмента, проверка развёртки и контроль повторяемости партии.",
      href: "/production/gibka-listovogo-metalla",
    },
    {
      title: "Промышленные изделия",
      description: "Корпуса, шкафы, кожухи, рамы и другие решения из листового металла.",
      href: "/solutions/industry",
    },
    {
      title: "Индивидуальные решения",
      description: "Опытные образцы, серийное производство и импортозамещение по документации.",
      href: "/solutions/custom",
    },
  ],
  "engineering-practice": [
    {
      title: "Проектирование металлоизделий",
      description: "Проверка технологичности, подготовка КД и сопровождение опытного образца.",
      href: "/production/proektirovanie-metalloizdeliy",
    },
    {
      title: "Возможности производства",
      description: "Реальные участки, оборудование и последовательность технологических операций.",
      href: "/production",
    },
    {
      title: "Передать документацию",
      description: "Прикрепите PDF, DXF, DWG, STEP, изображения или архив для предварительной оценки.",
      href: "/contacts#contact-form",
    },
  ],
};

export function ArticleCommercialLinks({ direction }: { direction: ArticleDirection }) {
  return (
    <section className="mt-12 border-y border-white/12 py-8" aria-labelledby="article-related-solutions">
      <p className="eyebrow">По теме материала</p>
      <h2 id="article-related-solutions" className="mt-3 text-2xl font-semibold uppercase">
        Решения и возможности «Сталь Продукт»
      </h2>
      <div className="mt-6 grid gap-px border border-white/12 bg-white/10 md:grid-cols-3">
        {linksByDirection[direction].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group bg-[#101519] p-5 transition hover:bg-[#151b1f]"
          >
            <h3 className="text-sm font-semibold uppercase leading-5 transition group-hover:text-steel-orange">
              {item.title}
            </h3>
            <p className="mt-3 text-xs leading-6 text-white/52">{item.description}</p>
            <span className="mt-5 inline-block text-[10px] font-bold uppercase text-steel-orange">
              Перейти&nbsp; →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
