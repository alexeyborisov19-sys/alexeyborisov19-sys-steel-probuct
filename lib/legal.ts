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
  policyVersion: "23 сентября 2026 года",
} as const;

export const legalDocumentVersions = {
  privacy: "2026-10-01",
  personalDataConsent: "2026-10-01",
  analyticsConsent: "2026-10-01",
  marketingConsent: "2026-10-01",
  cookies: "2026-10-01",
  terms: "2026-10-01",
  services: "2026-10-01",
} as const;

export const legalDocumentDisplayDates = {
  privacy: "1 октября 2026 года",
  personalDataConsent: "1 октября 2026 года",
  analyticsConsent: "1 октября 2026 года",
  marketingConsent: "1 октября 2026 года",
  cookies: "1 октября 2026 года",
  terms: "1 октября 2026 года",
  services: "1 октября 2026 года",
} as const;

/**
 * Persons processing personal data on the Operator's behalf (ч. 3 ст. 6 and
 * п. 6 ч. 4 ст. 9 152-ФЗ). Every entry is a Russian legal entity; adding a
 * service here is a legal-document change and needs the owner's approval.
 */
export const legalProcessors = {
  hosting: {
    name: "ООО «Бегет»",
    inn: "7801451618",
    address: "195112, г. Санкт-Петербург, пл. Карла Фаберже, д. 8, лит. Б, офис 726А",
    role: "размещение сайта, хранение заявок, приложенных файлов и зашифрованных резервных копий на серверах в Российской Федерации",
  },
  mail: {
    name: "ООО «ВК»",
    inn: "7743001840",
    address: "125167, г. Москва, Ленинградский проспект, д. 39, стр. 79",
    role: "корпоративная почта Mail.ru, через которую Оператор получает уведомления о заявках и ведёт переписку",
  },
  analytics: {
    name: "ООО «ЯНДЕКС»",
    inn: "7736207543",
    address: "119021, г. Москва, ул. Льва Толстого, д. 16",
    role: "веб-аналитика Яндекс Метрика — только после отдельного согласия пользователя на аналитику",
  },
} as const;

export const legalLinks = {
  privacy: "/legal/privacy",
  personalDataConsent: "/legal/personal-data-consent",
  analyticsConsent: "/legal/analytics-consent",
  marketingConsent: "/legal/marketing-consent",
  cookies: "/legal/cookies",
  services: "/legal/services",
  terms: "/legal/terms",
  requisites: "/legal/requisites",
} as const;
