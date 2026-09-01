export const legalOperator = {
  brand: "Сталь Продукт",
  name: "Общество с ограниченной ответственностью «ЭНЕРГОАЛЬЯНС»",
  shortName: "ООО «ЭНЕРГОАЛЬЯНС»",
  inn: "6732110789",
  kpp: "673201001",
  ogrn: "1156733014657",
  director: "Москвин Виктор Александрович",
  legalAddress: "214009, Смоленская область, г.о. город Смоленск, г. Смоленск, ш. Рославльское, д. 99, стр. 2, помещ. 1,2,3,4,8",
  postalAddress: "214009, г. Смоленск, а/я 4",
  productionAddress: "г. Смоленск, Рославльское шоссе, 7-й км, стр. 3",
  email: "info@steelprodukt.ru",
  privacyEmail: "info@steelprodukt.ru",
  phone: "+7 910 780 37 23",
  bank: {
    account: "40702810009770001572",
    bank: "ФИЛИАЛ «ЦЕНТРАЛЬНЫЙ» БАНКА ВТБ (ПАО)",
    correspondentAccount: "30101810145250000411",
    bik: "044525411",
  },
  policyVersion: "30 июля 2026 года",
} as const;

export const legalDocumentVersions = {
  privacy: "2026-08-27",
  personalDataConsent: "2026-08-27",
  marketingConsent: "2026-07-30",
  cookies: "2026-08-27",
  terms: "2026-07-30",
  services: "2026-09-01",
} as const;

export const legalDocumentDisplayDates = {
  privacy: "27 августа 2026 года",
  personalDataConsent: "27 августа 2026 года",
  cookies: "27 августа 2026 года",
  services: "1 сентября 2026 года",
} as const;

export const legalLinks = {
  privacy: "/legal/privacy",
  personalDataConsent: "/legal/personal-data-consent",
  marketingConsent: "/legal/marketing-consent",
  cookies: "/legal/cookies",
  services: "/legal/services",
  terms: "/legal/terms",
  requisites: "/legal/requisites",
} as const;
