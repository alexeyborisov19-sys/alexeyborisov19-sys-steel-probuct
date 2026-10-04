import type { BasketDesign } from "./basket-design";
import { emptyBasketFit, normalizedBasketFit } from "./basket-fit";

export type BasketWallKind = "wall" | "ventilated" | "unknown";
type MountingDesign = BasketDesign & { wallKind?: BasketWallKind };

function knownDistance(value: unknown, maximum: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum
    ? value
    : null;
}

/** Explicit selection wins. Legacy facade data can infer a kind, not a gap. */
export function basketWallKind(design: MountingDesign): BasketWallKind {
  if (design.wallKind !== undefined) {
    return design.wallKind === "wall" || design.wallKind === "ventilated"
      ? design.wallKind
      : "unknown";
  }
  const facade = knownDistance(design.facade, 2000);
  return facade === null ? "unknown" : facade === 0 ? "wall" : "ventilated";
}

/** Fit is authoritative once it exists. An explicitly unknown rear gap must
 * not be replaced with a possibly stale legacy offset, including after import.
 */
export function basketRearGap(design: MountingDesign): number | null {
  if (design.fit !== undefined) {
    if (!design.fit || typeof design.fit !== "object" || Array.isArray(design.fit)) return null;
    return knownDistance(design.fit.rear, 10000);
  }
  return knownDistance(design.offset, 10000);
}

/** Wall-to-block distance is a mounting dimension only. Facade thickness is
 * never added to the basket envelope, and does not establish bracket strength.
 */
export function basketMountingDimensions(design: MountingDesign) {
  const wallKind = basketWallKind(design);
  const facadeMm = wallKind === "wall" ? 0 : wallKind === "unknown" ? null : knownDistance(design.facade, 2000);
  const rearMm = basketRearGap(design);
  return {
    wallKind,
    facadeMm,
    rearMm,
    wallToBlockRearMm: facadeMm === null || rearMm === null ? null : facadeMm + rearMm,
  };
}

/** Synchronize the two representations without inventing a default gap or
 * silently creating a partial fit for the manual-basket workflow.
 */
export function setBasketRearGap(design: MountingDesign, value: number | null): MountingDesign {
  const rear = knownDistance(value, 10000);
  const updated = { ...design, offset: rear };
  if (design.fit && typeof design.fit === "object" && !Array.isArray(design.fit)) {
    return { ...updated, fit: { ...design.fit, rear } };
  }
  if (design.sizing === "block") return { ...updated, fit: { ...emptyBasketFit(), rear } };
  return updated;
}

/** Carry a previously entered mounting gap into first-time automatic sizing;
 * an existing fit's explicit null remains unknown. */
export function basketFitForSizing(design: BasketDesign, sizing: "block" | "basket") {
  return normalizedBasketFit(design.fit) ?? (sizing === "block"
    ? { ...emptyBasketFit(), rear: basketRearGap(design) }
    : undefined);
}

/** Changing the wall type only changes the facade layer. Installation sizes
 * and clearances remain the user's measured/manufacturer-confirmed values.
 */
export function setBasketWallKind(design: MountingDesign, kind: BasketWallKind): MountingDesign {
  const wallKind = kind === "wall" || kind === "ventilated" ? kind : "unknown";
  const facade = wallKind === "wall"
    ? 0
    : wallKind === "unknown" || basketWallKind(design) === "wall"
      ? null
      : design.facade;
  return { ...design, wallKind, facade };
}
