export const metalCassetteThicknesses = ["0.65", "0.7", "1.0", "1.2"] as const;

export type MetalCassetteThickness = (typeof metalCassetteThicknesses)[number];
export type MetalCassetteType = "open" | "closed";
export type MetalCassetteEstimateMode = "area" | "wall";

export type MetalCassetteEstimateInput = {
  mode: MetalCassetteEstimateMode;
  type: MetalCassetteType;
  thickness: MetalCassetteThickness;
  areaM2?: number;
  wallWidthMm?: number;
  wallHeightMm?: number;
  openingsM2?: number;
  pricePerM2?: number;
};

export type MetalCassetteEstimate = {
  netAreaM2: number;
  quantity: number;
  columns: number | null;
  rows: number | null;
  moduleWidthMm: number;
  moduleHeightMm: number;
  defaultRateRubM2: number;
  approximateRateRubM2: number;
  approximateTotalRub: number;
};

const STANDARD = {
  faceWidthMm: 1170,
  faceHeightMm: 545,
  rustMm: 20,
} as const;

/*
 * Public budget rates recovered from the previously published calculator:
 * 0.5 = 1627, 0.7 = 1764, 1.0 = 2074, 1.2 = 2300 RUB/m².
 * 0.65 replaces 0.5 in the current standard range and is interpolated between
 * the previously published 0.5 and 0.7 values: 1730 RUB/m² (rounded).
 *
 * The public calculator intentionally does not contain DXF/unfolding geometry.
 * Closed-type budget rates use the type ratio from the previously approved
 * internal commercial defaults (1815 / 1583) and are rounded to whole rubles.
 */
const OPEN_RATE_RUB_M2: Record<MetalCassetteThickness, number> = {
  "0.65": 1730,
  "0.7": 1764,
  "1.0": 2074,
  "1.2": 2300,
};

const CLOSED_TYPE_RATE_FACTOR = 1815 / 1583;

export function roundMoney(value: number) {
  return Math.round(value);
}

function positive(value: number | undefined, fallback = 0) {
  return Number.isFinite(value) && (value ?? 0) > 0 ? Number(value) : fallback;
}

function nonNegative(value: number | undefined) {
  return Number.isFinite(value) && (value ?? 0) > 0 ? Number(value) : 0;
}

export function getDefaultMetalCassetteRate(
  type: MetalCassetteType,
  thickness: MetalCassetteThickness,
) {
  const openRate = OPEN_RATE_RUB_M2[thickness];
  return type === "closed" ? roundMoney(openRate * CLOSED_TYPE_RATE_FACTOR) : openRate;
}

function moduleFor(type: MetalCassetteType) {
  if (type === "open") {
    return {
      widthMm: STANDARD.faceWidthMm + STANDARD.rustMm,
      heightMm: STANDARD.faceHeightMm + STANDARD.rustMm,
    };
  }

  return {
    widthMm: STANDARD.faceWidthMm + STANDARD.rustMm,
    heightMm: STANDARD.faceHeightMm,
  };
}

function quantityByArea(areaM2: number, type: MetalCassetteType) {
  const pitch = moduleFor(type);
  const moduleAreaM2 = (pitch.widthMm * pitch.heightMm) / 1_000_000;
  return Math.max(0, Math.ceil(areaM2 / moduleAreaM2));
}

function gridByWall(widthMm: number, heightMm: number, type: MetalCassetteType) {
  const columns = Math.max(
    0,
    Math.ceil((widthMm + STANDARD.rustMm) / (STANDARD.faceWidthMm + STANDARD.rustMm)),
  );

  const rows = type === "open"
    ? Math.max(
        0,
        Math.ceil((heightMm + STANDARD.rustMm) / (STANDARD.faceHeightMm + STANDARD.rustMm)),
      )
    : Math.max(0, Math.ceil(heightMm / STANDARD.faceHeightMm));

  return { columns, rows };
}

export function estimateMetalCassettes(input: MetalCassetteEstimateInput): MetalCassetteEstimate {
  const pitch = moduleFor(input.type);
  const defaultRate = getDefaultMetalCassetteRate(input.type, input.thickness);
  const rate = positive(input.pricePerM2, defaultRate);

  if (input.mode === "wall") {
    const widthMm = positive(input.wallWidthMm);
    const heightMm = positive(input.wallHeightMm);
    const grossAreaM2 = (widthMm * heightMm) / 1_000_000;
    const openingsM2 = Math.min(nonNegative(input.openingsM2), grossAreaM2);
    const netAreaM2 = Math.max(0, grossAreaM2 - openingsM2);
    const { columns, rows } = gridByWall(widthMm, heightMm, input.type);
    const grossQuantity = columns * rows;

    const quantity = grossAreaM2 > 0 && netAreaM2 > 0
      ? Math.max(1, Math.ceil(grossQuantity * (netAreaM2 / grossAreaM2)))
      : 0;

    return {
      netAreaM2,
      quantity,
      columns,
      rows,
      moduleWidthMm: pitch.widthMm,
      moduleHeightMm: pitch.heightMm,
      defaultRateRubM2: defaultRate,
      approximateRateRubM2: rate,
      approximateTotalRub: roundMoney(netAreaM2 * rate),
    };
  }

  const netAreaM2 = positive(input.areaM2);
  return {
    netAreaM2,
    quantity: quantityByArea(netAreaM2, input.type),
    columns: null,
    rows: null,
    moduleWidthMm: pitch.widthMm,
    moduleHeightMm: pitch.heightMm,
    defaultRateRubM2: defaultRate,
    approximateRateRubM2: rate,
    approximateTotalRub: roundMoney(netAreaM2 * rate),
  };
}

export type MetalCassetteQuantityEstimateInput = {
  type: MetalCassetteType;
  thickness: MetalCassetteThickness;
  /** How many cassettes the customer stated directly, e.g. "300 кассет". */
  quantity: number;
  /** The customer's own cassette face size — not the standard module pitch. */
  moduleWidthMm: number;
  moduleHeightMm: number;
  pricePerM2?: number;
};

/**
 * Prices a stated piece count against the customer's OWN cassette size, not
 * the fixed standard module (`STANDARD.faceWidthMm × faceHeightMm`) the
 * area/wall modes above assume. A customer very often gives exactly a
 * headcount plus a size — "300 кассет 600×1200" — and neither number is the
 * standard module. Substituting the standard module's area to make that fit
 * `estimateMetalCassettes`'s existing modes would price a size nobody
 * ordered; this instead applies the same published rate to the area the
 * customer's own numbers describe.
 *
 * Reuses the published rate table via `getDefaultMetalCassetteRate` and the
 * same whole-rouble rounding — nothing about the commercial rate changes,
 * only how the priced area is derived. `estimateMetalCassettes` and its two
 * existing modes are untouched by this function.
 */
export function estimateMetalCassettesByQuantity(
  input: MetalCassetteQuantityEstimateInput,
): MetalCassetteEstimate {
  const quantity = Math.max(0, Math.round(positive(input.quantity)));
  const moduleWidthMm = positive(input.moduleWidthMm);
  const moduleHeightMm = positive(input.moduleHeightMm);
  const netAreaM2 = (quantity * moduleWidthMm * moduleHeightMm) / 1_000_000;
  const defaultRate = getDefaultMetalCassetteRate(input.type, input.thickness);
  const rate = positive(input.pricePerM2, defaultRate);

  return {
    netAreaM2,
    quantity,
    columns: null,
    rows: null,
    moduleWidthMm,
    moduleHeightMm,
    defaultRateRubM2: defaultRate,
    approximateRateRubM2: rate,
    approximateTotalRub: roundMoney(netAreaM2 * rate),
  };
}
