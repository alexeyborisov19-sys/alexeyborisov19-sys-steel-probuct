import type { Product } from "@/data/products";
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
};

export function organizationSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "Manufacturer"],
    "@id": `${siteConfig.url}/#organization`,
    name: siteConfig.name,
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
    areaServed: { "@type": "Country", name: "Россия" },
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
        duration: "PT1M59S",
      },
      {
        "@type": "VideoObject",
        name: "Производство Сталь Продукт",
        description: "Короткая нарезка технологических операций: гибка, лазерная резка и сборка изделий из листового металла.",
        url: absoluteUrl("/production#production-video"),
        contentUrl: absoluteUrl("/video/production-showreel-web.mp4"),
        thumbnailUrl: absoluteUrl("/images/production-showreel-poster.png"),
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
    areaServed: { "@type": "Country", name: "Россия" },
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

export function articleSchema({ headline, description, path, image, datePublished, dateModified }: ArticleSchemaInput): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(path) },
    image: [absoluteUrl(image)],
    datePublished,
    dateModified,
    inLanguage: siteConfig.language,
    author: { "@id": `${siteConfig.url}/#organization` },
    publisher: {
      "@id": `${siteConfig.url}/#organization`,
      logo: { "@type": "ImageObject", url: absoluteUrl(siteConfig.logo) },
    },
  };
}
