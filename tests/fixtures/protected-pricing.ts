import type { CuttingRate, PricingBasis } from "../../lib/instant-quote/pricing";

/**
 * Synthetic values for tests only. These numbers are intentionally unrelated
 * to Steel Product production economics and must never be used as a fallback.
 */
export const TEST_PRICING_BASIS: PricingBasis = {
  materialMarketUpliftPct: 5,
  densityKgM3: {
    cold: 7800,
    hot: 7800,
    zinc: 7800,
    inox: 7900,
    alu: 2700,
    copper: 8900,
    brass: 8500,
  },
  operationRates: {
    bendRubEach: 10,
    weldRubM: 1000,
    pressRubEach: 5,
    countersinkRubEach: 7,
    drillRubEach: 3,
    threadRubEach: 4,
    shotRubM2: 100,
    powderRubM2: 200,
    grindRubM2: 90,
    assemblyRubHour: 500,
    packagingRubEach: 20,
  },
  engineeringPctOfWorks: 3,
  provisionalCommercialPct: 7,
  setupRubPerUniquePart: 100,
};

export const TEST_CUTTING_RATES: CuttingRate[] = [
  { thicknessMm: 1, baseRubPerM: 100, from100mRubPerM: 80, from500mRubPerM: 60, pierceRub: 1 },
  { thicknessMm: 2, baseRubPerM: 120, from100mRubPerM: 90, from500mRubPerM: 70, pierceRub: 2 },
  { thicknessMm: 10, baseRubPerM: 300, from100mRubPerM: 240, from500mRubPerM: 200, pierceRub: 5 },
];

export const TEST_PRICING_CONTEXT = {
  basis: TEST_PRICING_BASIS,
  cuttingRates: TEST_CUTTING_RATES,
};
