import type { ManufacturingOperation, PartGeometrySummary } from "@/lib/instant-quote/domain";
import { resolveMaterialStockPlan, type BlankStrategy } from "@/lib/instant-quote/blanking";

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

/**
 * Compatibility-only public basis. It deliberately contains no commercial or
 * production rates. A protected server caller must pass an explicit basis.
 */
export const PROVISIONAL_PRICING_BASIS: PricingBasis = {
  materialMarketUpliftPct: 0,
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
    bendRubEach: 0,
    weldRubM: 0,
    pressRubEach: 0,
    countersinkRubEach: 0,
    drillRubEach: 0,
    threadRubEach: 0,
    shotRubM2: 0,
    powderRubM2: 0,
    grindRubM2: 0,
    assemblyRubHour: 0,
    packagingRubEach: 0,
  },
  engineeringPctOfWorks: 0,
  provisionalCommercialPct: 0,
  setupRubPerUniquePart: 0,
};

export type CuttingRate = {
  thicknessMm: number;
  baseRubPerM: number;
  from100mRubPerM: number;
  from500mRubPerM: number;
  pierceRub: number;
};

/** Real cutting rates are private runtime data, not repository data. */
export const PROVISIONAL_STEEL_CUTTING_RATES: CuttingRate[] = [];

export function applyMetalUplift(rubPerTon: number, upliftPct = 0) {
  if (!Number.isFinite(rubPerTon) || rubPerTon <= 0) throw new Error("Invalid metal market price");
  if (!Number.isFinite(upliftPct) || upliftPct < 0) throw new Error("Invalid metal uplift");
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

export function nearestCuttingRate(thicknessMm: number, rows: CuttingRate[] = []) {
  if (!rows.length) throw new Error("Protected cutting rate table is required");
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
  materialUsageFactor?: number;
};

export type ProvisionalPartPrice = {
  materialMarketRubPerTon: number;
  materialMarketTier: "under-3t" | "from-3t";
  materialPricedRubPerTon: number;
  materialAllocationStrategy: BlankStrategy;
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

function positive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Protected ${label} rate is required`);
  return value;
}

/**
 * Legacy arithmetic retained only for protected server-side callers and tests.
 * No real rate is embedded here. Public code must not call this with the empty
 * compatibility basis/table.
 */
export function calculateProvisionalPartPrice(
  input: ProvisionalPartPricingInput,
  basis: PricingBasis = PROVISIONAL_PRICING_BASIS,
  cuttingRates: CuttingRate[] = PROVISIONAL_STEEL_CUTTING_RATES,
): ProvisionalPartPrice {
  if (basis === PROVISIONAL_PRICING_BASIS) throw new Error("Protected pricing basis is required");
  if (!input.marketPrice.exactThickness) throw new Error("Exact protected material price is required");

  const quantity = Math.max(1, Math.floor(input.quantity || 1));
  const density = basis.densityKgM3[input.materialId];
  const blank = resolveMaterialStockPlan(input.geometry);
  const netAreaMm2 = blank.netAreaMm2 ?? blank.areaMm2;
  const netAreaM2 = netAreaMm2 / 1_000_000;
  const thicknessM = input.thicknessMm / 1000;
  const netMassKg = input.geometry.volumeMm3 && input.geometry.volumeMm3 > 0
    ? input.geometry.volumeMm3 / 1_000_000_000 * density
    : netAreaM2 * thicknessM * density;

  const blankMassKg = blank.areaMm2 / 1_000_000 * thicknessM * density;
  const usageFactor = Math.max(1, input.materialUsageFactor ?? 1);
  const purchasedMassKg = blankMassKg * usageFactor;
  const batchPurchasedMassKg = purchasedMassKg * quantity;

  const supplierTier = supplierRubPerTon(input.marketPrice, batchPurchasedMassKg);
  const materialPricedRubPerTon = applyMetalUplift(supplierTier.rubPerTon, basis.materialMarketUpliftPct);
  const materialRubEach = purchasedMassKg * materialPricedRubPerTon / 1000;

  const cutLengthM = Math.max(0, (input.geometry.cutLengthMm ?? 0) / 1000);
  const totalBatchCutM = cutLengthM * quantity;
  const pierces = Math.max(0, input.geometry.pierceCount ?? input.geometry.contourCount ?? 0);
  let laserRubPerM = 0;
  let laserRubEach = 0;
  if (input.operations.includes("laser-cutting")) {
    const cut = nearestCuttingRate(input.thicknessMm, cuttingRates);
    laserRubPerM = positive(cuttingRubPerM(cut, totalBatchCutM), "laser");
    laserRubEach = cutLengthM * laserRubPerM + pierces * Math.max(0, cut.pierceRub);
  }

  let operationsRubEach = 0;
  const r = basis.operationRates;
  if (input.operations.includes("bending")) {
    operationsRubEach += Math.max(0, input.bendCount ?? input.geometry.bendCount ?? 0) * positive(r.bendRubEach, "bending");
  }
  if (input.operations.includes("welding")) {
    if (!(input.weldLengthM && input.weldLengthM > 0)) throw new Error("Actual weld length is required");
    operationsRubEach += input.weldLengthM * positive(r.weldRubM, "welding");
  }
  if (input.operations.includes("powder-coating")) {
    if (!input.powderSides) throw new Error("Explicit powder coating sides are required");
    operationsRubEach += netAreaM2 * input.powderSides * positive(r.powderRubM2, "powder coating");
  }
  if (input.operations.includes("assembly")) {
    if (!(input.assemblyMinutes && input.assemblyMinutes > 0)) throw new Error("Actual assembly minutes are required");
    operationsRubEach += input.assemblyMinutes / 60 * positive(r.assemblyRubHour, "assembly");
  }
  if (input.operations.includes("packaging")) operationsRubEach += positive(r.packagingRubEach, "packaging");

  const worksRubEach = laserRubEach + operationsRubEach;
  const engineeringRubEach = worksRubEach * Math.max(0, basis.engineeringPctOfWorks) / 100;
  const setupRubBatch = Math.max(0, basis.setupRubPerUniquePart);
  const setupRubEach = setupRubBatch / quantity;
  const internalSubtotalRubEach = materialRubEach + worksRubEach + engineeringRubEach + setupRubEach;
  const provisionalCommercialRubEach = internalSubtotalRubEach * Math.max(0, basis.provisionalCommercialPct) / 100;
  const unitRub = internalSubtotalRubEach + provisionalCommercialRubEach;

  const warnings: string[] = [];
  if (blank.strategy === "bounding-rectangle") warnings.push("Расход металла пока основан на прямоугольной заготовке; nesting может уточнить его.");
  if (blank.netAreaMm2 == null && !(input.geometry.volumeMm3 && input.geometry.volumeMm3 > 0)) warnings.push("Чистая площадь детали не подтверждена.");
  if (usageFactor > 1) warnings.push("Применён утверждённый внутренний коэффициент расхода металла.");

  return {
    materialMarketRubPerTon: supplierTier.rubPerTon,
    materialMarketTier: supplierTier.tier,
    materialPricedRubPerTon,
    materialAllocationStrategy: blank.strategy,
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
