export type UpcomingIndustryEvent = {
  name: string;
  shortName: string;
  dates: string;
  startDate: string;
  city: string;
  venue: string;
  direction: string;
  why: string;
  url: string;
  badge: string;
};

export const upcomingIndustryEvents: UpcomingIndustryEvent[] = [
  {
    name: "100+ TechnoBuild 2026",
    shortName: "100+ TechnoBuild",
    dates: "29 сентября – 2 октября 2026",
    startDate: "2026-09-29",
    city: "Екатеринбург",
    venue: "МВЦ «Екатеринбург-ЭКСПО»",
    direction: "Строительство · фасады · BIM",
    why: "Крупный строительный форум и выставка: девелоперы, архитекторы, проектировщики, производители материалов и технологий. Полезно для фасадного направления и работы с застройщиками.",
    url: "https://forum-100.ru/",
    badge: "Новое в календаре",
  },
  {
    name: "Weldex 2026",
    shortName: "Weldex",
    dates: "6–9 октября 2026",
    startDate: "2026-10-06",
    city: "Москва",
    venue: "МВЦ «Крокус Экспо», павильон 1, зал 4",
    direction: "Сварка · роботизация · резка",
    why: "Профильная площадка по сварочному оборудованию и технологиям. В программе 2026 отдельно заявлена роботизация сварочного производства и практические кейсы внедрения.",
    url: "https://weldex.ru/ru/",
    badge: "Производство",
  },
  {
    name: "ExpoCoating Moscow 2026",
    shortName: "ExpoCoating Moscow",
    dates: "19–21 октября 2026",
    startDate: "2026-10-19",
    city: "Москва",
    venue: "МВЦ «Крокус Экспо», павильон 1",
    direction: "Покрытия · подготовка поверхности",
    why: "Специализированная выставка материалов и оборудования для обработки поверхности и нанесения покрытий — напрямую связана с порошковой окраской и подготовкой металла.",
    url: "https://www.expocoating-moscow.ru/ru-RU/",
    badge: "Покрытия",
  },
  {
    name: "Металл-Экспо 2026",
    shortName: "Металл-Экспо",
    dates: "10–13 ноября 2026",
    startDate: "2026-11-10",
    city: "Санкт-Петербург",
    venue: "КВЦ «Экспофорум»",
    direction: "Металл · прокат · оборудование",
    why: "Крупная промышленная выставка по чёрной и цветной металлургии, металлопродукции, сервисным металлоцентрам, оборудованию и технологиям обработки.",
    url: "https://www.metal-expo.ru/",
    badge: "Материалы",
  },
];
