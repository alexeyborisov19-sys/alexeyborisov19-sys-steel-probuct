import type { PartGeometrySummary } from "@/lib/instant-quote/domain";

export type ManualRectangularPartInput = {
  widthMm: number;
  heightMm: number;
  /**
   * A bend a customer names in text ("гнутый кронштейн") is not something
   * width × height can price: the true flat-pattern development depends on
   * bend radius, sweep and material spring-back, exactly the geometry the
   * CAD/STEP pipeline exists to measure from a real model. This path prices
   * genuinely flat parts only; anything with a stated bend is declined here,
   * never approximated.
   */
  bendCount?: number;
};

export type ManualGeometryResult =
  | { status: "priced"; geometry: PartGeometrySummary }
  | { status: "needs-cad"; reason: string };

/**
 * Builds calculator #1's geometry input for a plain flat rectangular part
 * described in words instead of a CAD file — "кронштейн 500×400". This is
 * the same commercial rule the DXF adapter already applies to an uploaded
 * rectangle (material billed by the bounding rectangle around the part,
 * `lib/instant-quote/dxf-adapter.ts`'s `blankAreaMm2 = widthMm * heightMm`),
 * applied to a manually-stated size instead of a CAD-measured one. No new
 * coefficient is introduced; the same formula in `factual-calculation.ts`
 * and `blanking.ts` runs unmodified on whichever geometry it receives.
 *
 * Pierce and contour counts follow the real DXF parser's own definition
 * (`lib/instant-quote/dxf.ts`: a pierce is one closed contour, not one raw
 * line segment) — an unholed rectangle is one contour and one pierce, not
 * zero: the laser still has to start the cut somewhere.
 */
export function buildManualRectangularGeometry(input: ManualRectangularPartInput): ManualGeometryResult {
  if (!(input.widthMm > 0) || !(input.heightMm > 0)) {
    return {
      status: "needs-cad",
      reason: "Габариты детали не заданы или некорректны — нужны положительные значения ширины и высоты.",
    };
  }

  if (input.bendCount != null && input.bendCount > 0) {
    return {
      status: "needs-cad",
      reason: "Деталь с гибами: точную развёртку по одним габаритам построить нельзя. "
        + "Нужен чертёж (DXF) или 3D-модель (STEP), либо расчёт передаётся технологу вручную.",
    };
  }

  const blankAreaMm2 = input.widthMm * input.heightMm;
  const cutLengthMm = 2 * (input.widthMm + input.heightMm);

  return {
    status: "priced",
    geometry: {
      widthMm: input.widthMm,
      heightMm: input.heightMm,
      areaMm2: blankAreaMm2,
      blankAreaMm2,
      cutLengthMm,
      contourCount: 1,
      pierceCount: 1,
      holeCount: 0,
      bendCount: 0,
    },
  };
}
