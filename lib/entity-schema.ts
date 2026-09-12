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
  };
}

export function legalOperatorEntitySchema(): JsonLd {
  const base = organizationSchema();

  return {
    ...base,
    name: legalOperator.name,
    alternateName: legalOperator.shortName,
    legalName: legalOperator.name,
    brand: { "@id": `${siteConfig.url}/#brand` },
  };
}
