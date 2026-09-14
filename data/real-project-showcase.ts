import { realProjects, type RealProject } from "@/data/real-projects";

export type ProjectPhoto = {
  src: string;
  alt: string;
  credit: string;
  sourceUrl: string;
};

export type ShowcaseProject = RealProject & {
  photos: ProjectPhoto[];
};

const galleries: Record<string, ProjectPhoto[]> = {
  "solovinaya-roshcha": [
    {
      src: "/images/projects/solovinaya-roshcha-1.jpg",
      alt: "Жилой дом микрорайона «Соловьиная роща» в Смоленске: фасад собран из металлокассет",
      credit: "Собственная фотография «Сталь Продукт» · микрорайон «Соловьиная роща»",
      sourceUrl: "https://zao-vash-dom.ru/",
    },
    {
      src: "/images/projects/solovinaya-roshcha-2.jpg",
      alt: "Корпуса «Соловьиной рощи» — фасадные металлокассеты бирюзового, светлого и терракотового цвета",
      credit: "Собственная фотография «Сталь Продукт» · микрорайон «Соловьиная роща»",
      sourceUrl: "https://zao-vash-dom.ru/",
    },
    {
      src: "/images/projects/solovinaya-roshcha-3.jpg",
      alt: "Фасады жилых корпусов «Соловьиной рощи» в Смоленске, облицованные металлокассетами",
      credit: "Собственная фотография «Сталь Продукт» · микрорайон «Соловьиная роща»",
      sourceUrl: "https://zao-vash-dom.ru/",
    },
    {
      src: "/images/projects/solovinaya-roshcha-4.jpg",
      alt: "Эркерная часть жилого дома «Соловьиной рощи» с фасадом из металлокассет",
      credit: "Собственная фотография «Сталь Продукт» · микрорайон «Соловьиная роща»",
      sourceUrl: "https://zao-vash-dom.ru/",
    },
    {
      src: "/images/projects/solovinaya-roshcha-5.jpg",
      alt: "Фасад жилого дома «Соловьиной рощи» снизу вверх: ряды терракотовых металлокассет",
      credit: "Собственная фотография «Сталь Продукт» · микрорайон «Соловьиная роща»",
      sourceUrl: "https://zao-vash-dom.ru/",
    },
    {
      src: "/images/projects/solovinaya-roshcha-6.jpg",
      alt: "Терракотовые фасадные металлокассеты крупным планом: раскладка и швы",
      credit: "Собственная фотография «Сталь Продукт» · микрорайон «Соловьиная роща»",
      sourceUrl: "https://zao-vash-dom.ru/",
    },
    {
      src: "/images/projects/solovinaya-roshcha-7.jpg",
      alt: "Металлокассеты на пилоне жилого дома «Соловьиной рощи» — вид с внутриквартального проезда",
      credit: "Собственная фотография «Сталь Продукт» · микрорайон «Соловьиная роща»",
      sourceUrl: "https://zao-vash-dom.ru/",
    },
    {
      src: "/images/projects/solovinaya-roshcha-8.jpg",
      alt: "Микрорайон «Соловьиная роща» в Смоленске зимой: корпуса с фасадами из металлокассет",
      credit: "Собственная фотография «Сталь Продукт» · микрорайон «Соловьиная роща»",
      sourceUrl: "https://zao-vash-dom.ru/",
    },
  ],
  "shevchenko-6-smolensk": [
    {
      src: "/images/projects/shevchenko-6-smolensk-1.jpg",
      alt: "Жилой комплекс на улице Шевченко, 6 в Смоленске: десятиэтажные корпуса с фасадом из металлокассет",
      credit: "Собственная фотография «Сталь Продукт» · улица Шевченко, 6",
      sourceUrl: "https://2gis.ru/smolensk/search/%D1%83%D0%BB%D0%B8%D1%86%D0%B0%20%D0%A8%D0%B5%D0%B2%D1%87%D0%B5%D0%BD%D0%BA%D0%BE%2C%206",
    },
    {
      src: "/images/projects/shevchenko-6-smolensk-2.jpg",
      alt: "Фасады корпусов на улице Шевченко, 6 в Смоленске — металлокассеты и нежилые первые этажи",
      credit: "Собственная фотография «Сталь Продукт» · улица Шевченко, 6",
      sourceUrl: "https://2gis.ru/smolensk/search/%D1%83%D0%BB%D0%B8%D1%86%D0%B0%20%D0%A8%D0%B5%D0%B2%D1%87%D0%B5%D0%BD%D0%BA%D0%BE%2C%206",
    },
    {
      src: "/images/projects/shevchenko-6-smolensk-3.jpg",
      alt: "Фасад жилого дома на улице Шевченко, 6 крупнее: металлокассеты, эркеры и витрины первых этажей",
      credit: "Собственная фотография «Сталь Продукт» · улица Шевченко, 6",
      sourceUrl: "https://2gis.ru/smolensk/search/%D1%83%D0%BB%D0%B8%D1%86%D0%B0%20%D0%A8%D0%B5%D0%B2%D1%87%D0%B5%D0%BD%D0%BA%D0%BE%2C%206",
    },
  ],
  "smolenskaya-oblastnaya-klinicheskaya-bolnitsa": [
    {
      src: "/images/projects/smolenskaya-oblastnaya-klinicheskaya-bolnitsa-1.jpg",
      alt: "Смоленская областная клиническая больница: фасад корпуса с названием учреждения",
      credit: "Собственная фотография «Сталь Продукт» · Смоленская областная клиническая больница",
      sourceUrl: "https://www.admin-smolensk.ru/novosti/news/vrio-gubernatora-vasilij-anohin-oznakomilsya-s-rabotoj-oblastnyh-uchrezhdenij-zdravoohraneniya/",
    },
    {
      src: "/images/projects/smolenskaya-oblastnaya-klinicheskaya-bolnitsa-2.jpg",
      alt: "Корпус Смоленской областной клинической больницы со стороны улицы",
      credit: "Собственная фотография «Сталь Продукт» · Смоленская областная клиническая больница",
      sourceUrl: "https://www.admin-smolensk.ru/novosti/news/vrio-gubernatora-vasilij-anohin-oznakomilsya-s-rabotoj-oblastnyh-uchrezhdenij-zdravoohraneniya/",
    },
  ],
  "odkb-novyy-korpus": [
    {
      src: "/images/industries/medical.jpg",
      alt: "Иллюстративный визуал медицинского объекта — фотография объекта открывается в источнике",
      credit: "Иллюстративный визуал · фото объекта — «МК в Смоленске»",
      sourceUrl: "https://www.mk-smolensk.ru/social/2026/03/12/vasiliy-anokhin-novyy-korpus-detskoy-oblastnoy-bolnicy-gotov-na-73.html",
    },
    {
      src: "/images/projects/odkb-novyy-korpus-2.jpg",
      alt: "Монтаж фасадных элементов нового хирургического корпуса детской областной больницы",
      credit: "«Смоленская газета»",
      sourceUrl: "https://smolgazeta.ru/daylynews/135816-vasiliy-anohin-smolenskaya-detskaya.html",
    },
    {
      src: "/images/projects/odkb-novyy-korpus-3.jpg",
      alt: "Новый корпус Смоленской областной детской клинической больницы — ход строительства в марте 2026 года",
      credit: "«Смоленская газета», пресс-материалы объекта",
      sourceUrl: "https://smolgazeta.ru/daylynews/135816-vasiliy-anohin-smolenskaya-detskaya.html",
    },
    {
      src: "/images/projects/odkb-novyy-korpus-4.jpg",
      alt: "Фасад нового корпуса Смоленской областной детской клинической больницы — март 2026 года",
      credit: "«Смоленская газета», пресс-материалы объекта",
      sourceUrl: "https://smolgazeta.ru/daylynews/135816-vasiliy-anohin-smolenskaya-detskaya.html",
    },
  ],
  "onkologicheskiy-dispanser": [
    {
      src: "/images/projects/onkologicheskiy-dispanser-1.jpg",
      alt: "Новый Смоленский областной онкологический диспансер после открытия в феврале 2026 года",
      credit: "«Смоленская газета», фото из пресс-материалов губернатора Смоленской области",
      sourceUrl: "https://smolgazeta.ru/medic/135334-v-smolenske-oficialno-otkryli-oblastnoy.html",
    },
    {
      src: "/images/projects/onkologicheskiy-dispanser-2.jpg",
      alt: "Смоленский областной онкологический диспансер в день официального открытия",
      credit: "«Смоленская газета», фото из пресс-материалов губернатора Смоленской области",
      sourceUrl: "https://smolgazeta.ru/medic/135334-v-smolenske-oficialno-otkryli-oblastnoy.html",
    },
  ],
};

const obninskProject: RealProject = {
  slug: "mrrc-tsyba-obninsk",
  title: "МРНЦ им. А. Ф. Цыба",
  city: "Обнинск, Калужская область",
  category: "medical",
  categoryLabel: "Медицина",
  partner: "МРНЦ им. А. Ф. Цыба — филиал ФГБУ «НМИЦ радиологии» Минздрава России",
  image: "/images/projects/mrrc-tsyba-obninsk-1.jpg",
  imageAlt: "Корпус МРНЦ им. А. Ф. Цыба в Обнинске с фасадом из металлокассет",
  imageCredit: "Собственная фотография «Сталь Продукт»",
  imageSourceUrl: "https://new.nmicr.ru/mrrc/",
  supply: ["металлокассеты — поставка продолжается", "изделия по проектной документации"],
  description: "Объект в Обнинске — Медицинский радиологический научный центр имени А. Ф. Цыба. «Сталь Продукт» производит и поставляет металлокассеты для объекта; поставка продолжается в настоящее время. Монтаж не выполняем. Официальный сайт НМИЦ радиологии подтверждает МРНЦ им. А. Ф. Цыба по адресу: Обнинск, ул. Королёва, 4. Фотографии объекта — собственная съёмка «Сталь Продукт»: на них виден фасад с металлокассетами. Снимки не привязываются к конкретной поставленной партии без отдельного подтверждения.",
  sourceUrl: "https://new.nmicr.ru/mrrc/",
  sourceLabel: "Официальный сайт НМИЦ радиологии",
  featured: true,
};

const obninskPhotos: ProjectPhoto[] = [
  {
    src: "/images/projects/mrrc-tsyba-obninsk-1.jpg",
    alt: "Корпус МРНЦ им. А. Ф. Цыба в Обнинске: фасад облицован металлокассетами",
    credit: "Собственная фотография «Сталь Продукт» · объект МРНЦ им. А. Ф. Цыба",
    sourceUrl: "https://new.nmicr.ru/mrrc/",
  },
  {
    src: "/images/projects/mrrc-tsyba-obninsk-2.jpg",
    alt: "Фасадные металлокассеты на корпусе МРНЦ им. А. Ф. Цыба в Обнинске",
    credit: "Собственная фотография «Сталь Продукт» · объект МРНЦ им. А. Ф. Цыба",
    sourceUrl: "https://new.nmicr.ru/mrrc/",
  },
  {
    src: "/images/projects/mrrc-tsyba-obninsk-3.jpg",
    alt: "Ход облицовки фасада корпуса МРНЦ им. А. Ф. Цыба в Обнинске металлокассетами",
    credit: "Собственная фотография «Сталь Продукт» · объект МРНЦ им. А. Ф. Цыба",
    sourceUrl: "https://new.nmicr.ru/mrrc/",
  },
];

export const realProjectsShowcase: ShowcaseProject[] = [...realProjects, obninskProject].map((project) => {
  const photos = project.slug === obninskProject.slug ? obninskPhotos : galleries[project.slug] ?? [];
  const fallback: ProjectPhoto = {
    src: project.image,
    alt: project.imageAlt,
    credit: project.imageCredit ?? "Иллюстрация объекта / отрасли",
    sourceUrl: project.imageSourceUrl ?? project.sourceUrl,
  };

  return {
    ...project,
    photos: photos.length ? photos : [fallback],
  };
});

export const projectShowcaseBySlug = Object.fromEntries(realProjectsShowcase.map((project) => [project.slug, project])) as Record<string, ShowcaseProject>;
