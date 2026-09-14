import type { ManufacturingOperation, PartGeometrySummary } from "@/lib/instant-quote/domain";
import { resolveMaterialStockPlan, type BlankStrategy } from "@/lib/instant-quote/blanking";
import type { MaterialId, MaterialMarketPrice } from "@/lib/instant-quote/pricing";

export type FactualRateSource = {
  id: string;
  label: string;
  confirmedAt: string;
  note: string;
};

export type FactualRate = {
  rateRub: number;
  source: FactualRateSource;
};

export type LaserFactualRate = FactualRate & {
  materialId: MaterialId;
  thicknessMm: number;
};

/**
 * Runtime-only rate book. Real values must be loaded from a protected server
 * source and must never be committed to the public repository or sent to a
 * client bundle/API response.
 */
export type FactualRateBook = {
  laserRubPerM: LaserFactualRate[];
  bendRubEach: FactualRate | null;
  weldRubPerM: FactualRate | null;
  powderRubPerM2: FactualRate | null;
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
  rateBook: FactualRateBook;
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

const MATERIAL_DENSITY_KG_M3: Record<MaterialId, number> = {
  cold: 7800,
  hot: 7800,
  zinc: 7800,
  inox: 7900,
  alu: 2700,
  copper: 8900,
  brass: 8500,
};

function positiveFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function nonNegativeFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function exactLaserRate(rateBook: FactualRateBook, materialId: MaterialId, thicknessMm: number) {
  return rateBook.laserRubPerM.find(
    (row) => row.materialId === materialId && Math.abs(row.thicknessMm - thicknessMm) < 0.01,
  ) ?? null;
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
 * Internal factual engine. It returns direct-cost details and production
 * parameters intended only for protected server-side reporting.
 *
 * Unknown rates/inputs are explicit in `missing`; the engine never imports a
 * public fallback tariff, nearest thickness, hidden markup, overhead, setup or
 * commercial uplift.
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
          note: `Закрытый прайс поставщика, ${input.marketPrice.thicknessMm} мм.`,
        },
      });
    } else {
      missing.push({ code: "material-price", label: "Металл", reason: "Цена поставщика некорректна.", blocking: false });
    }
  }

  const cutLengthMmEach = Math.max(0, input.geometry.cutLengthMm ?? 0);
  const pierceCountEach = Math.max(0, input.geometry.pierceCount ?? input.geometry.contourCount ?? 0);
  if (input.operations.includes("laser-cutting")) {
    const laserRate = exactLaserRate(input.rateBook, input.materialId, input.thicknessMm);
    if (!laserRate || !positiveFinite(laserRate.rateRub)) {
      missing.push({
        code: "laser-rate",
        label: "Лазерная резка",
        reason: `Для ${input.materialId}, ${input.thicknessMm} мм нет утверждённой закрытой ставки.`,
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
        rateRub: laserRate.rateRub,
        quantityBatch: quantity,
        source: laserRate.source,
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
    } else if (!input.rateBook.bendRubEach || !positiveFinite(input.rateBook.bendRubEach.rateRub)) {
      missing.push({ code: "operation-rate", label: "Гибка", reason: "Нет утверждённой закрытой ставки гибки.", blocking: false });
    } else {
      addLine(lines, {
        code: "bending",
        label: "Гибка",
        quantity: bendCountEach,
        unit: "гиб/шт",
        rateRub: input.rateBook.bendRubEach.rateRub,
        quantityBatch: quantity,
        source: input.rateBook.bendRubEach.source,
      });
    }
  }

  const weldLengthMEach = positiveFinite(input.weldLengthM) ? input.weldLengthM : null;
  if (input.operations.includes("welding")) {
    if (weldLengthMEach == null) {
      missing.push({ code: "weld-length", label: "Сварка", reason: "Нужна фактическая длина сварного шва на деталь.", blocking: false });
    } else if (!input.rateBook.weldRubPerM || !positiveFinite(input.rateBook.weldRubPerM.rateRub)) {
      missing.push({ code: "operation-rate", label: "Сварка", reason: "Нет утверждённой закрытой ставки сварки.", blocking: false });
    } else {
      addLine(lines, {
        code: "welding",
        label: "Сварка",
        quantity: weldLengthMEach,
        unit: "м/шт",
        rateRub: input.rateBook.weldRubPerM.rateRub,
        quantityBatch: quantity,
        source: input.rateBook.weldRubPerM.source,
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
    } else if (!input.rateBook.powderRubPerM2 || !positiveFinite(input.rateBook.powderRubPerM2.rateRub)) {
      missing.push({ code: "operation-rate", label: "Порошковая окраска", reason: "Нет утверждённой закрытой ставки окраски.", blocking: false });
    } else {
      addLine(lines, {
        code: "powder-coating",
        label: "Порошковая окраска",
        quantity: powderAreaM2Each,
        unit: "м²/шт",
        rateRub: input.rateBook.powderRubPerM2.rateRub,
        quantityBatch: quantity,
        source: input.rateBook.powderRubPerM2.source,
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
