export type Solution = {
  title: string;
  shortTitle: string;
  text: string;
  items: string[];
  image: string;
  /** Lightweight, mobile-first image used in the cards on the home page. */
  cardImage: string;
  cardImagePosition?: string;
  imageClassName?: string;
  icon: string;
  href: string;
};

export const solutions: Solution[] = [
  {
    title: "Архитектурные решения", shortTitle: "Архитектурные решения", icon: "▱",
    text: "Металлокассеты, панели и фасонные элементы по раскладке, узлам крепления и цвету проекта.",
    items: ["Металлокассеты", "Доборные элементы", "Откосы для окон", "Отливы для окон", "Парапетные крышки", "Аквилоны", "Пожарные отсечки", "Декоративные панели"],
    image: "/images/web/hero-main.webp",
    cardImage: "/images/industry/cards/architecture.webp",
    href: "/products",
  },
  {
    title: "Решения для кондиционирования", shortTitle: "Решения для кондиционирования", icon: "❄",
    text: "Корзины, экраны и кронштейны с учётом габаритов блока, воздухообмена, обслуживания и крепления к основанию.",
    items: ["Корзины для кондиционеров", "Кронштейны для кондиционеров", "Экраны для кондиционеров", "Корзины по размерам", "Защитные экраны", "Антивандальные корзины", "Декоративные панели", "Комплектующие и крепеж"],
    image: "/images/web/solution-climate.jpg",
    cardImage: "/images/industry/cards/climate.webp",
    cardImagePosition: "center 48%",
    href: "/solutions/climate",
  },
  {
    title: "Решения для промышленности", shortTitle: "Решения для промышленности", icon: "▣",
    text: "Корпуса, шкафы, кожухи и рамы по КД: от проверки технологичности до сборки и повторяемого выпуска партии.",
    items: ["Корпуса и шкафы", "Кожухи и защитные ограждения", "Каркасы и рамы", "Кабельные лотки и короба", "Панели и облицовки", "Площадки и ограждения", "Металлические поддоны", "Кронштейны и крепеж"],
    image: "/images/web/solution-industry.jpg",
    cardImage: "/images/industry/cards/industry.webp",
    imageClassName: "brightness-[1.16] contrast-[1.02] saturate-[1.04]",
    href: "/solutions/industry",
  },
  {
    title: "Инженерные системы", shortTitle: "Инженерные системы", icon: "⚙",
    text: "Решётки, люки, кронштейны и опоры по проектным нагрузкам, габаритам оборудования и монтажным узлам.",
    items: ["Вентиляционные решетки", "Люки", "Кронштейны", "Монтажные конструкции", "Опорные конструкции", "Кровельные монтажные системы", "Дефлекторы и зонты"],
    image: "/images/web/solution-engineering.jpg",
    cardImage: "/images/industry/cards/engineering.webp",
    href: "/solutions/engineering",
  },
  {
    title: "Индивидуальные решения", shortTitle: "Индивидуальные решения", icon: "⌘",
    text: "Разработка КД, опытный образец и серийное изготовление нестандартных изделий по функции, чертежу или техническому заданию.",
    items: ["Проектирование изделий", "Разработка КД", "Изготовление опытных образцов", "Изготовление по чертежам", "Серийное производство", "Импортозамещение", "Оптимизация конструкции", "Производство под вашим брендом (OEM)"],
    image: "/images/web/solution-custom.jpg",
    cardImage: "/images/industry/cards/custom.webp",
    href: "/solutions/custom",
  },
];
