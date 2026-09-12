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
      src: "https://lic-mnogoprofilnyj-smolensk-r66.gosweb.gosuslugi.ru/netcat_files/23/241/photo1711107010.jpg",
      alt: "Главный вход Многопрофильного лицея в Смоленске",
      credit: "Официальный сайт Многопрофильного лицея",
      sourceUrl: "https://lic-mnogoprofilnyj-smolensk-r66.gosweb.gosuslugi.ru/",
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
  slug: "kb-8-fmba-obninsk",
  title: "Соматический детский стационар КБ № 8 ФМБА России",
  city: "Обнинск, Калужская область",
  category: "medical",
  categoryLabel: "Медицина",
  partner: "ФГБУЗ КБ № 8 ФМБА России",
  image: "https://www.admobninsk.ru/netcat_files/multifile/1809/33806/avv.jpg",
  imageAlt: "Медицинский комплекс КБ № 8 ФМБА России в Обнинске во время официального визита 2025 года",
  imageCredit: "Фото: Администрация города Обнинска / пресс-служба губернатора Калужской области",
  imageSourceUrl: "https://www.admobninsk.ru/news/2025/08/29/news_33806.html",
  supply: ["металлические изделия по проектной документации"],
  description: "Объект, ранее фигурировавший в рабочем списке как «Обнинская ОДКБ», после повторной проверки идентифицирован как Соматический детский стационар ФГБУЗ КБ № 8 ФМБА России по адресу просп. Ленина, 85, корп. 2. Закупка № 0337100018825000349 от 31.10.2025 прямо относится к текущему ремонту фасада этого здания. Фотографии показывают комплекс КБ № 8 во время официального визита 2025 года и не используются как доказательство конкретного поставленного элемента.",
  sourceUrl: "https://kb8-fmba.ru/hospital",
  sourceLabel: "Официальный сайт КБ № 8 ФМБА России",
  featured: true,
};

const obninskPhotos: ProjectPhoto[] = [
  {
    src: "https://www.admobninsk.ru/netcat_files/multifile/1809/33806/avv.jpg",
    alt: "Медицинский комплекс КБ № 8 ФМБА России в Обнинске во время официального визита в августе 2025 года",
    credit: "Администрация города Обнинска / пресс-служба губернатора Калужской области",
    sourceUrl: "https://www.admobninsk.ru/news/2025/08/29/news_33806.html",
  },
  {
    src: "https://www.admobninsk.ru/netcat_files/multifile/1809/33806/photo_2025_08_28_18_07_11.jpg",
    alt: "КБ № 8 ФМБА России в Обнинске — материалы официального визита августа 2025 года",
    credit: "Администрация города Обнинска / пресс-служба губернатора Калужской области",
    sourceUrl: "https://www.admobninsk.ru/news/2025/08/29/news_33806.html",
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
