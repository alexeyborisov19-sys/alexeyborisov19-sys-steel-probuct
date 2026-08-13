import type { Product } from "@/data/products";
import { legalOperator } from "./legal";
import { absoluteUrl, siteConfig } from "./site";

export type JsonLd = Record<string, unknown>;
export type Breadcrumb = { name: string; path: string };
export type FaqItem = { question: string; answer: string };
export type ArticleSchemaInput = {
  headline: string;
  description: string;
  path: string;
  image: string;
  datePublished: string;
  dateModified: string;
  citations?: string[];
};
export type EventSchemaItem = {
  id: string;
  name: string;
  shortName: string;
  startDate: string;
  endDate: string;
  city: string;
  countryCode: string;
  venue: string;
  officialUrl: string;
  description: string;
  keywords: string[];
  audience: string[];
};

// The seventeen oblasts of the Central Federal District; Moscow is its
// eighteenth subject and is listed separately as a federal city.
const centralFederalDistrictOblasts = [
  "Белгородская область",
  "Брянская область",
  "Владимирская область",
  "Воронежская область",
  "Ивановская область",
  "Калужская область",
  "Костромская область",
  "Курская область",
  "Липецкая область",
  "Московская область",
  "Орловская область",
  "Рязанская область",
  "Смоленская область",
  "Тамбовская область",
  "Тверская область",
  "Тульская область",
  "Ярославская область",
];

// Where the company ships and takes orders. This is the service area, not the
// location: production stays in Smolensk, and the address must keep saying so.
const areaServed = [
  { "@type": "Country", name: "Россия" },
  { "@type": "AdministrativeArea", name: "Центральный федеральный округ" },
  { "@type": "City", name: "Москва" },
  ...centralFederalDistrictOblasts.map((name) => ({ "@type": "AdministrativeArea", name })),
];

export function organizationSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness", "Manufacturer"],
    "@id": `${siteConfig.url}/#organization`,
    name: siteConfig.name,
    legalName: legalOperator.name,
    taxID: legalOperator.inn,
    // The state registration number identifies the legal entity in Russian
    // registries, which taxID alone does not.
    identifier: [{ "@type": "PropertyValue", propertyID: "OGRN", value: legalOperator.ogrn }],
    alternateName: "СП Сталь Продукт",
    url: siteConfig.url,
    logo: absoluteUrl(siteConfig.logo),
    image: absoluteUrl(siteConfig.defaultOgImage),
    description: siteConfig.description,
    email: siteConfig.email,
    telephone: siteConfig.telephone,
    address: {
      "@type": "PostalAddress",
      ...siteConfig.address,
    },
    areaServed,
    contactPoint: [{
      "@type": "ContactPoint",
      telephone: siteConfig.telephone,
      contactType: "sales",
      availableLanguage: ["ru"],
      areaServed: "RU",
    }],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Инженерные решения из листового металла",
      itemListElement: [
        ["Архитектурные решения", "/products"],
        ["Решения для климатического оборудования", "/solutions/climate"],
        ["Решения для промышленности", "/solutions/industry"],
        ["Инженерные системы", "/solutions/engineering"],
        ["Индивидуальные решения и OEM", "/solutions/custom"],
      ].map(([name, path]) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name, url: absoluteUrl(path) },
      })),
    },
    subjectOf: [
      {
        "@type": "VideoObject",
        name: "Сталь Продукт — о компании",
        description: "Фильм о команде, инженерной экспертизе и реальном производстве компании «Сталь Продукт».",
        url: absoluteUrl("/company#company-video"),
        contentUrl: absoluteUrl("/video/company-film-flat.mp4"),
        thumbnailUrl: absoluteUrl("/images/company-video-poster.png"),
        uploadDate: "2026-07-21T08:17:40Z",
        duration: "PT1M59S",
      },
      {
        "@type": "VideoObject",
        name: "Производство Сталь Продукт",
        description: "Короткая нарезка технологических операций: гибка, лазерная резка и сборка изделий из листового металла.",
        url: absoluteUrl("/production#production-video"),
        contentUrl: absoluteUrl("/video/production-showreel-web.mp4"),
        thumbnailUrl: absoluteUrl("/images/production-showreel-poster.png"),
        uploadDate: "2026-07-21T08:17:40Z",
        duration: "PT11S",
      },
    ],
    knowsAbout: [
      "Изделия из листового металла",
      "Металлокассеты",
      "Фасадные системы",
      "Лазерная резка металла",
      "Гибка металла",
      "Порошковая окраска",
      "Корпуса оборудования",
    ],
  };
}

export function websiteSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteConfig.url}/#website`,
    url: siteConfig.url,
    name: siteConfig.name,
    inLanguage: siteConfig.language,
    publisher: { "@id": `${siteConfig.url}/#organization` },
  };
}

export function webPageSchema({ name, description, path }: { name: string; description: string; path: string }): JsonLd {
  const url = absoluteUrl(path);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: siteConfig.language,
    isPartOf: { "@id": `${siteConfig.url}/#website` },
    about: { "@id": `${siteConfig.url}/#organization` },
  };
}

export function breadcrumbSchema(items: Breadcrumb[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function itemListSchema({
  name,
  description,
  path,
  items,
}: {
  name: string;
  description: string;
  path: string;
  items: Array<{ name: string; path: string }>;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${absoluteUrl(path)}#item-list`,
    name,
    description,
    numberOfItems: items.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

export function serviceSchema({ name, description, path, serviceType }: { name: string; description: string; path: string; serviceType?: string }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${absoluteUrl(path)}#service`,
    name,
    description,
    serviceType: serviceType ?? name,
    url: absoluteUrl(path),
    provider: { "@id": `${siteConfig.url}/#organization` },
    areaServed,
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: absoluteUrl("/contacts#contact-form"),
      servicePhone: siteConfig.telephone,
      serviceSmsNumber: siteConfig.telephone,
    },
  };
}

export function productSchema(product: Product): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${absoluteUrl(`/products/${product.slug}`)}#product`,
    name: product.title,
    description: product.lead,
    category: product.category,
    image: absoluteUrl(product.technicalImage),
    url: absoluteUrl(`/products/${product.slug}`),
    brand: { "@type": "Brand", name: siteConfig.name },
    manufacturer: { "@id": `${siteConfig.url}/#organization` },
    additionalProperty: product.specs?.map((spec) => ({
      "@type": "PropertyValue",
      name: spec.label,
      value: spec.value,
    })),
  };
}

export function productGroupSchema({
  name,
  description,
  path,
  groupId,
  products,
}: {
  name: string;
  description: string;
  path: string;
  groupId: string;
  products: Product[];
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    "@id": `${absoluteUrl(path)}#product-group`,
    productGroupID: groupId,
    name,
    description,
    category: "Фасадные металлокассеты",
    brand: { "@type": "Brand", name: siteConfig.name },
    manufacturer: { "@id": `${siteConfig.url}/#organization` },
    variesBy: ["https://schema.org/pattern"],
    hasVariant: products.map((product) => ({
      "@type": "Product",
      "@id": `${absoluteUrl(`/products/${product.slug}`)}#product`,
      name: product.title,
      description: product.lead,
      url: absoluteUrl(`/products/${product.slug}`),
      image: absoluteUrl(product.technicalImage),
      category: product.category,
      brand: { "@type": "Brand", name: siteConfig.name },
      manufacturer: { "@id": `${siteConfig.url}/#organization` },
      inProductGroupWithID: groupId,
    })),
  };
}

export function faqSchema(items: FaqItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function eventListSchema({
  name,
  description,
  path,
  events,
}: {
  name: string;
  description: string;
  path: string;
  events: EventSchemaItem[];
}): JsonLd {
  const pageUrl = absoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${pageUrl}#events`,
    name,
    description,
    numberOfItems: events.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: events.map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${pageUrl}#${event.id}`,
      item: {
        "@type": "ExhibitionEvent",
        "@id": `${pageUrl}#event-${event.id}`,
        name: event.name,
        alternateName: event.shortName,
        description: event.description,
        startDate: event.startDate,
        endDate: event.endDate,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        url: `${pageUrl}#${event.id}`,
        sameAs: event.officialUrl,
        inLanguage: siteConfig.language,
        keywords: event.keywords.join(", "),
        audience: {
          "@type": "Audience",
          audienceType: event.audience.join("; "),
        },
        location: {
          "@type": "Place",
          name: event.venue,
          address: {
            "@type": "PostalAddress",
            addressLocality: event.city,
            addressCountry: event.countryCode,
          },
        },
      },
    })),
  };
}

export function articleSchema({ headline, description, path, image, datePublished, dateModified, citations }: ArticleSchemaInput): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(path) },
    image: [absoluteUrl(image)],
    datePublished,
    dateModified,
    citation: citations,
    inLanguage: siteConfig.language,
    author: { "@id": `${siteConfig.url}/#organization` },
    publisher: {
      "@id": `${siteConfig.url}/#organization`,
      logo: { "@type": "ImageObject", url: absoluteUrl(siteConfig.logo) },
    },
  };
}
