import type { ManufacturingOperation, PartGeometrySummary } from "@/lib/instant-quote/domain";
import { calculateBoundingRectangleBlank } from "@/lib/instant-quote/blanking";

export type MaterialId = "cold" | "hot" | "zinc" | "inox" | "alu" | "copper" | "brass";

export type MaterialMarketPrice = {
  materialId: MaterialId;
  thicknessMm: number;
  rubPerTon: number;
  rubPerTonFrom3t?: number;
  source: string;
  sourceDate: string;
  fetchedAt: string;
  size?: string;
  exactThickness?: boolean;
};

export type PricingBasis = {
  materialMarketUpliftPct: number;
  densityKgM3: Record<MaterialId, number>;
  operationRates: {
    bendRubEach: number;
    weldRubM: number;
    pressRubEach: number;
    countersinkRubEach: number;
    drillRubEach: number;
    threadRubEach: number;
    shotRubM2: number;
    powderRubM2: number;
    grindRubM2: number;
    assemblyRubHour: number;
    packagingRubEach: number;
  };
  engineeringPctOfWorks: number;
  provisionalCommercialPct: number;
  setupRubPerUniquePart: number;
};

export const PROVISIONAL_PRICING_BASIS: PricingBasis = {
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
    bendRubEach: 25,
    weldRubM: 1800,
    pressRubEach: 12,
    countersinkRubEach: 35,
    drillRubEach: 15,
    threadRubEach: 25,
    shotRubM2: 350,
    powderRubM2: 450,
    grindRubM2: 250,
    assemblyRubHour: 900,
    packagingRubEach: 40,
  },
  engineeringPctOfWorks: 5,
  provisionalCommercialPct: 16.5,
  setupRubPerUniquePart: 1000,
};

export type CuttingRate = {
  thicknessMm: number;
  baseRubPerM: number;
  from100mRubPerM: number;
  from500mRubPerM: number;
  pierceRub: number;
};

export const PROVISIONAL_STEEL_CUTTING_RATES: CuttingRate[] = [
  { thicknessMm: 0.8, baseRubPerM: 62.8, from100mRubPerM: 39.6, from500mRubPerM: 35.5, pierceRub: 1.4 },
  { thicknessMm: 1, baseRubPerM: 50, from100mRubPerM: 39.6, from500mRubPerM: 35.5, pierceRub: 1.4 },
  { thicknessMm: 1.5, baseRubPerM: 64.2, from100mRubPerM: 45.1, from500mRubPerM: 41, pierceRub: 1.4 },
  { thicknessMm: 2, baseRubPerM: 66.9, from100mRubPerM: 51.9, from500mRubPerM: 46.5, pierceRub: 1.4 },
  { thicknessMm: 2.5, baseRubPerM: 75.1, from100mRubPerM: 64.2, from500mRubPerM: 57.4, pierceRub: 1.4 },
  { thicknessMm: 3, baseRubPerM: 88.8, from100mRubPerM: 73.8, from500mRubPerM: 66.9, pierceRub: 1.4 },
  { thicknessMm: 4, baseRubPerM: 102.4, from100mRubPerM: 83.3, from500mRubPerM: 75.1, pierceRub: 2.8 },
  { thicknessMm: 5, baseRubPerM: 122.9, from100mRubPerM: 97, from500mRubPerM: 88.8, pierceRub: 2.8 },
  { thicknessMm: 6, baseRubPerM: 157, from100mRubPerM: 112, from500mRubPerM: 102.4, pierceRub: 2.8 },
  { thicknessMm: 8, baseRubPerM: 218.4, from100mRubPerM: 143.4, from500mRubPerM: 129.7, pierceRub: 2.8 },
  { thicknessMm: 10, baseRubPerM: 273, from100mRubPerM: 227.5, from500mRubPerM: 171.6, pierceRub: 6.5 },
  { thicknessMm: 12, baseRubPerM: 338, from100mRubPerM: 260, from500mRubPerM: 214.5, pierceRub: 6.5 },
  { thicknessMm: 14, baseRubPerM: 361.1, from100mRubPerM: 361.1, from500mRubPerM: 361.1, pierceRub: 8.6 },
  { thicknessMm: 16, baseRubPerM: 480.5, from100mRubPerM: 480.5, from500mRubPerM: 480.5, pierceRub: 8.6 },
  { thicknessMm: 18, baseRubPerM: 524.2, from100mRubPerM: 524.2, from500mRubPerM: 524.2, pierceRub: 12 },
  { thicknessMm: 20, baseRubPerM: 600.6, from100mRubPerM: 600.6, from500mRubPerM: 600.6, pierceRub: 12 },
  { thicknessMm: 25, baseRubPerM: 760.1, from100mRubPerM: 760.1, from500mRubPerM: 760.1, pierceRub: 18 },
  { thicknessMm: 30, baseRubPerM: 912.1, from100mRubPerM: 912.1, from500mRubPerM: 912.1, pierceRub: 21.6 },
  { thicknessMm: 40, baseRubPerM: 1216.2, from100mRubPerM: 1216.2, from500mRubPerM: 1216.2, pierceRub: 28.8 },
];

export function applyMetalUplift(
  rubPerTon: number,
  upliftPct = PROVISIONAL_PRICING_BASIS.materialMarketUpliftPct,
) {
  if (!Number.isFinite(rubPerTon) || rubPerTon <= 0) throw new Error("Invalid metal market price");
  return rubPerTon * (1 + upliftPct / 100);
}

export function nearestMarketPrice(
  rows: MaterialMarketPrice[],
  materialId: MaterialId,
  thicknessMm: number,
): MaterialMarketPrice | null {
  const candidates = rows.filter((row) => row.materialId === materialId && row.rubPerTon > 0);
  if (!candidates.length) return null;
  return candidates.reduce((best, row) =>
    Math.abs(row.thicknessMm - thicknessMm) < Math.abs(best.thicknessMm - thicknessMm) ? row : best,
  );
}

export function nearestCuttingRate(thicknessMm: number, rows = PROVISIONAL_STEEL_CUTTING_RATES) {
  if (!rows.length) throw new Error("Cutting rate table is empty");
  return rows.reduce((best, row) =>
    Math.abs(row.thicknessMm - thicknessMm) < Math.abs(best.thicknessMm - thicknessMm) ? row : best,
  );
}

export function cuttingRubPerM(rate: CuttingRate, totalBatchCutM: number) {
  if (totalBatchCutM >= 500) return rate.from500mRubPerM;
  if (totalBatchCutM >= 100) return rate.from100mRubPerM;
  return rate.baseRubPerM;
}

export function supplierRubPerTon(price: MaterialMarketPrice, totalPurchasedMassKg: number) {
  if (totalPurchasedMassKg >= 3000 && price.rubPerTonFrom3t && price.rubPerTonFrom3t > 0) {
    return { rubPerTon: price.rubPerTonFrom3t, tier: "from-3t" as const };
  }
  return { rubPerTon: price.rubPerTon, tier: "under-3t" as const };
}

export type ProvisionalPartPricingInput = {
  materialId: MaterialId;
  thicknessMm: number;
  quantity: number;
  geometry: PartGeometrySummary;
  marketPrice: MaterialMarketPrice;
  operations: ManufacturingOperation[];
  bendCount?: number;
  weldLengthM?: number;
  powderSides?: 1 | 2;
  assemblyMinutes?: number;
  // Reserved for a future shop-specific allowance around the blank.
  // 1.0 means current rule: metal = exact X×Y rectangular blank around the part.
  materialUsageFactor?: number;
};

export type ProvisionalPartPrice = {
  materialMarketRubPerTon: number;
  materialMarketTier: "under-3t" | "from-3t";
  materialPricedRubPerTon: number;
  netAreaMm2: number;
  blankWidthMm: number;
  blankHeightMm: number;
  blankAreaMm2: number;
  netMassKg: number;
  blankMassKg: number;
  purchasedMassKg: number;
  batchPurchasedMassKg: number;
  blankWastePct: number | null;
  materialRubEach: number;
  laserRubEach: number;
  laserRubPerM: number;
  operationsRubEach: number;
  engineeringRubEach: number;
  setupRubBatch: number;
  setupRubEach: number;
  internalSubtotalRubEach: number;
  provisionalCommercialRubEach: number;
  unitRub: number;
  totalRub: number;
  warnings: string[];
};

export function calculateProvisionalPartPrice(
  input: ProvisionalPartPricingInput,
  basis: PricingBasis = PROVISIONAL_PRICING_BASIS,
): ProvisionalPartPrice {
  const quantity = Math.max(1, Math.floor(input.quantity || 1));
  const density = basis.densityKgM3[input.materialId];
  const blank = calculateBoundingRectangleBlank(input.geometry);
  const netAreaMm2 = blank.netAreaMm2 ?? blank.areaMm2;
  const netAreaM2 = netAreaMm2 / 1_000_000;
  const thicknessM = input.thicknessMm / 1000;

  // Net mass describes the finished part and may use the real closed-contour area.
  const netMassKg = input.geometry.volumeMm3 && input.geometry.volumeMm3 > 0
    ? input.geometry.volumeMm3 / 1_000_000_000 * density
    : netAreaM2 * thicknessM * density;

  // Purchased metal is deliberately NOT based on the net contour area.
  // Until true sheet nesting is connected, Steel Product prices the rectangular X×Y blank around the part.
  const blankMassKg = blank.areaMm2 / 1_000_000 * thicknessM * density;
  const usageFactor = Math.max(1, input.materialUsageFactor ?? 1);
  const purchasedMassKg = blankMassKg * usageFactor;
  const batchPurchasedMassKg = purchasedMassKg * quantity;

  const supplierTier = supplierRubPerTon(input.marketPrice, batchPurchasedMassKg);
  const materialPricedRubPerTon = applyMetalUplift(supplierTier.rubPerTon, basis.materialMarketUpliftPct);
  const materialRubEach = purchasedMassKg * materialPricedRubPerTon / 1000;

  // Laser remains tied to real toolpath: actual contour length + actual pierces.
  const cut = nearestCuttingRate(input.thicknessMm);
  const cutLengthM = Math.max(0, (input.geometry.cutLengthMm ?? 0) / 1000);
  const totalBatchCutM = cutLengthM * quantity;
  const laserRubPerM = cuttingRubPerM(cut, totalBatchCutM);
  const pierces = Math.max(0, input.geometry.pierceCount ?? input.geometry.contourCount ?? 0);
  const laserRubEach = input.operations.includes("laser-cutting")
    ? cutLengthM * laserRubPerM + pierces * cut.pierceRub
    : 0;

  let operationsRubEach = 0;
  const r = basis.operationRates;
  if (input.operations.includes("bending")) operationsRubEach += Math.max(0, input.bendCount ?? input.geometry.bendCount ?? 0) * r.bendRubEach;
  if (input.operations.includes("welding")) operationsRubEach += Math.max(0, input.weldLengthM ?? 0) * r.weldRubM;
  if (input.operations.includes("powder-coating")) operationsRubEach += netAreaM2 * (input.powderSides ?? 2) * r.powderRubM2;
  if (input.operations.includes("assembly")) operationsRubEach += Math.max(0, input.assemblyMinutes ?? 0) / 60 * r.assemblyRubHour;
  if (input.operations.includes("packaging")) operationsRubEach += r.packagingRubEach;

  const worksRubEach = laserRubEach + operationsRubEach;
  const engineeringRubEach = worksRubEach * basis.engineeringPctOfWorks / 100;
  const setupRubBatch = basis.setupRubPerUniquePart;
  const setupRubEach = setupRubBatch / quantity;
  const internalSubtotalRubEach = materialRubEach + worksRubEach + engineeringRubEach + setupRubEach;
  const provisionalCommercialRubEach = internalSubtotalRubEach * basis.provisionalCommercialPct / 100;
  const unitRub = internalSubtotalRubEach + provisionalCommercialRubEach;

  const warnings: string[] = [];
  if (!input.marketPrice.exactThickness) warnings.push("Цена металла выбрана по ближайшей толщине прайса.");
  warnings.push("Металл рассчитан по прямоугольной заготовке X×Y вокруг детали; настоящий листовой nesting позже уточнит распределение обрези по партии.");
  if (blank.netAreaMm2 == null && !(input.geometry.volumeMm3 && input.geometry.volumeMm3 > 0)) {
    warnings.push("Чистая площадь детали не подтверждена; нетто-масса временно равна массе габаритной заготовки.");
  }
  if (usageFactor > 1) warnings.push(`К прямоугольной заготовке дополнительно применён коэффициент расхода ${usageFactor.toFixed(3)}.`);
  if (input.operations.includes("welding") && !(input.weldLengthM && input.weldLengthM > 0)) warnings.push("Сварка включена, но длина шва не определена.");

  return {
    materialMarketRubPerTon: supplierTier.rubPerTon,
    materialMarketTier: supplierTier.tier,
    materialPricedRubPerTon,
    netAreaMm2,
    blankWidthMm: blank.widthMm,
    blankHeightMm: blank.heightMm,
    blankAreaMm2: blank.areaMm2,
    netMassKg,
    blankMassKg,
    purchasedMassKg,
    batchPurchasedMassKg,
    blankWastePct: blank.wastePct,
    materialRubEach,
    laserRubEach,
    laserRubPerM,
    operationsRubEach,
    engineeringRubEach,
    setupRubBatch,
    setupRubEach,
    internalSubtotalRubEach,
    provisionalCommercialRubEach,
    unitRub,
    totalRub: unitRub * quantity,
    warnings,
  };
}
