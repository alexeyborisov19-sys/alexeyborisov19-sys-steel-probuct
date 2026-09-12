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
};

export type MetalCassetteEstimate = {
  netAreaM2: number;
  quantity: number;
  columns: number | null;
  rows: number | null;
  moduleWidthMm: number;
  moduleHeightMm: number;
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

function roundMoney(value: number) {
  return Math.round(value);
}

function positive(value: number | undefined, fallback = 0) {
  return Number.isFinite(value) && (value ?? 0) > 0 ? Number(value) : fallback;
}

function nonNegative(value: number | undefined) {
  return Number.isFinite(value) && (value ?? 0) > 0 ? Number(value) : 0;
}

function budgetRate(type: MetalCassetteType, thickness: MetalCassetteThickness) {
  const openRate = OPEN_RATE_RUB_M2[thickness];
  return type === "closed" ? roundMoney(openRate * CLOSED_TYPE_RATE_FACTOR) : openRate;
}

function moduleFor(type: MetalCassetteType) {
  // Open type: visible rust is between neighbouring cassettes, therefore the
  // standard architectural pitch is face + rust in both directions.
  if (type === "open") {
    return {
      widthMm: STANDARD.faceWidthMm + STANDARD.rustMm,
      heightMm: STANDARD.faceHeightMm + STANDARD.rustMm,
    };
  }

  // Closed type: the horizontal joint is formed by the lock. The row pitch is
  // the working height; adding a second 20 mm rust vertically would count the
  // lock zone twice. The transverse pitch still includes the visible joint.
  return {
    widthMm: STANDARD.faceWidthMm + STANDARD.rustMm,
    heightMm: STANDARD.faceHeightMm,
  };
}

function quantityByArea(areaM2: number, type: MetalCassetteType) {
  const module = moduleFor(type);
  const moduleAreaM2 = (module.widthMm * module.heightMm) / 1_000_000;
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
  const module = moduleFor(input.type);
  const rate = budgetRate(input.type, input.thickness);

  if (input.mode === "wall") {
    const widthMm = positive(input.wallWidthMm);
    const heightMm = positive(input.wallHeightMm);
    const grossAreaM2 = (widthMm * heightMm) / 1_000_000;
    const openingsM2 = Math.min(nonNegative(input.openingsM2), grossAreaM2);
    const netAreaM2 = Math.max(0, grossAreaM2 - openingsM2);
    const { columns, rows } = gridByWall(widthMm, heightMm, input.type);
    const grossQuantity = columns * rows;

    // Position and dimensions of openings are unknown in a simple public form.
    // Scale the gross grid only as a preliminary estimate; exact cutting around
    // openings is checked from the facade layout/project.
    const quantity = grossAreaM2 > 0 && netAreaM2 > 0
      ? Math.max(1, Math.ceil(grossQuantity * (netAreaM2 / grossAreaM2)))
      : 0;

    return {
      netAreaM2,
      quantity,
      columns,
      rows,
      moduleWidthMm: module.widthMm,
      moduleHeightMm: module.heightMm,
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
    moduleWidthMm: module.widthMm,
    moduleHeightMm: module.heightMm,
    approximateRateRubM2: rate,
    approximateTotalRub: roundMoney(netAreaM2 * rate),
  };
}
