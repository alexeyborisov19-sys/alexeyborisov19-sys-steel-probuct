import { readFileSync } from "node:fs";
import { join } from "node:path";

export type IndustrySection = {
  title: string;
  items: string[];
};

export type IndustrySolution = {
  slug: string;
  title: string;
  sections: IndustrySection[];
};

const sourcePath = join(process.cwd(), "data", "industry-solutions-source.txt");

export const industrySlugByTitle: Record<string, string> = {
  "Жилые комплексы": "zhilye-kompleksy",
  "Бизнес-центры": "biznes-centry",
  "Торговые центры": "torgovye-centry",
  "Медицинские учреждения": "medicinskie-uchrezhdeniya",
  "Образовательные учреждения": "obrazovatelnye-uchrezhdeniya",
  "Гостиницы и апарт отели": "gostinicy-i-apart-oteli",
  "Инженерная инфраструктура": "inzhenernaya-infrastruktura",
  "Производственные предприятия": "proizvodstvennye-predpriyatiya",
  "Агропромышленный комплекс": "agropromyshlennyj-kompleks",
  "Энергетика": "energetika",
  "Нефтяная отрасль": "neftyanaya-otrasl",
  "Транспортная инфраструктура": "transportnaya-infrastruktura",
  "Пищевая промышленность": "pishchevaya-promyshlennost",
  "Фармацевтическая промышленность": "farmacevticheskaya-promyshlennost",
  "ЦОД и технологическая инфраструктура": "cod-i-tehnologicheskaya-infrastruktura",
  "Машиностроение и приборостроение": "mashinostroenie-i-priborostroenie",
};

export const industryVisualByTitle: Record<string, string> = {
  "Жилые комплексы": "residential.jpg",
  "Бизнес-центры": "business-center.jpg",
  "Торговые центры": "shopping-center.jpg",
  "Медицинские учреждения": "medical.jpg",
  "Образовательные учреждения": "educational.jpg",
  "Гостиницы и апарт отели": "hotel.jpg",
  "Инженерная инфраструктура": "infrastructure.jpg",
  "Производственные предприятия": "production.jpg",
  "Агропромышленный комплекс": "agro.jpg",
  "Энергетика": "energy.jpg",
  "Нефтяная отрасль": "oil-gas.jpg",
  "Транспортная инфраструктура": "transport.jpg",
  "Пищевая промышленность": "food.jpg",
  "Фармацевтическая промышленность": "pharmaceutical.jpg",
  "ЦОД и технологическая инфраструктура": "data-center.jpg",
  "Машиностроение и приборостроение": "machine-building.jpg",
};

// The order also distinguishes a sector heading from a similarly named section
// inside another sector (for example, "Инженерная инфраструктура").
const industryHeadings = new Set([
  "Жилые комплексы",
  "Бизнес-центры",
  "Торговые центры",
  "Медицинские учреждения",
  "Образовательные учреждения",
  "Гостиницы и апарт отели",
  "Инженерная инфраструктура",
  "Производственные предприятия",
  "Агропромышленный комплекс",
  "Энергетика",
  "Нефтяная отрасль",
  "Транспортная инфраструктура",
  "Пищевая промышленность",
  "Фармацевтическая промышленность",
  "ЦОД и технологическая инфраструктура",
  "Машиностроение и приборостроение",
]);

const cleanHeading = (value: string) => value.trim().replace(/:\s*$/, "");

export function getIndustrySolutions(): IndustrySolution[] {
  const industries: IndustrySolution[] = [];
  const usedIndustryHeadings = new Set<string>();
  let currentIndustry: IndustrySolution | undefined;
  let currentSection: IndustrySection | undefined;

  for (const rawLine of readFileSync(sourcePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line === "⸻") continue;

    if (line.startsWith("* ")) {
      if (currentSection) currentSection.items.push(line.slice(2).trim());
      continue;
    }

    const heading = cleanHeading(line);
    if (industryHeadings.has(heading) && !usedIndustryHeadings.has(heading)) {
      currentIndustry = { slug: industrySlugByTitle[heading], title: heading, sections: [] };
      industries.push(currentIndustry);
      usedIndustryHeadings.add(heading);
      currentSection = undefined;
      continue;
    }

    if (currentIndustry) {
      currentSection = { title: heading, items: [] };
      currentIndustry.sections.push(currentSection);
    }
  }

  return industries.filter((industry) => industry.sections.some((section) => section.items.length));
}

export function getIndustrySolutionBySlug(slug: string) {
  return getIndustrySolutions().find((industry) => industry.slug === slug);
}
