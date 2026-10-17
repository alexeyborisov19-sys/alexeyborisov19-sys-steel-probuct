/**
 * Sources used to ground the public engineering assistant.
 *
 * Only publicly accessible URLs and claims already published by Steel Produkt
 * are allowed. This file is an explicit human-reviewed 2026-10-17 snapshot, NOT
 * a live website scraper or third-party independent verification.
 *
 * The /company/facts BIM summary is older than current public source code.
 * Do NOT copy its legacy IFC/locking details into model knowledge.
 */
export const publicKnowledgeCheckedOn = "2026-10-17" as const;
export const publicKnowledgeSources = {
  companyFacts: "https://www.steelprodukt.ru/company/facts",
  company: "https://www.steelprodukt.ru/company",
  laserCutting: "https://www.steelprodukt.ru/production/lazernaya-rezka-metalla",
  cad: "https://www.steelprodukt.ru/online-order",
  metalCassettes: "https://www.steelprodukt.ru/calculator-metallokassety",
  climate: "https://www.steelprodukt.ru/solutions/climate",
  basket: "https://www.steelprodukt.ru/products/korziny-dlya-konditsionerov",
  bimCassettesCode: "https://github.com/alexeyborisov19-sys/alexeyborisov19-sys-steel-probuct/blob/main/app/%28public%29/products/metallokassety/bim/page.tsx",
  bimTrimsCode: "https://github.com/alexeyborisov19-sys/alexeyborisov19-sys-steel-probuct/blob/main/app/%28public%29/products/dobornye-elementy/bim/page.tsx",
} as const;

/** Published by the business; independently verified facility data NOT available. */
export const selfPublishedProductionSnapshot = {
  equipment: {
    laserComplexes: 3,
    pressBrakes: 4,
    panelBenders: 1,
    weldingStations: 4,
    powderCoatingBooths: 3,
    shotBlastingChambers: 1,
    laserCleaningSystems: 1,
  },
  scale: {
    floorArea: "2 000+ м²",
    specialists: "70+",
    annualMetalCassetteOutput: "около 60 000 м²/год",
  },
  laser: {
    blackSteelThicknessRange: "0,5–40 мм",
    tableWorkingArea: "1500 × 3000 мм",
  },
  onSiteInstallation: false,
} as const;
