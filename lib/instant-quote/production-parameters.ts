import type { PartGeometrySummary } from "@/lib/instant-quote/domain";
import { resolveMaterialStockPlan, type BlankStrategy } from "@/lib/instant-quote/blanking";
import type { MaterialId } from "@/lib/instant-quote/pricing";

export type ProductionParameterInput = {
  materialId: MaterialId;
  thicknessMm: number;
  quantity: number;
  geometry: PartGeometrySummary;
  weldLengthMEach?: number;
  powderSides?: 1 | 2;
  explicitPowderAreaM2Each?: number;
};

export type ProductionParameterSummary = {
  status: "ready" | "partial" | "blocked";
  materialId: MaterialId;
  thicknessMm: number;
  quantity: number;
  densityKgM3: number;
  dimensionsMm: {
    width: number | null;
    height: number | null;
    depth: number | null;
  };
  stock: {
    strategy: BlankStrategy | null;
    blankWidthMm: number | null;
    blankHeightMm: number | null;
    blankAreaMm2: number | null;
    nestedAllocatedAreaMm2: number | null;
    netAreaMm2: number | null;
    wasteAreaMm2Each: number | null;
    wastePct: number | null;
  };
  mass: {
    netKgEach: number | null;
    netKgBatch: number | null;
    purchasedKgEach: number | null;
    purchasedKgBatch: number | null;
  };
  cutting: {
    cutLengthMmEach: number | null;
    cutLengthMBatch: number | null;
    contourCountEach: number | null;
    contourCountBatch: number | null;
    pierceCountEach: number | null;
    pierceCountBatch: number | null;
    holeCountEach: number | null;
    holeCountBatch: number | null;
  };
  bending: {
    bendCountEach: number | null;
    bendCountBatch: number | null;
  };
  welding: {
    weldLengthMEach: number | null;
    weldLengthMBatch: number | null;
  };
  coating: {
    powderSides: 1 | 2 | null;
    powderAreaM2Each: number | null;
    powderAreaM2Batch: number | null;
  };
  issues: string[];
};

const MATERIAL_DENSITY_KG_M3: Record<MaterialId, number> = {
  cold: 7800,
  hot: 7800,
  zinc: 7800,
  inox: 7900,
  alu: 2700,
  copper: 8900,
  brass: 8500,
};

function positive(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : null;
}

function nonNegative(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : null;
}

function times(value: number | null, factor: number) {
  return value == null ? null : value * factor;
}

/**
 * Derives physical production parameters without applying any tariff or markup.
 * These values are suitable for explaining and validating the cost calculation.
 */
export function deriveProductionParameters(input: ProductionParameterInput): ProductionParameterSummary {
  const quantity = Math.max(1, Math.floor(Number.isFinite(input.quantity) ? input.quantity : 1));
  const issues: string[] = [];
  const thicknessMm = positive(input.thicknessMm);
  if (thicknessMm == null) issues.push("Не подтверждена толщина материала.");

  const width = positive(input.geometry.widthMm);
  const height = positive(input.geometry.heightMm);
  const depth = positive(input.geometry.depthMm);
  if (width == null || height == null) issues.push("Не подтверждены габариты X×Y.");

  const blank = width != null && height != null ? resolveMaterialStockPlan(input.geometry) : null;
  if (!blank || !(blank.areaMm2 > 0)) issues.push("Не удалось определить площадь расчётной заготовки.");

  const densityKgM3 = MATERIAL_DENSITY_KG_M3[input.materialId];
  const thicknessM = thicknessMm == null ? null : thicknessMm / 1000;
  const netAreaMm2 = blank ? (blank.netAreaMm2 ?? null) : null;
  const netMassFromVolume = positive(input.geometry.volumeMm3) != null
    ? input.geometry.volumeMm3! / 1_000_000_000 * densityKgM3
    : null;
  const netMassFromArea = netAreaMm2 != null && thicknessM != null
    ? netAreaMm2 / 1_000_000 * thicknessM * densityKgM3
    : null;
  const netKgEach = netMassFromVolume ?? netMassFromArea;
  const purchasedKgEach = blank && thicknessM != null
    ? blank.areaMm2 / 1_000_000 * thicknessM * densityKgM3
    : null;

  if (netKgEach == null) issues.push("Нет достаточных данных для нетто-массы детали.");

  const cutLengthMmEach = nonNegative(input.geometry.cutLengthMm);
  const contourCountEach = nonNegative(input.geometry.contourCount);
  const pierceCountEach = nonNegative(input.geometry.pierceCount ?? input.geometry.contourCount);
  const holeCountEach = nonNegative(input.geometry.holeCount);
  const bendCountEach = nonNegative(input.geometry.bendCount);

  const weldLengthMEach = positive(input.weldLengthMEach);
  const powderSides = input.powderSides ?? null;
  const explicitPowderArea = positive(input.explicitPowderAreaM2Each);
  const derivedPowderArea = powderSides && netAreaMm2 != null
    ? netAreaMm2 / 1_000_000 * powderSides
    : null;
  const powderAreaM2Each = explicitPowderArea ?? derivedPowderArea;

  const wasteAreaMm2Each = blank && netAreaMm2 != null
    ? Math.max(0, blank.areaMm2 - netAreaMm2)
    : null;

  const blocking = thicknessMm == null || width == null || height == null || !blank || !(blank.areaMm2 > 0);
  const partial = !blocking && (netKgEach == null || cutLengthMmEach == null);

  return {
    status: blocking ? "blocked" : partial ? "partial" : "ready",
    materialId: input.materialId,
    thicknessMm: input.thicknessMm,
    quantity,
    densityKgM3,
    dimensionsMm: { width, height, depth },
    stock: {
      strategy: blank?.strategy ?? null,
      blankWidthMm: blank?.widthMm ?? null,
      blankHeightMm: blank?.heightMm ?? null,
      blankAreaMm2: blank?.areaMm2 ?? null,
      nestedAllocatedAreaMm2: positive(input.geometry.nestedAllocatedAreaMm2),
      netAreaMm2,
      wasteAreaMm2Each,
      wastePct: blank?.wastePct ?? null,
    },
    mass: {
      netKgEach,
      netKgBatch: times(netKgEach, quantity),
      purchasedKgEach,
      purchasedKgBatch: times(purchasedKgEach, quantity),
    },
    cutting: {
      cutLengthMmEach,
      cutLengthMBatch: cutLengthMmEach == null ? null : cutLengthMmEach / 1000 * quantity,
      contourCountEach,
      contourCountBatch: times(contourCountEach, quantity),
      pierceCountEach,
      pierceCountBatch: times(pierceCountEach, quantity),
      holeCountEach,
      holeCountBatch: times(holeCountEach, quantity),
    },
    bending: {
      bendCountEach,
      bendCountBatch: times(bendCountEach, quantity),
    },
    welding: {
      weldLengthMEach,
      weldLengthMBatch: times(weldLengthMEach, quantity),
    },
    coating: {
      powderSides,
      powderAreaM2Each,
      powderAreaM2Batch: times(powderAreaM2Each, quantity),
    },
    issues,
  };
}
