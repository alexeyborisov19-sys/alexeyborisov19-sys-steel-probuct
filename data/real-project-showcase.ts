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
      src: "https://static.tildacdn.com/tild6566-3364-4764-a666-393734303130/4_2_1_747.webp",
      alt: "Жилая застройка микрорайона «Соловьиная роща» в Смоленске",
      credit: "АО СЗ «Ваш дом»",
      sourceUrl: "https://zao-vash-dom.ru/",
    },
    {
      src: "https://images.cdn-cian.ru/images/0/542/096/solovinaya-roshca-novyy-kvartal-smolensk-jk-690245038-6.jpg",
      alt: "ЖК «Соловьиная роща. Новый квартал» в Смоленске",
      credit: "ЦИАН — карточка ЖК «Соловьиная роща. Новый квартал»",
      sourceUrl: "https://zhk-solovinaya-roshca-novyy-kvartal-smolensk-i.cian.ru/",
    },
    {
      src: "https://www.rabochy-put.ru/upload/iblock/938/mobile_file_2020_05_21_09_04_28-_3_.jpg",
      alt: "Строительство жилых домов в «Соловьиной роще. Новый квартал»",
      credit: "«Рабочий путь»",
      sourceUrl: "https://www.rabochy-put.ru/news/147094-smolenskiy-mikrorayon-solovinaya-roshcha-novyy-kvartal-pobeditel-samoy-masshtabnoy-v-rossii-premii-t.html",
    },
  ],
  klovskiy: [
    {
      src: "https://static.tildacdn.com/tild6238-6239-4633-b536-366362383236/IMG_4467.jpg",
      alt: "Фасад жилого комплекса «Кловский» в Смоленске",
      credit: "Официальный сайт ЖК «Кловский»",
      sourceUrl: "https://xn----dtbkkfcbbh4a8a.xn--p1ai/",
    },
    {
      src: "https://static.tildacdn.com/tild3566-6539-4365-b161-666262623635/IMG_0841__10_.jpg",
      alt: "Двор и фасад жилого комплекса «Кловский»",
      credit: "Официальный сайт ЖК «Кловский»",
      sourceUrl: "https://xn----dtbkkfcbbh4a8a.xn--p1ai/",
    },
  ],
  "unity-development": [
    {
      src: "https://images.cdn-cian.ru/images/apartkompleks-yuniti-smolensk-jk-1894417700-10.jpg",
      alt: "Апарт-комплекс «Юнити» в Смоленске",
      credit: "ЦИАН — карточка апарт-комплекса «Юнити»",
      sourceUrl: "https://zhk-apart-kompleks-yuniti-smolensk-i.cian.ru/",
    },
    {
      src: "https://www.rabochy-put.ru/upload/iblock/581/fu5i2et853zq6us8taframclledl419q/IMG_5244.jpg",
      alt: "Жилой квартал «Боровая Парк» — один из проектов «Юнити Девелопмент» в Смоленске",
      credit: "«Рабочий путь» — материал о «Боровая Парк»",
      sourceUrl: "https://www.rabochy-put.ru/news/204890-borovaya-park-v-smolenske-kogda-gorod-i-priroda-stanovyatsya-sosedyami.html",
    },
  ],
  "metrum-group": [
    {
      src: "https://images.cdn-cian.ru/images/po-ul-25-sentyabrya-smolensk-jk-2005676224-7.jpg",
      alt: "Жилой проект «Метрум Груп» в Смоленске",
      credit: "ЦИАН — карточка жилого проекта",
      sourceUrl: "https://zhk-po-ul-25-sentyabrya-smolensk-i.cian.ru/",
    },
  ],
  vostokstroy: [
    {
      src: "https://vostokstroy67.ru/images/vostok-new/images/3.jpg",
      alt: "Новый дом на 1-й Восточной улице в Смоленске",
      credit: "Официальный сайт «ВостокСтрой»",
      sourceUrl: "https://vostokstroy67.ru/novyj-dom-na-vostochnoj",
    },
    {
      src: "https://images.cdn-cian.ru/images/novyy-dom-na-ul-1ya-vostochnaya-smolensk-jk-2671885088-7.jpg",
      alt: "Готовый фасад дома на 1-й Восточной улице в Смоленске",
      credit: "ЦИАН — карточка жилого дома",
      sourceUrl: "https://zhk-po-ul1-ya-vostochnaya-smolensk-i.cian.ru/",
    },
  ],
  "smolenskaya-oblastnaya-klinicheskaya-bolnitsa": [
    {
      src: "https://smolgazeta.ru/fc-web/fc-files/2026/01/166012.jpg",
      alt: "Смоленская областная клиническая больница — строительство нового модульного приёмного отделения в январе 2026 года",
      credit: "«Смоленская газета», пресс-материалы губернатора Смоленской области",
      sourceUrl: "https://smolgazeta.ru/medic/134686-v-smolenskoy-oblastnoy-klinicheskoy.html",
    },
    {
      src: "https://smolgazeta.ru/fc-web/fc-files/2026/01/166013.jpg",
      alt: "Работы на территории Смоленской областной клинической больницы в январе 2026 года",
      credit: "«Смоленская газета», пресс-материалы губернатора Смоленской области",
      sourceUrl: "https://smolgazeta.ru/medic/134686-v-smolenskoy-oblastnoy-klinicheskoy.html",
    },
  ],
  "odkb-novyy-korpus": [
    {
      src: "https://static.mk.ru/upload/entities/2026/03/11/18/articles/facebookPicture/80/5c/4a/c0/cc7a5ba438db3b358c287acc43ba3192.jpg",
      alt: "Фасад нового корпуса Смоленской областной детской клинической больницы в марте 2026 года",
      credit: "«МК в Смоленске», пресс-материалы объекта",
      sourceUrl: "https://www.mk-smolensk.ru/social/2026/03/12/vasiliy-anokhin-novyy-korpus-detskoy-oblastnoy-bolnicy-gotov-na-73.html",
    },
    {
      src: "https://smolgazeta.ru/fc-web/fc-files/2026/03/167633.jpg",
      alt: "Монтаж фасадных элементов нового хирургического корпуса детской областной больницы",
      credit: "«Смоленская газета»",
      sourceUrl: "https://smolgazeta.ru/daylynews/135816-vasiliy-anohin-smolenskaya-detskaya.html",
    },
    {
      src: "https://smolgazeta.ru/fc-web/fc-files/2026/03/167635.jpg",
      alt: "Новый корпус Смоленской областной детской клинической больницы — ход строительства в марте 2026 года",
      credit: "«Смоленская газета», пресс-материалы объекта",
      sourceUrl: "https://smolgazeta.ru/daylynews/135816-vasiliy-anohin-smolenskaya-detskaya.html",
    },
    {
      src: "https://smolgazeta.ru/fc-web/fc-files/2026/03/167634.jpg",
      alt: "Фасад нового корпуса Смоленской областной детской клинической больницы — март 2026 года",
      credit: "«Смоленская газета», пресс-материалы объекта",
      sourceUrl: "https://smolgazeta.ru/daylynews/135816-vasiliy-anohin-smolenskaya-detskaya.html",
    },
  ],
  "onkologicheskiy-dispanser": [
    {
      src: "https://smolgazeta.ru/fc-web/fc-files/2026/02/166941.jpg",
      alt: "Новый Смоленский областной онкологический диспансер после открытия в феврале 2026 года",
      credit: "«Смоленская газета», фото из пресс-материалов губернатора Смоленской области",
      sourceUrl: "https://smolgazeta.ru/medic/135334-v-smolenske-oficialno-otkryli-oblastnoy.html",
    },
    {
      src: "https://smolgazeta.ru/fc-web/fc-files/2026/02/166940.jpg",
      alt: "Смоленский областной онкологический диспансер в день официального открытия",
      credit: "«Смоленская газета», фото из пресс-материалов губернатора Смоленской области",
      sourceUrl: "https://smolgazeta.ru/medic/135334-v-smolenske-oficialno-otkryli-oblastnoy.html",
    },
  ],
  "litsey-solovinaya-roshcha": [
    {
      src: "https://static.tildacdn.com/tild6434-6265-4335-a661-393165383762/image.png",
      alt: "Многопрофильный лицей в микрорайоне «Соловьиная роща» в Смоленске",
      credit: "АО СЗ «Ваш дом»",
      sourceUrl: "https://zao-vash-dom.ru/news/tpost/3pdd77zkf1-mnogoprofilnii-litsei-v-solovinoi-rosche",
    },
  ],
  "smolenskiy-meditsinskiy-kolledzh": [],
  "feniks-pechersk": [
    {
      src: "https://smoldaily.ru/wp-content/uploads/2026/07/img_2508.jpg",
      alt: "Строительство техношколы «Феникс» в Печерске летом 2026 года",
      credit: "SmolDaily, пресс-материалы объекта",
      sourceUrl: "https://smoldaily.ru/v-pecherske-stroitsya-tehnoshkola-feniks-robototehnika-3d-pechat-i-ii-dlya-726-uchenikov",
    },
    {
      src: "https://smoldaily.ru/wp-content/uploads/2026/07/img_2509.jpg",
      alt: "Техношкола «Феникс» в Печерске — строительная готовность летом 2026 года",
      credit: "SmolDaily, пресс-материалы объекта",
      sourceUrl: "https://smoldaily.ru/v-pecherske-stroitsya-tehnoshkola-feniks-robototehnika-3d-pechat-i-ii-dlya-726-uchenikov",
    },
    {
      src: "https://smoldaily.ru/wp-content/uploads/2026/07/img_2510.jpg",
      alt: "Фасадная часть строящейся техношколы «Феникс» в Печерске",
      credit: "SmolDaily, пресс-материалы объекта",
      sourceUrl: "https://smoldaily.ru/v-pecherske-stroitsya-tehnoshkola-feniks-robototehnika-3d-pechat-i-ii-dlya-726-uchenikov",
    },
    {
      src: "https://static.mk.ru/upload/entities/2026/07/17/03/articles/detailPicture/d3/96/9a/4b/e673b06bc81f6b5e798062f0d56217f9.jpg",
      alt: "Строительство техношколы «Феникс» в Печерске в июле 2026 года",
      credit: "«МК в Смоленске», фото из пресс-материалов губернатора Смоленской области",
      sourceUrl: "https://www.mk-smolensk.ru/social/2026/07/16/v-smolenskom-okruge-stroitsya-novaya-tekhnoshkola-feniks.html",
    },
  ],
  "stodolishchenskaya-shkola": [],
};

const obninskProject: RealProject = {
  slug: "mrrc-tsyba-obninsk",
  title: "МРНЦ им. А. Ф. Цыба",
  city: "Обнинск, Калужская область",
  category: "medical",
  categoryLabel: "Медицина",
  partner: "МРНЦ им. А. Ф. Цыба — филиал ФГБУ «НМИЦ радиологии» Минздрава России",
  image: "/images/industries/medical.jpg",
  imageAlt: "Иллюстративный визуал медицинского объекта",
  imageCredit: "Иллюстративный визуал отрасли · не фото объекта",
  imageSourceUrl: "https://vestnikstroy.ru/articles/aktualno/v-obninske-zavershilos-blagoustroystvo-territorii-meditsinskogo-tsentra-imeni-a-f-tsyba-/",
  supply: ["металлокассеты — поставка продолжается", "изделия по проектной документации"],
  description: "Объект в Обнинске — Медицинский радиологический научный центр имени А. Ф. Цыба. «Сталь Продукт» производит и поставляет металлокассеты для объекта; поставка продолжается в настоящее время. Монтаж не выполняем. Официальный сайт НМИЦ радиологии подтверждает МРНЦ им. А. Ф. Цыба по адресу: Обнинск, ул. Королёва, 4. Публичные фотографии используются для идентификации объекта и не привязываются к конкретной поставленной партии без отдельного подтверждения.",
  sourceUrl: "https://new.nmicr.ru/mrrc/",
  sourceLabel: "Официальный сайт НМИЦ радиологии",
  featured: true,
};

const obninskPhotos: ProjectPhoto[] = [
  {
    src: "https://vestnikstroy.ru/upload/iblock/af3/qwjf6j6ttixu368xe86x1wg8bz6dqzmz.jpeg",
    alt: "Здание клиники МРНЦ им. А. Ф. Цыба в Обнинске после реконструкции",
    credit: "«Вестник строительного комплекса»",
    sourceUrl: "https://vestnikstroy.ru/articles/aktualno/v-obninske-zavershilos-blagoustroystvo-territorii-meditsinskogo-tsentra-imeni-a-f-tsyba-/",
  },
  {
    src: "https://sdelanounas.ru/uploads/3/0/3021772793354_orig.jpeg",
    alt: "Клинический корпус МРНЦ им. А. Ф. Цыба в Обнинске",
    credit: "«Сделано у нас»",
    sourceUrl: "https://sdelanounas.ru/blogs/174421/",
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
