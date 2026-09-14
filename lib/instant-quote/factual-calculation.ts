import type { ManufacturingOperation, PartGeometrySummary } from "@/lib/instant-quote/domain";
import { resolveMaterialStockPlan, type BlankStrategy } from "@/lib/instant-quote/blanking";
import type { MaterialId, MaterialMarketPrice } from "@/lib/instant-quote/pricing";

export type FactualRateSource = {
  id: string;
  label: string;
  confirmedAt: string;
  note: string;
};

export type FactualCalculationLineCode =
  | "material"
  | "laser-cutting"
  | "bending"
  | "welding"
  | "powder-coating";

export type FactualCalculationLine = {
  code: FactualCalculationLineCode;
  label: string;
  quantity: number;
  unit: string;
  rateRub: number;
  amountRubEach: number;
  amountRubBatch: number;
  source: FactualRateSource;
};

export type FactualCalculationMissingCode =
  | "material-price"
  | "material-price-stale"
  | "material-thickness-price"
  | "laser-rate"
  | "laser-pierce-policy"
  | "bend-count"
  | "weld-length"
  | "powder-area"
  | "operation-rate"
  | "geometry";

export type FactualCalculationMissing = {
  code: FactualCalculationMissingCode;
  label: string;
  reason: string;
  blocking: boolean;
};

export type FactualCalculationInput = {
  materialId: MaterialId;
  thicknessMm: number;
  quantity: number;
  geometry: PartGeometrySummary;
  marketPrice: MaterialMarketPrice | null;
  materialPriceSourceId?: string | null;
  materialPriceStale?: boolean;
  operations: ManufacturingOperation[];
  bendCount?: number;
  weldLengthM?: number;
  powderAreaM2?: number;
};

export type FactualCalculationResult = {
  kind: "factual-direct-cost";
  status: "complete" | "partial" | "blocked";
  currency: "RUB";
  quantity: number;
  materialId: MaterialId;
  thicknessMm: number;
  materialAllocationStrategy: BlankStrategy | null;
  parameters: {
    netAreaMm2: number | null;
    blankAreaMm2: number | null;
    netMassKgEach: number | null;
    purchasedMassKgEach: number | null;
    cutLengthMmEach: number;
    pierceCountEach: number;
    bendCountEach: number | null;
    weldLengthMEach: number | null;
    powderAreaM2Each: number | null;
  };
  lines: FactualCalculationLine[];
  confirmedDirectCostRubEach: number;
  confirmedDirectCostRubBatch: number;
  missing: FactualCalculationMissing[];
  warnings: string[];
  commercialPriceReady: false;
};

const PRICING_BASIS_SOURCE: FactualRateSource = {
  id: "steelprodukt-pricing-basis-2026-09-13",
  label: "SteelProdukt Pricing Basis 2026-09-13",
  confirmedAt: "2026-09-13",
  note: "Подтверждённая внутренняя база ставок; без автоматической наценки, overhead и setup.",
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

const CONFIRMED_BEND_RUB_EACH = 25;
const CONFIRMED_WELD_RUB_M = 1800;
const CONFIRMED_POWDER_RUB_M2 = 450;

/**
 * Only the currently confirmed 1.0 mm carbon-steel laser rate is authoritative.
 * Legacy Alpha tables remain outside this engine until each row is approved.
 */
function confirmedLaserRubPerM(materialId: MaterialId, thicknessMm: number) {
  if ((materialId === "cold" || materialId === "hot") && Math.abs(thicknessMm - 1) < 0.01) return 50;
  return null;
}

function positiveFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function nonNegativeFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addLine(
  lines: FactualCalculationLine[],
  input: Omit<FactualCalculationLine, "amountRubEach" | "amountRubBatch"> & { quantityBatch: number },
) {
  const amountRubEach = roundMoney(input.quantity * input.rateRub);
  lines.push({
    code: input.code,
    label: input.label,
    quantity: input.quantity,
    unit: input.unit,
    rateRub: input.rateRub,
    amountRubEach,
    amountRubBatch: roundMoney(amountRubEach * input.quantityBatch),
    source: input.source,
  });
}

/**
 * Calculates only cost articles for which both the physical parameter and the
 * production rate are confirmed. Unknown rates/inputs are returned explicitly
 * in `missing`; they are never replaced with Alpha defaults or hidden markups.
 *
 * This is a direct production-cost subtotal, not a sale price. Commercial
 * markup, overhead, engineering percentage, setup fees and payment logic are
 * intentionally outside this engine until separately approved.
 */
export function calculateFactualProductionCost(input: FactualCalculationInput): FactualCalculationResult {
  const quantity = Math.max(1, Math.floor(Number.isFinite(input.quantity) ? input.quantity : 1));
  const missing: FactualCalculationMissing[] = [];
  const warnings: string[] = [];
  const lines: FactualCalculationLine[] = [];

  if (!positiveFinite(input.thicknessMm)) {
    missing.push({ code: "geometry", label: "Толщина", reason: "Не подтверждена положительная толщина материала.", blocking: true });
  }

  let blank: ReturnType<typeof resolveMaterialStockPlan> | null = null;
  try {
    blank = resolveMaterialStockPlan(input.geometry);
  } catch {
    missing.push({ code: "geometry", label: "Заготовка", reason: "Геометрия не позволяет определить фактическую расчётную заготовку.", blocking: true });
  }

  const density = MATERIAL_DENSITY_KG_M3[input.materialId];
  const netAreaMm2 = blank ? (blank.netAreaMm2 ?? blank.areaMm2) : null;
  const thicknessM = positiveFinite(input.thicknessMm) ? input.thicknessMm / 1000 : null;
  const netMassKgEach = netAreaMm2 != null && thicknessM != null
    ? netAreaMm2 / 1_000_000 * thicknessM * density
    : null;
  const purchasedMassKgEach = blank && thicknessM != null
    ? blank.areaMm2 / 1_000_000 * thicknessM * density
    : null;

  if (!input.marketPrice) {
    missing.push({ code: "material-price", label: "Металл", reason: "Нет подтверждённой закупочной цены поставщика.", blocking: false });
  } else if (input.materialPriceStale) {
    missing.push({ code: "material-price-stale", label: "Металл", reason: "Последний подтверждённый прайс поставщика устарел и должен быть обновлён.", blocking: false });
  } else if (!input.marketPrice.exactThickness || Math.abs(input.marketPrice.thicknessMm - input.thicknessMm) >= 0.01) {
    missing.push({
      code: "material-thickness-price",
      label: "Металл",
      reason: `Нет точной подтверждённой цены для толщины ${input.thicknessMm} мм; ближайшую толщину фактической ценой не считаем.`,
      blocking: false,
    });
  } else if (purchasedMassKgEach != null) {
    const batchMassKg = purchasedMassKgEach * quantity;
    const rubPerTon = batchMassKg >= 3000 && positiveFinite(input.marketPrice.rubPerTonFrom3t)
      ? input.marketPrice.rubPerTonFrom3t
      : input.marketPrice.rubPerTon;
    if (positiveFinite(rubPerTon)) {
      addLine(lines, {
        code: "material",
        label: "Металл по расчётной заготовке",
        quantity: purchasedMassKgEach,
        unit: "кг/шт",
        rateRub: rubPerTon / 1000,
        quantityBatch: quantity,
        source: {
          id: input.materialPriceSourceId ?? input.marketPrice.source,
          label: input.marketPrice.source,
          confirmedAt: input.marketPrice.sourceDate,
          note: `Официальный прайс поставщика, ${input.marketPrice.thicknessMm} мм. Без автоматической 5% надбавки.`,
        },
      });
    } else {
      missing.push({ code: "material-price", label: "Металл", reason: "Цена поставщика некорректна.", blocking: false });
    }
  }

  const cutLengthMmEach = Math.max(0, input.geometry.cutLengthMm ?? 0);
  const pierceCountEach = Math.max(0, input.geometry.pierceCount ?? input.geometry.contourCount ?? 0);
  if (input.operations.includes("laser-cutting")) {
    const laserRate = confirmedLaserRubPerM(input.materialId, input.thicknessMm);
    if (laserRate == null) {
      missing.push({
        code: "laser-rate",
        label: "Лазерная резка",
        reason: `Для ${input.materialId}, ${input.thicknessMm} мм пока нет утверждённой ставки в фактическом контуре.`,
        blocking: false,
      });
    } else if (cutLengthMmEach <= 0) {
      missing.push({ code: "geometry", label: "Длина реза", reason: "CAD не дал положительную длину траектории реза.", blocking: false });
    } else {
      addLine(lines, {
        code: "laser-cutting",
        label: "Лазерная резка",
        quantity: cutLengthMmEach / 1000,
        unit: "м/шт",
        rateRub: laserRate,
        quantityBatch: quantity,
        source: PRICING_BASIS_SOURCE,
      });
    }
    if (pierceCountEach > 0) {
      missing.push({
        code: "laser-pierce-policy",
        label: "Пробивки лазера",
        reason: `CAD определил ${pierceCountEach} пробивок на деталь, но отдельная фактическая ставка/правило включения пробивки пока не утверждены.`,
        blocking: false,
      });
    }
  }

  const bendCountEach = nonNegativeFinite(input.bendCount)
    ? input.bendCount
    : nonNegativeFinite(input.geometry.bendCount)
      ? input.geometry.bendCount
      : null;
  if (input.operations.includes("bending")) {
    if (bendCountEach == null) {
      missing.push({ code: "bend-count", label: "Гибка", reason: "Количество гибов не подтверждено геометрией или технологом.", blocking: false });
    } else {
      addLine(lines, {
        code: "bending",
        label: "Гибка",
        quantity: bendCountEach,
        unit: "гиб/шт",
        rateRub: CONFIRMED_BEND_RUB_EACH,
        quantityBatch: quantity,
        source: PRICING_BASIS_SOURCE,
      });
    }
  }

  const weldLengthMEach = positiveFinite(input.weldLengthM) ? input.weldLengthM : null;
  if (input.operations.includes("welding")) {
    if (weldLengthMEach == null) {
      missing.push({ code: "weld-length", label: "Сварка", reason: "Нужна фактическая длина сварного шва на деталь.", blocking: false });
    } else {
      addLine(lines, {
        code: "welding",
        label: "Сварка",
        quantity: weldLengthMEach,
        unit: "м/шт",
        rateRub: CONFIRMED_WELD_RUB_M,
        quantityBatch: quantity,
        source: PRICING_BASIS_SOURCE,
      });
    }
  }

  const powderAreaM2Each = positiveFinite(input.powderAreaM2) ? input.powderAreaM2 : null;
  if (input.operations.includes("powder-coating")) {
    if (powderAreaM2Each == null) {
      missing.push({
        code: "powder-area",
        label: "Порошковая окраска",
        reason: "Нужна фактическая окрашиваемая площадь; количество сторон автоматически не предполагаем.",
        blocking: false,
      });
    } else {
      addLine(lines, {
        code: "powder-coating",
        label: "Порошковая окраска",
        quantity: powderAreaM2Each,
        unit: "м²/шт",
        rateRub: CONFIRMED_POWDER_RUB_M2,
        quantityBatch: quantity,
        source: PRICING_BASIS_SOURCE,
      });
    }
  }

  const unpricedOperations: Array<{ operation: ManufacturingOperation; label: string }> = [
    { operation: "assembly", label: "Сборка" },
    { operation: "surface-preparation", label: "Подготовка поверхности" },
    { operation: "packaging", label: "Упаковка" },
    { operation: "threading", label: "Нарезание резьбы" },
    { operation: "countersink", label: "Зенковка" },
  ];
  for (const item of unpricedOperations) {
    if (input.operations.includes(item.operation)) {
      missing.push({
        code: "operation-rate",
        label: item.label,
        reason: "Для этой операции нет утверждённого фактического норматива в текущем расчётном контуре.",
        blocking: false,
      });
    }
  }

  if (blank?.strategy === "bounding-rectangle") {
    warnings.push("Металл рассчитан по прямоугольной заготовке вокруг детали. После production nesting расход металла может быть уточнён.");
  }
  if (blank && blank.netAreaMm2 == null) {
    warnings.push("Чистая площадь не подтверждена замкнутым контуром; нетто-масса использует площадь расчётной заготовки.");
  }

  const confirmedDirectCostRubEach = roundMoney(lines.reduce((sum, line) => sum + line.amountRubEach, 0));
  const confirmedDirectCostRubBatch = roundMoney(lines.reduce((sum, line) => sum + line.amountRubBatch, 0));
  const blocked = missing.some((item) => item.blocking);

  return {
    kind: "factual-direct-cost",
    status: blocked ? "blocked" : missing.length ? "partial" : "complete",
    currency: "RUB",
    quantity,
    materialId: input.materialId,
    thicknessMm: input.thicknessMm,
    materialAllocationStrategy: blank?.strategy ?? null,
    parameters: {
      netAreaMm2,
      blankAreaMm2: blank?.areaMm2 ?? null,
      netMassKgEach,
      purchasedMassKgEach,
      cutLengthMmEach,
      pierceCountEach,
      bendCountEach,
      weldLengthMEach,
      powderAreaM2Each,
    },
    lines,
    confirmedDirectCostRubEach,
    confirmedDirectCostRubBatch,
    missing,
    warnings,
    commercialPriceReady: false,
  };
}
