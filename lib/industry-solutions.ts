import { readFileSync } from "node:fs";
import { join } from "node:path";

export type IndustrySection = {
  title: string;
  items: string[];
};

export type IndustrySolution = {
  title: string;
  sections: IndustrySection[];
};

const sourcePath = join(process.cwd(), "data", "industry-solutions-source.txt");

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
      currentIndustry = { title: heading, sections: [] };
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
