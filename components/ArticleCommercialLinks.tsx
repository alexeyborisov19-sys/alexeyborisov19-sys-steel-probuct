import Link from "next/link";
import type { Article, ArticleDirection } from "@/data/articles";

type CommercialLink = {
  title: string;
  description: string;
  href: string;
};

const linksByDirection: Record<ArticleDirection, CommercialLink[]> = {
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

const linksByTopic: Record<string, CommercialLink[]> = {
  "trumpf-mate-instrument-dlya-listovogo-metalla-2026": [
    { title: "Гибка на ЧПУ", description: "Подбор листогибочного инструмента, проверка развёртки и контроль первой детали.", href: "/production/gibka-listovogo-metalla" },
    { title: "Подготовка КД", description: "Проверка радиусов, сопряжений и технологичности изделия до запуска.", href: "/production/proektirovanie-metalloizdeliy" },
  ],
  "avtomatizaciya-gibki-claas-2026": [
    { title: "Гибка листового металла", description: "Изготовление гнутых деталей на комплексах с ЧПУ с контролем повторяемости.", href: "/production/gibka-listovogo-metalla" },
    { title: "Серийное производство", description: "Подготовка опытного образца и повторяемого выпуска деталей по документации.", href: "/solutions/custom" },
  ],
  "ii-sortirovka-posle-lazernoj-rezki-2026": [
    { title: "Лазерная резка металла", description: "Раскрой листа по DXF, маркировка и передача деталей на следующие операции.", href: "/production/lazernaya-rezka-metalla" },
    { title: "Контроль и комплектация", description: "Группировка, маркировка и упаковка деталей по сборочным единицам.", href: "/production/kontrol-kachestva-i-upakovka" },
  ],
  "robotizirovannaya-gibka-i-avtomatizirovannye-linii-kitaya": [
    { title: "Гибка металла на ЧПУ", description: "Технологическая последовательность, контроль первой детали и повторяемость партии.", href: "/production/gibka-listovogo-metalla" },
    { title: "Полный цикл производства", description: "Связанный маршрут от инженерной подготовки до комплектации и отгрузки.", href: "/production" },
  ],
  "kak-vybrat-metallokassety-dlya-fasada": [
    { title: "Серии фасадных металлокассет", description: "Открытое и скрытое крепление, рельеф и перфорация с техническими данными.", href: "/products/metallokassety" },
    { title: "Откосы и отливы", description: "Доборные элементы по размерам проёмов и узлам фасада.", href: "/products/dobornye-elementy" },
  ],
  "otkrytoe-i-skrytoe-kreplenie-metallokasset": [
    { title: "Металлокассеты Стандарт", description: "Кассеты с открытым креплением и доступными точками фиксации.", href: "/products/metallokassety-standart" },
    { title: "Металлокассеты Премиум", description: "Исполнение со скрытым креплением для спокойной фасадной плоскости.", href: "/products/metallokassety-premium" },
  ],
  "poroshkovaya-okraska-metalloizdeliy": [
    { title: "Порошковая окраска металла", description: "Подготовка поверхности, полимерное покрытие по RAL и контроль внешнего вида.", href: "/production/poroshkovaya-okraska-metalla" },
  ],
  "izdeliya-iz-listovogo-metalla-po-chertezham": [
    { title: "Контрактное производство", description: "Изготовление по КД, DXF, DWG и STEP: от опытного образца до серии.", href: "/solutions/custom" },
    { title: "Инженерная подготовка", description: "Проверка технологичности, 3D-модели и рабочая документация.", href: "/production/proektirovanie-metalloizdeliy" },
  ],
  "oshibki-v-chertezhah-dlya-proizvodstva-metalloizdeliy": [
    { title: "Изготовление по чертежам", description: "Проверка КД, подготовка маршрута, опытный образец и серийный выпуск деталей.", href: "/solutions/custom" },
    { title: "Инженерная подготовка", description: "Развёртки, сопряжения, допуски и технологичность до передачи в цех.", href: "/production/proektirovanie-metalloizdeliy" },
  ],
  "kak-proverit-tehnologichnost-korpusa-iz-listovogo-metalla": [
    { title: "Металлические корпуса на заказ", description: "Корпуса, шкафы и кожухи: от DFM-проверки и образца до серийной поставки.", href: "/solutions/industry" },
    { title: "Сварка и сборка корпусов", description: "Подготовка соединений, сборочная последовательность и контроль геометрии.", href: "/production/svarka-i-sborka-metalloizdeliy" },
  ],
  "kak-vybrat-tolshchinu-listovogo-metalla": [
    { title: "Проектирование металлоизделий", description: "Подбор материала и толщины с учётом функции, технологии и серии.", href: "/production/proektirovanie-metalloizdeliy" },
    { title: "Лазерный раскрой", description: "Резка листовой стали, нержавейки, алюминия и оцинкованного металла по файлам.", href: "/production/lazernaya-rezka-metalla" },
  ],
  "oshibki-proektirovaniya-korzin-kondicionerov": [
    { title: "Корзины и экраны кондиционеров", description: "Подбор габаритов, вентиляции, крепления и покрытия под фасад.", href: "/solutions/climate" },
  ],
  "kak-snizit-stoimost-metalloizdeliya": [
    { title: "Проектирование под производство", description: "Оптимизация раскроя, гибов, соединений и сборки до запуска партии.", href: "/production/proektirovanie-metalloizdeliy" },
    { title: "Серийное изготовление", description: "Повторяемый выпуск, контроль, маркировка и согласованный график поставок.", href: "/solutions/custom" },
  ],
  "lokalizaciya-importnogo-korpusa-v-rossii": [
    { title: "Корпуса и шкафы по чертежам", description: "Опытный образец и серийный выпуск корпусов для оборудования и автоматизации.", href: "/solutions/industry" },
    { title: "Российское контрактное производство", description: "Адаптация документации и технологии для локального выпуска изделия.", href: "/solutions/custom" },
  ],
};

export function getArticleCommercialLinks(article: Article) {
  const links = [...(linksByTopic[article.slug] ?? []), ...linksByDirection[article.direction]];
  return [...new Map(links.map((item) => [item.href, item])).values()].slice(0, 3);
}

type ArticleCommercialLinksProps =
  | { article: Article; direction?: never }
  | { article?: never; direction: ArticleDirection };

export function ArticleCommercialLinks(props: ArticleCommercialLinksProps) {
  const links = props.article ? getArticleCommercialLinks(props.article) : linksByDirection[props.direction];
  return (
    <section className="mt-12 border-y border-white/12 py-8" aria-labelledby="article-related-solutions">
      <p className="eyebrow">По теме материала</p>
      <h2 id="article-related-solutions" className="mt-3 text-2xl font-semibold uppercase">
        Решения и возможности «Сталь Продукт»
      </h2>
      <div className="mt-6 grid gap-px border border-white/12 bg-white/10 md:grid-cols-3">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group bg-[#101519] p-5 transition hover:bg-[#151b1f]"
          >
            <h3 className="text-sm font-semibold uppercase leading-5 transition group-hover:text-steel-orange">
              {item.title}
            </h3>
            <p className="mt-3 text-xs leading-6 text-white/52">{item.description}</p>
            <span className="mt-5 inline-block text-xs font-bold uppercase text-steel-orange">
              Перейти&nbsp; →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
