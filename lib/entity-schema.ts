import { legalOperatorExternalReferences, legalOperatorSameAs } from "@/data/entity-references";
import { organizationSchema, type JsonLd } from "./schema";
import { legalOperator } from "./legal";
import { absoluteUrl, siteConfig } from "./site";

export function brandEntitySchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Brand",
    "@id": `${siteConfig.url}/#brand`,
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl(siteConfig.logo),
    description: siteConfig.description,
    mainEntityOfPage: { "@id": `${absoluteUrl("/company/facts")}#webpage` },
  };
}

export function legalOperatorEntitySchema(): JsonLd {
  const base = organizationSchema();

  return {
    ...base,
    name: legalOperator.name,
    alternateName: legalOperator.shortName,
    legalName: legalOperator.name,
    taxID: legalOperator.inn,
    identifier: [
      { "@type": "PropertyValue", propertyID: "ИНН", value: legalOperator.inn },
      { "@type": "PropertyValue", propertyID: "ОГРН", value: legalOperator.ogrn },
    ],
    brand: { "@id": `${siteConfig.url}/#brand` },
    sameAs: legalOperatorSameAs,
    mainEntityOfPage: { "@id": `${absoluteUrl("/company/facts")}#webpage` },
  };
}

export function companyFactsAboutPageSchema(): JsonLd {
  const url = absoluteUrl("/company/facts");

  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${url}#webpage`,
    url,
    name: `Факты о производстве «${siteConfig.name}»`,
    description: "Проверенные сведения о бренде, юридическом операторе, производственной площадке, оборудовании и границах работ.",
    inLanguage: siteConfig.language,
    dateModified: "2026-09-12",
    isPartOf: { "@id": `${siteConfig.url}/#website` },
    about: [
      { "@id": `${siteConfig.url}/#brand` },
      { "@id": `${siteConfig.url}/#organization` },
    ],
    mainEntity: [
      { "@id": `${siteConfig.url}/#brand` },
      { "@id": `${siteConfig.url}/#organization` },
    ],
    citation: legalOperatorExternalReferences.map((reference) => ({
      "@type": "WebPage",
      name: `${reference.name}: ${legalOperator.shortName}`,
      url: reference.url,
    })),
  };
}
