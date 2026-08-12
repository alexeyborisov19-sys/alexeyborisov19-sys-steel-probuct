// Search engines hand out a verification token and then look for it in the page
// head, so the value is public by design and safe to keep here. Committing it
// means ownership can be confirmed by a normal deploy, without editing
// .env.production over SSH — and it survives a server rebuild. The environment
// variable still wins wherever one is set.
const verificationFallback = {
  yandex: "",
  google: "",
};

function verificationToken(fromEnvironment: string | undefined, fallback: string) {
  const token = (fromEnvironment ?? fallback).trim();
  return token.length > 0 ? token : undefined;
}

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
    addressRegion: "Смоленская область",
    addressCountry: "RU",
  },
  logo: "/logo/steel-product.png",
  defaultOgImage: "/images/industry/hero-building-v1.png",
  verification: {
    yandex: verificationToken(process.env.NEXT_PUBLIC_YANDEX_VERIFICATION, verificationFallback.yandex),
    google: verificationToken(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION, verificationFallback.google),
  },
} as const;

export function absoluteUrl(path = "/") {
  return new URL(path, `${siteConfig.url}/`).toString();
}

export function canonicalPath(path: string) {
  return path === "/" ? "/" : path.replace(/\/$/, "");
}
