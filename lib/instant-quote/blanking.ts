import type { PartGeometrySummary } from "@/lib/instant-quote/domain";

export type BlankStrategy = "bounding-rectangle" | "sheet-nesting";

export type BlankPlan = {
  strategy: BlankStrategy;
  widthMm: number;
  heightMm: number;
  areaMm2: number;
  allowancePerSideMm: number;
  netAreaMm2: number | null;
  wastePct: number | null;
};

export function calculateBoundingRectangleBlank(
  geometry: PartGeometrySummary,
  allowancePerSideMm = 0,
): BlankPlan {
  const widthMm = Math.max(0, geometry.widthMm ?? 0) + Math.max(0, allowancePerSideMm) * 2;
  const heightMm = Math.max(0, geometry.heightMm ?? 0) + Math.max(0, allowancePerSideMm) * 2;
  const areaMm2 = widthMm * heightMm;
  const netAreaMm2 = geometry.areaMm2 && geometry.areaMm2 > 0 ? geometry.areaMm2 : null;
  const wastePct = netAreaMm2 != null && areaMm2 > 0
    ? Math.max(0, (areaMm2 - netAreaMm2) / areaMm2 * 100)
    : null;

  return {
    strategy: "bounding-rectangle",
    widthMm,
    heightMm,
    areaMm2,
    allowancePerSideMm: Math.max(0, allowancePerSideMm),
    netAreaMm2,
    wastePct,
  };
}
