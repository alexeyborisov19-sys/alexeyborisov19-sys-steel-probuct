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
    text: "Фасадные системы и архитектурные элементы для современных зданий и сооружений.",
    items: ["Металлокассеты", "Доборные элементы", "Откосы для окон", "Отливы для окон", "Парапетные крышки", "Аквилоны", "Пожарные отсечки", "Декоративные панели"],
    image: "/images/web/hero-main.webp",
    cardImage: "/images/industry/cards/architecture.webp",
    href: "/products",
  },
  {
    title: "Решения для кондиционирования", shortTitle: "Решения для кондиционирования", icon: "❄",
    text: "Изделия для размещения и защиты наружных блоков кондиционирования и вентиляционного оборудования.",
    items: ["Корзины для кондиционеров", "Кронштейны для кондиционеров", "Экраны для кондиционеров", "Корзины по размерам", "Защитные экраны", "Антивандальные корзины", "Декоративные панели", "Комплектующие и крепеж"],
    image: "/images/web/solution-climate.jpg",
    cardImage: "/images/industry/cards/climate.webp",
    cardImagePosition: "center 48%",
    href: "/solutions/climate",
  },
  {
    title: "Решения для промышленности", shortTitle: "Решения для промышленности", icon: "▣",
    text: "Корпуса, шкафы, кожухи, каркасы и другие металлоконструкции для промышленного оборудования и производств.",
    items: ["Корпуса и шкафы", "Кожухи и защитные ограждения", "Каркасы и рамы", "Кабельные лотки и короба", "Панели и облицовки", "Площадки и ограждения", "Металлические поддоны", "Кронштейны и крепеж"],
    image: "/images/web/solution-industry.jpg",
    cardImage: "/images/industry/cards/industry.webp",
    imageClassName: "brightness-[1.16] contrast-[1.02] saturate-[1.04]",
    href: "/solutions/industry",
  },
  {
    title: "Инженерные системы", shortTitle: "Инженерные системы", icon: "⚙",
    text: "Вентиляционные решетки, люки, кронштейны, монтажные конструкции и другие изделия для инженерных коммуникаций, оборудования и кровли.",
    items: ["Вентиляционные решетки", "Люки", "Кронштейны", "Монтажные конструкции", "Опорные конструкции", "Кровельные монтажные системы", "Дефлекторы и зонты"],
    image: "/images/web/solution-engineering.jpg",
    cardImage: "/images/industry/cards/engineering.webp",
    href: "/solutions/engineering",
  },
  {
    title: "Индивидуальные решения", shortTitle: "Индивидуальные решения", icon: "⌘",
    text: "От идеи до серийного производства: берем на себя полный цикл разработки изделий любой сложности.",
    items: ["Проектирование изделий", "Разработка КД", "Изготовление опытных образцов", "Изготовление по чертежам", "Серийное производство", "Импортозамещение", "Оптимизация конструкции", "Производство под вашим брендом (OEM)"],
    image: "/images/web/solution-custom.jpg",
    cardImage: "/images/industry/cards/custom.webp",
    href: "/solutions/custom",
  },
];
