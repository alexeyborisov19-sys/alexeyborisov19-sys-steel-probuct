export const brandOfficialProfiles = [
  {
    name: "Avito",
    url: "https://m.avito.ru/brands/i221455062/all?sellerId=4aeb5aa7821314bb4d85d50311963002",
    verifiedOn: "2026-09-12",
    scope: "brand-official",
  },
] as const;

export const brandSameAs = brandOfficialProfiles.map((reference) => reference.url);

export const legalOperatorExternalReferences = [
  {
    name: "РБК Компании",
    url: "https://companies.rbc.ru/id/1156733014657-ooo-energoalyans/",
    verifiedOn: "2026-09-12",
    scope: "legal-operator",
  },
  {
    name: "СПАРК-Интерфакс",
    url: "https://spark-interfax.ru/smolenskaya-oblast-smolensk/ooo-energoalyans-inn-6732110789-ogrn-1156733014657-f8eee79f78d749a3826a431c2b024d8f",
    verifiedOn: "2026-09-12",
    scope: "legal-operator",
  },
] as const;

export const legalOperatorSameAs = legalOperatorExternalReferences.map((reference) => reference.url);
