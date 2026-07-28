export const siteConfig = {
  name: "Сталь Продукт",
  legalName: "ООО «ЭНЕРГОАЛЬЯНС»",
  description: "Инженерные решения из листового металла: проектирование, производство и поставка изделий для строительства, промышленности и инженерной инфраструктуры.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.steelprodukt.ru").replace(/\/$/, ""),
  locale: "ru_RU",
  language: "ru",
  email: "info@steelprodukt.ru",
  telephone: "+79107803723",
  telephoneDisplay: "+7 910 780 37 23",
  address: {
    streetAddress: "Рославльское шоссе, 7-й км, стр. 3",
    addressLocality: "Смоленск",
    addressCountry: "RU",
  },
  logo: "/logo/steel-product.png",
  defaultOgImage: "/images/industry/hero-building-v1.png",
} as const;

export function absoluteUrl(path = "/") {
  return new URL(path, `${siteConfig.url}/`).toString();
}

export function canonicalPath(path: string) {
  return path === "/" ? "/" : path.replace(/\/$/, "");
}
