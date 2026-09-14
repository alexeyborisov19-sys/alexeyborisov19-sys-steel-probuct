import type { PartGeometrySummary } from "@/lib/instant-quote/domain";

export type MaterialAllocationBasis = "nested" | "rectangular-blank" | "bounding-box";

export type MaterialAllocation = {
  basis: MaterialAllocationBasis;
  netAreaMm2: number;
  billedAreaMm2: number;
  wasteAreaMm2: number;
  wastePctOfBilled: number | null;
};

export function resolveMaterialAllocation(geometry: PartGeometrySummary): MaterialAllocation {
  const bboxAreaMm2 = Math.max(0, (geometry.widthMm ?? 0) * (geometry.heightMm ?? 0));
  const netAreaMm2 = Math.max(0, geometry.areaMm2 ?? bboxAreaMm2);

  let basis: MaterialAllocationBasis = "bounding-box";
  let billedAreaMm2 = bboxAreaMm2;

  if (geometry.nestedAllocatedAreaMm2 && geometry.nestedAllocatedAreaMm2 > 0) {
    basis = "nested";
    billedAreaMm2 = geometry.nestedAllocatedAreaMm2;
  } else if (geometry.blankAreaMm2 && geometry.blankAreaMm2 > 0) {
    basis = "rectangular-blank";
    billedAreaMm2 = geometry.blankAreaMm2;
  }

  // Never allow an allocated purchasing area smaller than the finished part area.
  billedAreaMm2 = Math.max(netAreaMm2, billedAreaMm2);
  const wasteAreaMm2 = Math.max(0, billedAreaMm2 - netAreaMm2);
  const wastePctOfBilled = billedAreaMm2 > 0 && geometry.areaMm2 && geometry.areaMm2 > 0
    ? wasteAreaMm2 / billedAreaMm2 * 100
    : null;

  return {
    basis,
    netAreaMm2,
    billedAreaMm2,
    wasteAreaMm2,
    wastePctOfBilled,
  };
}
