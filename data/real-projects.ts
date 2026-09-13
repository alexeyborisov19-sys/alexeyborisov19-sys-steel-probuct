export type RealProjectCategory = "residential" | "medical" | "education";

export type RealProject = {
  slug: string;
  title: string;
  city: string;
  category: RealProjectCategory;
  categoryLabel: string;
  partner?: string;
  image: string;
  imageAlt: string;
  imageCredit?: string;
  imageSourceUrl?: string;
  supply: string[];
  description: string;
  sourceUrl: string;
  sourceLabel: string;
  href?: string;
  featured?: boolean;
};

const localProjectVisuals: Record<RealProjectCategory, string> = {
  residential: "/images/industries/residential.jpg",
  medical: "/images/industries/medical.jpg",
  education: "/images/industries/educational.jpg",
};

const localVisualCredit = "Иллюстративный визуал отрасли · не фото объекта";

export const realProjects: RealProject[] = [
  {
    slug: "solovinaya-roshcha",
    title: "Микрорайон «Соловьиная роща» и «Новый квартал»",
    city: "Смоленск",
    category: "residential",
    categoryLabel: "Жилая застройка",
    partner: "АО СЗ «Ваш дом»",
    image: localProjectVisuals.residential,
    imageAlt: "Иллюстративный визуал жилой застройки",
    imageCredit: localVisualCredit,
    imageSourceUrl: "https://zao-vash-dom.ru/",
    supply: ["металлокассеты", "кронштейны", "металлические корпуса и ящики", "изделия по проектной документации"],
    description: "Многолетнее направление поставок для крупного жилого микрорайона. В разные периоды изделия поставлялись для нескольких объектов застройки и связанной инфраструктуры. Реальные фотографии объекта доступны по ссылкам на первоисточники; чужие файлы не загружаются на сайт без подтверждённого права публикации.",
    sourceUrl: "https://zao-vash-dom.ru/",
    sourceLabel: "Официальный сайт застройщика",
    href: "/projects/solovinaya-roshcha",
    featured: true,
  },
  {
    slug: "klovskiy",
    title: "ЖК «Кловский»",
    city: "Смоленск",
    category: "residential",
    categoryLabel: "Жилая застройка",
    image: localProjectVisuals.residential,
    imageAlt: "Иллюстративный визуал жилого объекта",
    imageCredit: localVisualCredit,
    imageSourceUrl: "https://xn----dtbkkfcbbh4a8a.xn--p1ai/",
    supply: ["металлокассеты", "кронштейны", "металлические ящики и корпуса", "другие изделия по спецификациям объектов"],
    description: "Поставки изделий из листового металла в рамках сотрудничества с жилым девелоперским проектом. Реальное фото объекта доступно на официальном сайте проекта.",
    sourceUrl: "https://xn----dtbkkfcbbh4a8a.xn--p1ai/",
    sourceLabel: "Официальный сайт проекта",
  },
  {
    slug: "unity-development",
    title: "Проекты «Юнити Девелопмент»",
    city: "Смоленск",
    category: "residential",
    categoryLabel: "Жилая застройка",
    partner: "Юнити Девелопмент",
    image: localProjectVisuals.residential,
    imageAlt: "Иллюстративный визуал жилой застройки",
    imageCredit: localVisualCredit,
    imageSourceUrl: "https://zhk-apart-kompleks-yuniti-smolensk-i.cian.ru/",
    supply: ["металлокассеты", "кронштейны", "металлические ящики и корпуса", "изделия из листового металла"],
    description: "Серийные и проектные поставки для объектов жилой и коммерческой застройки девелопера. Ссылки на открытые источники используются для идентификации проектов и не приписывают производство конкретному видимому участку фасада.",
    sourceUrl: "https://unity-groups.ru/",
    sourceLabel: "Официальный сайт девелопера",
  },
  {
    slug: "metrum-group",
    title: "Проекты «Метрум Груп»",
    city: "Смоленск",
    category: "residential",
    categoryLabel: "Жилая застройка",
    partner: "Метрум Груп",
    image: localProjectVisuals.residential,
    imageAlt: "Иллюстративный визуал жилой застройки",
    imageCredit: localVisualCredit,
    imageSourceUrl: "https://zhk-po-ul-25-sentyabrya-smolensk-i.cian.ru/",
    supply: ["металлокассеты", "кронштейны", "корпусные изделия", "изделия по проектным спецификациям"],
    description: "Поставки листовых металлоизделий для девелоперских проектов, в том числе объектов с современными фасадными решениями. Ссылки на открытые источники подтверждают контекст проекта, но не привязывают конкретную партию к видимому участку фасада.",
    sourceUrl: "https://metrumgroup.ru/projects",
    sourceLabel: "Официальный сайт девелопера",
  },
  {
    slug: "vostokstroy",
    title: "Проекты «ВостокСтрой»",
    city: "Смоленск",
    category: "residential",
    categoryLabel: "Жилая застройка",
    partner: "ВостокСтрой",
    image: localProjectVisuals.residential,
    imageAlt: "Иллюстративный визуал жилой застройки",
    imageCredit: localVisualCredit,
    imageSourceUrl: "https://zhk-po-ul1-ya-vostochnaya-smolensk-i.cian.ru/",
    supply: ["металлокассеты", "кронштейны", "металлические ящики и корпуса", "нестандартные изделия"],
    description: "Поставки металлических элементов для жилых объектов с сочетанием фасадных и инженерных решений. Реальные фотографии используются только через ссылки на источники и не являются доказательством конкретной номенклатуры поставки на видимом участке.",
    sourceUrl: "https://vostokstroy67.ru/novyj-dom-chernyakhovskogo-23",
    sourceLabel: "Официальный сайт застройщика",
  },
  {
    slug: "smolenskaya-oblastnaya-klinicheskaya-bolnitsa",
    title: "Смоленская областная клиническая больница",
    city: "Смоленск",
    category: "medical",
    categoryLabel: "Медицина",
    image: localProjectVisuals.medical,
    imageAlt: "Иллюстративный визуал медицинского объекта",
    imageCredit: localVisualCredit,
    imageSourceUrl: "https://smolgazeta.ru/medic/134686-v-smolenskoy-oblastnoy-klinicheskoy.html",
    supply: ["металлические изделия по проектной документации"],
    description: "Поставка металлических изделий для областного медицинского комплекса. Конкретный состав партий определялся проектной документацией объекта. Реальные фотографии доступны по ссылке на первоисточник.",
    sourceUrl: "https://www.admin-smolensk.ru/novosti/news/vrio-gubernatora-vasilij-anohin-oznakomilsya-s-rabotoj-oblastnyh-uchrezhdenij-zdravoohraneniya/",
    sourceLabel: "Правительство Смоленской области",
  },
  {
    slug: "odkb-novyy-korpus",
    title: "Новый корпус Смоленской областной детской клинической больницы",
    city: "Смоленск",
    category: "medical",
    categoryLabel: "Медицина",
    image: localProjectVisuals.medical,
    imageAlt: "Иллюстративный визуал медицинского объекта",
    imageCredit: localVisualCredit,
    imageSourceUrl: "https://www.mk-smolensk.ru/social/2026/03/12/vasiliy-anokhin-novyy-korpus-detskoy-oblastnoy-bolnicy-gotov-na-73.html",
    supply: ["металлические изделия", "фасадные элементы"],
    description: "Поставка металлических изделий для нового лечебного корпуса. В официальных материалах объекта отдельно отражён этап устройства фасада. В подборке источников сохранены несколько реальных фотографий разных стадий строительства, но они не загружаются на сайт без подтверждённого права публикации.",
    sourceUrl: "https://kapstr.admin-smolensk.ru/news/novyj-korpus-detskoj-oblastnoj-bolnicy-gotovnost-80/",
    sourceLabel: "Управление капитального строительства Смоленской области",
    featured: true,
  },
  {
    slug: "onkologicheskiy-dispanser",
    title: "Смоленский областной онкологический диспансер",
    city: "Смоленск",
    category: "medical",
    categoryLabel: "Медицина",
    image: localProjectVisuals.medical,
    imageAlt: "Иллюстративный визуал медицинского объекта",
    imageCredit: localVisualCredit,
    imageSourceUrl: "https://smolgazeta.ru/medic/135334-v-smolenske-oficialno-otkryli-oblastnoy.html",
    supply: ["металлокассеты", "вентиляционные решётки", "другие металлические изделия"],
    description: "Комплексная поставка нескольких групп изделий из листового металла для крупного нового медицинского объекта. Реальные фотографии объекта доступны у первоисточника.",
    sourceUrl: "https://www.admin-smolensk.ru/realizaciya-proektov/v-smolenske-otkrylsya-novyj-sovremennyj-onkologicheskij-dispanser/",
    sourceLabel: "Правительство Смоленской области",
    featured: true,
  },
  {
    slug: "litsey-solovinaya-roshcha",
    title: "Многопрофильный лицей в «Соловьиной роще»",
    city: "Смоленск",
    category: "education",
    categoryLabel: "Образование",
    image: localProjectVisuals.education,
    imageAlt: "Иллюстративный визуал образовательного объекта",
    imageCredit: localVisualCredit,
    imageSourceUrl: "https://zao-vash-dom.ru/news/tpost/3pdd77zkf1-mnogoprofilnii-litsei-v-solovinoi-rosche",
    supply: ["металлические изделия по проекту"],
    description: "Образовательная инфраструктура крупного микрорайона — отдельное направление поставок в рамках работы с объектами «Соловьиной рощи». Реальное фото лицея доступно на странице первоисточника.",
    sourceUrl: "https://zao-vash-dom.ru/news/tpost/3pdd77zkf1-mnogoprofilnii-litsei-v-solovinoi-rosche",
    sourceLabel: "АО СЗ «Ваш дом»",
    href: "/projects/solovinaya-roshcha",
  },
  {
    slug: "smolenskiy-meditsinskiy-kolledzh",
    title: "Смоленский базовый медицинский колледж имени К. С. Константиновой",
    city: "Смоленск",
    category: "education",
    categoryLabel: "Образование",
    image: localProjectVisuals.education,
    imageAlt: "Иллюстративный визуал образовательного объекта",
    imageCredit: localVisualCredit,
    supply: ["металлокассеты"],
    description: "Поставка фасадных металлокассет для проекта капитального ремонта учебного корпуса. После повторной проверки открытых источников современное фото фасада, которое можно однозначно привязать к этому корпусу после ремонта, не найдено; поэтому используется нейтральная отраслевая иллюстрация.",
    sourceUrl: "https://goszakupki.admin-smolensk.ru/portal/Show/order?link=11029176",
    sourceLabel: "Портал закупок Смоленской области",
  },
  {
    slug: "feniks-pechersk",
    title: "Техношкола «Феникс» в Печерске",
    city: "с. Печерск, Смоленская область",
    category: "education",
    categoryLabel: "Образование",
    image: localProjectVisuals.education,
    imageAlt: "Иллюстративный визуал образовательного объекта",
    imageCredit: localVisualCredit,
    imageSourceUrl: "https://smoldaily.ru/v-pecherske-stroitsya-tehnoshkola-feniks-robototehnika-3d-pechat-i-ii-dlya-726-uchenikov",
    supply: ["металлические изделия по проектной документации"],
    description: "Поставка изделий для строящегося образовательного центра. В официальных материалах июля 2026 года готовность оценивалась в 55%, а среди текущих работ отдельно было указано устройство вентилируемого фасада. Реальные фото хода строительства доступны у первоисточника.",
    sourceUrl: "https://minstroy67.admin-smolensk.ru/news/novaya-tehnoshkola-feniks-v-pecherske-gotovnost-55/",
    sourceLabel: "Министерство архитектуры и строительства Смоленской области",
    featured: true,
  },
  {
    slug: "stodolishchenskaya-shkola",
    title: "Стодолищенская средняя школа",
    city: "п. Стодолище, Смоленская область",
    category: "education",
    categoryLabel: "Образование",
    image: localProjectVisuals.education,
    imageAlt: "Иллюстративный визуал образовательного объекта",
    imageCredit: localVisualCredit,
    supply: ["металлокассеты"],
    description: "Поставка металлокассет для объекта капитального ремонта фасада школы. Официальные материалы муниципального округа подтверждают проведение капитального ремонта фасада в 2026 году. После повторной проверки открытых источников современное фото, которое можно уверенно привязать к нужному зданию, не добавлено.",
    sourceUrl: "https://pochinok.admin-smolensk.ru/news/na-kontrole-remont-stodolischenskoj-srednej-shkoly/",
    sourceLabel: "Администрация Починковского муниципального округа",
  },
];

export const projectCategoryLabels: Record<RealProjectCategory, string> = {
  residential: "Жилая застройка",
  medical: "Медицина",
  education: "Образование",
};

export const featuredRealProjects = realProjects.filter((project) => project.featured);
