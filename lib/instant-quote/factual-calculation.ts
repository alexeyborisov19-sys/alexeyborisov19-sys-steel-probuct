import { estimateThinLaserRate } from './laser-rate-estimate';
import type { ManufacturingOperation, PartGeometrySummary } from "@/lib/instant-quote/domain";
import { resolveMaterialStockPlan, type BlankStrategy } from "@/lib/instant-quote/blanking";
import { applyMetalUplift, type MaterialId, type MaterialMarketPrice } from "@/lib/instant-quote/pricing";

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
  /** Optional confidential series tiers. Base `rateRub` is used below 100 m. */
  from100mRubPerM?: number;
  from500mRubPerM?: number;
  /** Optional confidential charge for one actual laser pierce. */
  pierceRubEach?: number;
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
  countersinkRubEach?: FactualRate | null;
  powderRubPerM2: FactualRate | null;
  assemblyRubPerHour?: FactualRate | null;
  surfacePreparationRubPerM2?: FactualRate | null;
  packagingRubEach?: FactualRate | null;
};

export type FactualCalculationLineCode =
  | "material"
  | "laser-cutting"
  | "laser-piercing"
  | "bending"
  | "welding"
  | "countersink"
  | "powder-coating"
  | "assembly"
  | "surface-preparation"
  | "packaging";

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
  | "countersink-count"
  | "powder-area"
  | "assembly-time"
  | "surface-preparation-area"
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
  /** Owner-authorized last-known exact-material price, strictly estimate-only. */
  allowStaleMaterialEstimate?: boolean;
  /**
   * Owner-approved percentage added on top of the supplier's metal price.
   * It stays an explicit caller input so the engine keeps its rule of never
   * applying an uplift the caller did not ask for. Omitted means 0 %.
   */
  materialMarketUpliftPct?: number;
  operations: ManufacturingOperation[];
  rateBook: FactualRateBook;
  bendCount?: number;
  weldLengthM?: number;
  countersinkCount?: number;
  powderAreaM2?: number;
  assemblyMinutes?: number;
  surfacePreparationAreaM2?: number;
};

export type FactualCalculationResult = {
  kind: "factual-direct-cost";
  status: "complete" | "partial" | "blocked";
  currency: "RUB";
  quantity: number;
  materialId: MaterialId;
  thicknessMm: number;
  /** True only for explicitly estimated tariffs; manufacturing approval prohibited. */
  estimatedRateUsed?: boolean;
  staleMaterialPriceUsed?: {sourceDate:string};
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
    countersinkCountEach?: number | null;
    powderAreaM2Each: number | null;
    assemblyMinutesEach: number | null;
    surfacePreparationAreaM2Each: number | null;
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

function effectiveLaserRubPerM(rate: LaserFactualRate, totalBatchCutM: number) {
  if (totalBatchCutM >= 500 && positiveFinite(rate.from500mRubPerM)) return rate.from500mRubPerM;
  if (totalBatchCutM >= 100 && positiveFinite(rate.from100mRubPerM)) return rate.from100mRubPerM;
  return rate.rateRub;
}

function addLine(
  lines: FactualCalculationLine[],
  input: Omit<FactualCalculationLine, "amountRubEach" | "amountRubBatch"> & { quantityBatch: number },
) {
  // The batch is rounded from the exact product, not from the rounded piece.
  // Rounding twice pushed up to half a kopeck per piece into every unit of the
  // batch, so a run of a thousand drifted by several roubles on each line and
  // the batch stopped matching the price it was built from.
  const exactRubEach = input.quantity * input.rateRub;
  lines.push({
    code: input.code,
    label: input.label,
    quantity: input.quantity,
    unit: input.unit,
    rateRub: input.rateRub,
    amountRubEach: roundMoney(exactRubEach),
    amountRubBatch: roundMoney(exactRubEach * input.quantityBatch),
    source: input.source,
  });
}

/** Saved supplier dates may be calendar dates or canonical UTC timestamps.
 * Reject rollover dates and dates newer than the recorded fetch; never rewrite
 * the private source field merely to format a public warning. */
function supplierDateTime(value:unknown):number|null {
  if(typeof value!=="string")return null;
  const time=Date.parse(value);if(!Number.isFinite(time))return null;
  const canonical=new Date(time).toISOString();
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return canonical.slice(0,10)===value?time:null;
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))return canonical===(value.includes(".")?value:value.replace("Z",".000Z"))?time:null;
  return null;
}

/**
 * Internal factual engine. It returns direct-cost details and production
 * parameters intended only for protected server-side reporting.
 *
 * Unknown rates/inputs are explicit in `missing`; the engine never imports a
 * public fallback tariff, nearest thickness, hidden markup, overhead, setup or
 * commercial uplift. The owner-authorized 0.7 mm extrapolation is the sole
 * explicit exception and is marked estimatedRateUsed for estimate-only review.
 */
export function calculateFactualProductionCost(input: FactualCalculationInput): FactualCalculationResult {
  const quantity = Math.max(1, Math.floor(Number.isFinite(input.quantity) ? input.quantity : 1));
  const missing: FactualCalculationMissing[] = [];
  const warnings: string[] = [];
  const lines: FactualCalculationLine[] = [];
  let estimatedRateUsed = false;
  let staleMaterialPriceUsed: FactualCalculationResult["staleMaterialPriceUsed"];

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

  const sourceTime=supplierDateTime(input.marketPrice?.sourceDate), fetchedTime=supplierDateTime(input.marketPrice?.fetchedAt);
  const staleEstimateAllowed=input.allowStaleMaterialEstimate===true && input.marketPrice?.materialId===input.materialId
    && sourceTime!==null && fetchedTime!==null && sourceTime<=fetchedTime;
  if (!input.marketPrice) {
    missing.push({ code: "material-price", label: "Металл", reason: "Нет подтверждённой закупочной цены поставщика.", blocking: false });
  } else if (input.materialPriceStale && !staleEstimateAllowed) {
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
      if(input.materialPriceStale){
        staleMaterialPriceUsed={sourceDate:input.marketPrice.sourceDate};
        warnings.push(`Использована последняя сохранённая цена металла от ${input.marketPrice.sourceDate}. Прайс устарел; это только ориентировочная оценка до подтверждения закупочной цены.`);
      }
      const upliftPct = positiveFinite(input.materialMarketUpliftPct) ? input.materialMarketUpliftPct : 0;
      const pricedRubPerTon = applyMetalUplift(rubPerTon, upliftPct);
      addLine(lines, {
        code: "material",
        label: "Металл по расчётной заготовке",
        quantity: purchasedMassKgEach,
        unit: "кг/шт",
        rateRub: pricedRubPerTon / 1000,
        quantityBatch: quantity,
        source: {
          id: input.materialPriceSourceId ?? input.marketPrice.source,
          label: input.marketPrice.source,
          confirmedAt: input.marketPrice.sourceDate,
          note: upliftPct > 0
            ? `Закрытый прайс поставщика, ${input.marketPrice.thicknessMm} мм: ${rubPerTon} ₽/т + ${upliftPct} % = ${Math.round(pricedRubPerTon)} ₽/т.`
            : `Закрытый прайс поставщика, ${input.marketPrice.thicknessMm} мм.`,
        },
      });
    } else {
      missing.push({ code: "material-price", label: "Металл", reason: "Цена поставщика некорректна.", blocking: false });
    }
  }

  const cutLengthMmEach = Math.max(0, input.geometry.cutLengthMm ?? 0);
  const cutLengthMEach = cutLengthMmEach / 1000;
  const totalBatchCutM = cutLengthMEach * quantity;
  const pierceCountEach = Math.max(0, input.geometry.pierceCount ?? input.geometry.contourCount ?? 0);
  if (input.operations.includes("laser-cutting")) {
    const exactRate = exactLaserRate(input.rateBook, input.materialId, input.thicknessMm);
    const laserRate = exactRate ?? estimateThinLaserRate(input.rateBook, input.materialId, input.thicknessMm);
    estimatedRateUsed = !exactRate && laserRate !== null;
    if (estimatedRateUsed) warnings.push("Ставка резки 0,7 мм рассчитана по соседним толщинам 0,8 и 1,0 мм. Это предварительная оценка, требующая подтверждения технологом.");
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
        quantity: cutLengthMEach,
        unit: "м/шт",
        rateRub: effectiveLaserRubPerM(laserRate, totalBatchCutM),
        quantityBatch: quantity,
        source: laserRate.source,
      });
    }

    if (pierceCountEach > 0 && laserRate) {
      if (positiveFinite(laserRate.pierceRubEach)) {
        addLine(lines, {
          code: "laser-piercing",
          label: "Прожиги лазера",
          quantity: pierceCountEach,
          unit: "прожиг/шт",
          rateRub: laserRate.pierceRubEach,
          quantityBatch: quantity,
          source: laserRate.source,
        });
      } else {
        missing.push({
          code: "laser-pierce-policy",
          label: "Пробивки лазера",
          reason: `CAD определил ${pierceCountEach} пробивок на деталь, но закрытая ставка прожига для этой толщины не утверждена.`,
          blocking: false,
        });
      }
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

  const countersinkCountEach=Number.isSafeInteger(input.countersinkCount) && (input.countersinkCount??0)>0 && input.countersinkCount!<=100000 ? input.countersinkCount! : null;
  if(input.operations.includes("countersink")){
    if(countersinkCountEach==null){
      missing.push({code:"countersink-count",label:"Зенковка",reason:"Укажите целое количество зенкуемых отверстий на деталь (1–100000).",blocking:false});
    }else if(!input.rateBook.countersinkRubEach || !positiveFinite(input.rateBook.countersinkRubEach.rateRub)){
      missing.push({code:"operation-rate",label:"Зенковка",reason:"Нет утверждённой закрытой ставки зенковки за отверстие.",blocking:false});
    }else{
      addLine(lines,{code:"countersink",label:"Зенковка",quantity:countersinkCountEach,unit:"отв./шт",rateRub:input.rateBook.countersinkRubEach.rateRub,quantityBatch:quantity,source:input.rateBook.countersinkRubEach.source});
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

  const assemblyMinutesEach = positiveFinite(input.assemblyMinutes) ? input.assemblyMinutes : null;
  if (input.operations.includes("assembly")) {
    if (assemblyMinutesEach == null) {
      missing.push({ code: "assembly-time", label: "Сборка", reason: "Нужно фактическое время сборки на изделие.", blocking: false });
    } else if (!input.rateBook.assemblyRubPerHour || !positiveFinite(input.rateBook.assemblyRubPerHour.rateRub)) {
      missing.push({ code: "operation-rate", label: "Сборка", reason: "Нет утверждённой закрытой ставки сборки.", blocking: false });
    } else {
      addLine(lines, {
        code: "assembly",
        label: "Сборка",
        quantity: assemblyMinutesEach / 60,
        unit: "ч/шт",
        rateRub: input.rateBook.assemblyRubPerHour.rateRub,
        quantityBatch: quantity,
        source: input.rateBook.assemblyRubPerHour.source,
      });
    }
  }

  const surfacePreparationAreaM2Each = positiveFinite(input.surfacePreparationAreaM2) ? input.surfacePreparationAreaM2 : null;
  if (input.operations.includes("surface-preparation")) {
    if (surfacePreparationAreaM2Each == null) {
      missing.push({ code: "surface-preparation-area", label: "Подготовка поверхности", reason: "Нужна фактическая площадь подготовки поверхности на изделие.", blocking: false });
    } else if (!input.rateBook.surfacePreparationRubPerM2 || !positiveFinite(input.rateBook.surfacePreparationRubPerM2.rateRub)) {
      missing.push({ code: "operation-rate", label: "Подготовка поверхности", reason: "Нет утверждённой закрытой ставки подготовки поверхности.", blocking: false });
    } else {
      addLine(lines, {
        code: "surface-preparation",
        label: "Подготовка поверхности",
        quantity: surfacePreparationAreaM2Each,
        unit: "м²/шт",
        rateRub: input.rateBook.surfacePreparationRubPerM2.rateRub,
        quantityBatch: quantity,
        source: input.rateBook.surfacePreparationRubPerM2.source,
      });
    }
  }

  if (input.operations.includes("packaging")) {
    if (!input.rateBook.packagingRubEach || !positiveFinite(input.rateBook.packagingRubEach.rateRub)) {
      missing.push({ code: "operation-rate", label: "Упаковка", reason: "Нет утверждённой закрытой ставки упаковки на изделие.", blocking: false });
    } else {
      addLine(lines, {
        code: "packaging",
        label: "Упаковка",
        quantity: 1,
        unit: "изделие/шт",
        rateRub: input.rateBook.packagingRubEach.rateRub,
        quantityBatch: quantity,
        source: input.rateBook.packagingRubEach.source,
      });
    }
  }

  const unpricedOperations: Array<{ operation: ManufacturingOperation; label: string }> = [
    { operation: "threading", label: "Нарезание резьбы" },
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
    ...(estimatedRateUsed ? { estimatedRateUsed: true } : {}),
    ...(staleMaterialPriceUsed ? {staleMaterialPriceUsed} : {}),
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
      countersinkCountEach,
      powderAreaM2Each,
      assemblyMinutesEach,
      surfacePreparationAreaM2Each,
    },
    lines,
    confirmedDirectCostRubEach,
    confirmedDirectCostRubBatch,
    missing,
    warnings,
    commercialPriceReady: false,
  };
}
