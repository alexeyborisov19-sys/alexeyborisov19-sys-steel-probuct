// Search engines hand out a verification token and then look for it in the page
// head, so the value is public by design and safe to keep here. Committing it
// means ownership can be confirmed by a normal deploy, without editing
// .env.production over SSH — and it survives a server rebuild. The environment
// variable still wins wherever one is set.
// Webmaster tools issue one token per registered address, so a site listed both
// with and without www carries two. Every token is rendered; an extra one is
// harmless, a missing one blocks confirmation.
const verificationFallback = {
  yandex: ["1c5dc6516f272910", "75b8861b4f6e8eb6"],
  google: [] as string[],
};

function verificationTokens(fromEnvironment: string | undefined, fallback: readonly string[]) {
  const source = fromEnvironment ? fromEnvironment.split(",") : fallback;
  const tokens = source.map((token) => token.trim()).filter((token) => token.length > 0);
  return tokens.length > 0 ? tokens : undefined;
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
    // The index the company gives for both its legal and postal address in
    // lib/legal.ts. Production sits on the same street; correct it here if the
    // site itself is served by a different one.
    postalCode: "214009",
    addressCountry: "RU",
  },
  logo: "/logo/steel-product.png",
  defaultOgImage: "/images/industry/hero-building-v1.png",
  verification: {
    yandex: verificationTokens(process.env.NEXT_PUBLIC_YANDEX_VERIFICATION, verificationFallback.yandex),
    google: verificationTokens(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION, verificationFallback.google),
  },
} as const;

export function absoluteUrl(path = "/") {
  return new URL(path, `${siteConfig.url}/`).toString();
}

export function canonicalPath(path: string) {
  return path === "/" ? "/" : path.replace(/\/$/, "");
}
