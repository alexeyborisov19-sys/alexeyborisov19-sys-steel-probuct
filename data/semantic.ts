import type { Product } from "./products";

/**
 * Search phrases are kept in one place so that pages use intent-specific
 * language rather than a repeated list of generic operations.
 */
export const semanticKeywords = {
  core: [
    "инженерные решения из листового металла",
    "производство металлоизделий полного цикла",
    "изделия из листового металла по чертежам",
    "металлоизделия под проект",
    "производство металлоконструкций на заказ",
    "архитектурный и промышленный металл",
  ],
  production: [
    "инженерная металлообработка полного цикла",
    "производство от прототипа до серии",
    "конструкторское сопровождение производства",
    "порошковая окраска по RAL",
    "точная обработка листового металла",
    "серийное производство металлоизделий",
  ],
  architecture: [
    "фасадные решения из металла",
    "металлокассеты для вентилируемых фасадов",
    "архитектурные панели из металла",
    "доборные элементы для фасада",
    "металлические откосы и отливы",
    "парапетные крышки на заказ",
  ],
  climate: [
    "решения для размещения кондиционеров",
    "корзины для кондиционеров по размерам",
    "защитные экраны для внешних блоков",
    "кронштейны и монтажные конструкции для кондиционеров",
    "фасадные корзины для кондиционеров",
  ],
  industry: [
    "корпуса оборудования из листового металла",
    "производство промышленных шкафов и кожухов",
    "металлические рамы и каркасы оборудования",
    "защитные металлоконструкции для производства",
    "комплектующие для промышленного оборудования",
  ],
  engineering: [
    "решения для комплексного монтажа",
    "монтажные и опорные конструкции",
    "кронштейны для инженерных систем",
    "изделия для инженерной инфраструктуры",
    "металлические конструкции для коммуникаций",
  ],
  custom: [
    "производство металлоизделий по чертежам",
    "разработка КД и производство изделий",
    "изготовление опытных образцов из металла",
    "OEM производство металлоизделий",
    "импортозамещение металлических деталей",
    "оптимизация конструкции под производство",
  ],
} as const;

function unique(items: readonly string[]) {
  return [...new Set(items)].slice(0, 16);
}

export function solutionSearchPhrases(slug: string) {
  const bySlug: Record<string, readonly string[]> = {
    climate: semanticKeywords.climate,
    industry: semanticKeywords.industry,
    engineering: semanticKeywords.engineering,
    custom: semanticKeywords.custom,
  };
  return unique([...(bySlug[slug] ?? semanticKeywords.core), ...semanticKeywords.core.slice(0, 2)]);
}

export function productSearchPhrases(product: Product) {
  const productSpecific = [product.title, product.category, `купить ${product.title.toLowerCase()}`, `заказать ${product.title.toLowerCase()}`];
  return unique([...productSpecific, ...semanticKeywords.architecture, ...semanticKeywords.core.slice(0, 2)]);
}
