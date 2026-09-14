import type { ManufacturingOperation, PartGeometrySummary } from "@/lib/instant-quote/domain";

export type MaterialId = "cold" | "hot" | "zinc" | "inox" | "alu" | "copper" | "brass";

export type MaterialMarketPrice = {
  materialId: MaterialId;
  thicknessMm: number;
  rubPerTon: number;
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
  fixedPartAddRub: number;
};

// Provisional internal basis migrated from the metalworking calculator dated 2026-09-14.
// These values are deliberately isolated so the online product can later use approved ERP/admin rates.
export const PROVISIONAL_PRICING_BASIS: PricingBasis = {
  // User-approved rule for the new platform: current metal market/procurement price + 5%.
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
  fixedPartAddRub: 1000,
};

export type CuttingRate = {
  thicknessMm: number;
  rubPerM: number;
  pierceRub: number;
};

// Steel laser rates migrated from the current internal metalworking calculator.
// Quantity-tier selection will be added above this table; c1/base is used for the first alpha.
export const PROVISIONAL_STEEL_CUTTING_RATES: CuttingRate[] = [
  { thicknessMm: 0.8, rubPerM: 62.8, pierceRub: 1.4 },
  { thicknessMm: 1, rubPerM: 50, pierceRub: 1.4 },
  { thicknessMm: 1.5, rubPerM: 64.2, pierceRub: 1.4 },
  { thicknessMm: 2, rubPerM: 66.9, pierceRub: 1.4 },
  { thicknessMm: 2.5, rubPerM: 75.1, pierceRub: 1.4 },
  { thicknessMm: 3, rubPerM: 88.8, pierceRub: 1.4 },
  { thicknessMm: 4, rubPerM: 102.4, pierceRub: 2.8 },
  { thicknessMm: 5, rubPerM: 122.9, pierceRub: 2.8 },
  { thicknessMm: 6, rubPerM: 157, pierceRub: 2.8 },
  { thicknessMm: 8, rubPerM: 218.4, pierceRub: 2.8 },
  { thicknessMm: 10, rubPerM: 273, pierceRub: 6.5 },
  { thicknessMm: 12, rubPerM: 338, pierceRub: 6.5 },
  { thicknessMm: 14, rubPerM: 361.1, pierceRub: 8.6 },
  { thicknessMm: 16, rubPerM: 480.5, pierceRub: 8.6 },
  { thicknessMm: 18, rubPerM: 524.2, pierceRub: 12 },
  { thicknessMm: 20, rubPerM: 600.6, pierceRub: 12 },
  { thicknessMm: 25, rubPerM: 760.1, pierceRub: 18 },
  { thicknessMm: 30, rubPerM: 912.1, pierceRub: 21.6 },
  { thicknessMm: 40, rubPerM: 1216.2, pierceRub: 28.8 },
];

export function applyMetalUplift(rubPerTon: number, upliftPct = PROVISIONAL_PRICING_BASIS.materialMarketUpliftPct) {
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
  // Optional nesting/scrap multiplier. 1.10 = ten percent more purchased mass than net geometry mass.
  materialUsageFactor?: number;
};

export type ProvisionalPartPrice = {
  materialMarketRubPerTon: number;
  materialPricedRubPerTon: number;
  netMassKg: number;
  purchasedMassKg: number;
  materialRubEach: number;
  laserRubEach: number;
  operationsRubEach: number;
  engineeringRubEach: number;
  fixedAddRubEach: number;
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
  const areaM2 = Math.max(0, (input.geometry.widthMm ?? 0) * (input.geometry.heightMm ?? 0) / 1_000_000);
  const thicknessM = input.thicknessMm / 1000;
  const netMassKg = input.geometry.volumeMm3 && input.geometry.volumeMm3 > 0
    ? input.geometry.volumeMm3 / 1_000_000_000 * density
    : areaM2 * thicknessM * density;
  const usageFactor = Math.max(1, input.materialUsageFactor ?? 1.15);
  const purchasedMassKg = netMassKg * usageFactor;

  const materialPricedRubPerTon = applyMetalUplift(input.marketPrice.rubPerTon, basis.materialMarketUpliftPct);
  const materialRubEach = purchasedMassKg * materialPricedRubPerTon / 1000;

  const cut = nearestCuttingRate(input.thicknessMm);
  const cutLengthM = Math.max(0, (input.geometry.cutLengthMm ?? 0) / 1000);
  const pierces = Math.max(0, input.geometry.contourCount ?? 0);
  const laserRubEach = input.operations.includes("laser-cutting")
    ? cutLengthM * cut.rubPerM + pierces * cut.pierceRub
    : 0;

  let operationsRubEach = 0;
  const r = basis.operationRates;
  if (input.operations.includes("bending")) operationsRubEach += Math.max(0, input.bendCount ?? input.geometry.bendCount ?? 0) * r.bendRubEach;
  if (input.operations.includes("welding")) operationsRubEach += Math.max(0, input.weldLengthM ?? 0) * r.weldRubM;
  if (input.operations.includes("powder-coating")) operationsRubEach += areaM2 * (input.powderSides ?? 2) * r.powderRubM2;
  if (input.operations.includes("assembly")) operationsRubEach += Math.max(0, input.assemblyMinutes ?? 0) / 60 * r.assemblyRubHour;
  if (input.operations.includes("packaging")) operationsRubEach += r.packagingRubEach;

  const worksRubEach = laserRubEach + operationsRubEach;
  const engineeringRubEach = worksRubEach * basis.engineeringPctOfWorks / 100;
  const fixedAddRubEach = basis.fixedPartAddRub;
  const internalSubtotalRubEach = materialRubEach + worksRubEach + engineeringRubEach + fixedAddRubEach;
  const provisionalCommercialRubEach = internalSubtotalRubEach * basis.provisionalCommercialPct / 100;
  const unitRub = internalSubtotalRubEach + provisionalCommercialRubEach;

  const warnings: string[] = [];
  if (!input.marketPrice.exactThickness) warnings.push("Цена металла выбрана по ближайшей толщине прайса.");
  if (!(input.geometry.volumeMm3 && input.geometry.volumeMm3 > 0)) warnings.push("Масса рассчитана по габаритному прямоугольнику; после nesting цена металла будет уточнена.");
  if (input.operations.includes("welding") && !(input.weldLengthM && input.weldLengthM > 0)) warnings.push("Сварка включена, но длина шва не определена.");

  return {
    materialMarketRubPerTon: input.marketPrice.rubPerTon,
    materialPricedRubPerTon,
    netMassKg,
    purchasedMassKg,
    materialRubEach,
    laserRubEach,
    operationsRubEach,
    engineeringRubEach,
    fixedAddRubEach,
    internalSubtotalRubEach,
    provisionalCommercialRubEach,
    unitRub,
    totalRub: unitRub * quantity,
    warnings,
  };
}
