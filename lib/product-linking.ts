import type { IndustrySolution } from "@/lib/industry-solutions";

const productItemRules: Array<{ pattern: RegExp; path: string }> = [
  { pattern: /металлокассет/i, path: "/products/metallokassety" },
  { pattern: /парапетн/i, path: "/products/parapetnye-kryshki" },
  { pattern: /пожарн(?:ые|ая).{0,20}отсеч/i, path: "/products/pozharnye-otsechki" },
  { pattern: /аквилон/i, path: "/products/akvilon" },
  { pattern: /(?:оконн.{0,12})?откос/i, path: "/products/otkosy-dlya-okon" },
  { pattern: /(?:оконн.{0,12})?отлив/i, path: "/products/otlivy-dlya-okon" },
  { pattern: /корзин.{0,30}кондиционер|экран.{0,30}(?:кондиционер|наружн.{0,8}блок)/i, path: "/solutions/climate" },
];

const productPatternsBySlug: Record<string, RegExp> = {
  "metallokassety-standart": /металлокассет/i,
  "metallokassety-premium": /металлокассет/i,
  "metallokassety-azhur": /металлокассет|перфорированн.{0,20}(?:панел|фасад)/i,
  "metallokassety-relef": /металлокассет|объ[её]мн.{0,20}(?:панел|фасад)/i,
  akvilon: /аквилон/i,
  "otkosy-dlya-okon": /откос/i,
  "parapetnye-kryshki": /парапетн/i,
  "otlivy-dlya-okon": /отлив/i,
  "pozharnye-otsechki": /пожарн(?:ые|ая).{0,20}отсеч/i,
};

export function productRouteForIndustryItem(item: string) {
  return productItemRules.find((rule) => rule.pattern.test(item))?.path;
}

export function industriesForProduct(productSlug: string, industries: IndustrySolution[]) {
  const pattern = productPatternsBySlug[productSlug];
  if (!pattern) return [];

  return industries.filter((industry) =>
    industry.sections.some((section) => section.items.some((item) => pattern.test(item))),
  );
}
