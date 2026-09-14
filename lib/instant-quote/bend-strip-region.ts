import type {
  BendAllowanceSpacingPreview,
  BendSpacingStep2D,
  Vector2,
} from "@/lib/instant-quote/bend-spacing-preview";

export type BendStripRegion2D = {
  bendId: string;
  parentPanelId: string;
  childPanelId: string;
  cornersMm: [Vector2, Vector2, Vector2, Vector2];
  bendLengthMm: number;
  bendAllowanceMm: number;
  areaMm2: number;
  axialEndpointErrorMm: number;
};

export type BendStripRegionCandidate = {
  source: "approved-bend-allowance-strip";
  displayOnly: true;
  productionAuthoritative: false;
  status: "ready" | "blocked";
  rootPanelId?: string;
  strips: BendStripRegion2D[];
  errors: string[];
};

const PARALLEL_DOT = 0.999999;
const NUMERIC_ENDPOINT_TOLERANCE_MM = 0.05;

function subtract(a: Vector2, b: Vector2): Vector2 {
  return [a[0] - b[0], a[1] - b[1]];
}

function dot(a: Vector2, b: Vector2) {
  return a[0] * b[0] + a[1] * b[1];
}

function cross(a: Vector2, b: Vector2) {
  return a[0] * b[1] - a[1] * b[0];
}

function length(a: Vector2) {
  return Math.hypot(a[0], a[1]);
}

function normalize(a: Vector2): Vector2 | null {
  const magnitude = length(a);
  if (!(magnitude > 1e-9) || !Number.isFinite(magnitude)) return null;
  return [a[0] / magnitude, a[1] / magnitude];
}

function lineGap(
  parent: [Vector2, Vector2],
  child: [Vector2, Vector2],
  direction: Vector2,
) {
  const normal: Vector2 = [-direction[1], direction[0]];
  const startGap = dot(subtract(child[0], parent[0]), normal);
  const endGap = dot(subtract(child[1], parent[1]), normal);
  return { startGap, endGap };
}

function buildStrip(step: BendSpacingStep2D): { strip?: BendStripRegion2D; error?: string } {
  const parent = step.parentTangentMm;
  const child = step.childTangentAfterMm;
  const parentVector = subtract(parent[1], parent[0]);
  const childVector = subtract(child[1], child[0]);
  const parentDirection = normalize(parentVector);
  const childDirection = normalize(childVector);
  if (!parentDirection || !childDirection) return { error: `Bend ${step.bendId} has a zero-length tangency segment.` };
  if (dot(parentDirection, childDirection) < PARALLEL_DOT) {
    return { error: `Bend ${step.bendId} tangency segments are not direction-aligned after spacing.` };
  }

  const parentLength = length(parentVector);
  const childLength = length(childVector);
  const lengthError = Math.abs(parentLength - childLength);
  const startAxialError = Math.abs(dot(subtract(child[0], parent[0]), parentDirection));
  const endAxialError = Math.abs(dot(subtract(child[1], parent[1]), parentDirection));
  const axialEndpointErrorMm = Math.max(lengthError, startAxialError, endAxialError);
  if (axialEndpointErrorMm > NUMERIC_ENDPOINT_TOLERANCE_MM) {
    return { error: `Bend ${step.bendId} tangency endpoints do not align along the bend axis.` };
  }

  const { startGap, endGap } = lineGap(parent, child, parentDirection);
  const gapTolerance = Math.max(0.02, step.bendAllowanceMm * 0.002);
  if (Math.sign(startGap) !== Math.sign(endGap)
    || Math.abs(Math.abs(startGap) - step.bendAllowanceMm) > gapTolerance
    || Math.abs(Math.abs(endGap) - step.bendAllowanceMm) > gapTolerance) {
    return { error: `Bend ${step.bendId} does not preserve the approved allowance at both strip endpoints.` };
  }

  const cornersMm: [Vector2, Vector2, Vector2, Vector2] = [
    parent[0],
    parent[1],
    child[1],
    child[0],
  ];
  const polygonTwiceArea = cornersMm.reduce((sum, point, index) => {
    const next = cornersMm[(index + 1) % cornersMm.length];
    return sum + cross(point, next);
  }, 0);
  const polygonAreaMm2 = Math.abs(polygonTwiceArea) / 2;
  const expectedAreaMm2 = parentLength * step.bendAllowanceMm;
  const areaTolerance = Math.max(0.05, expectedAreaMm2 * 0.001);
  if (!Number.isFinite(polygonAreaMm2) || Math.abs(polygonAreaMm2 - expectedAreaMm2) > areaTolerance) {
    return { error: `Bend ${step.bendId} strip polygon area does not agree with bend length × approved allowance.` };
  }

  return {
    strip: {
      bendId: step.bendId,
      parentPanelId: step.parentPanelId,
      childPanelId: step.childPanelId,
      cornersMm,
      bendLengthMm: parentLength,
      bendAllowanceMm: step.bendAllowanceMm,
      areaMm2: polygonAreaMm2,
      axialEndpointErrorMm,
    },
  };
}

/**
 * Builds the explicit material band that must occupy the approved bend allowance
 * between two already-spaced BRep tangency lines. This is still evidence only:
 * it does not boolean-union strips with panel regions and cannot feed pricing or
 * CAM until an exact production flat contour is reconstructed and audited.
 */
export function buildBendStripRegionCandidate(
  spacing: BendAllowanceSpacingPreview,
): BendStripRegionCandidate {
  if (spacing.status !== "ready" || !spacing.rootPanelId || !spacing.commercialSpacingApplied) {
    return {
      source: "approved-bend-allowance-strip",
      displayOnly: true,
      productionAuthoritative: false,
      status: "blocked",
      rootPanelId: spacing.rootPanelId,
      strips: [],
      errors: spacing.errors.length ? [...spacing.errors] : ["Bend strips require a ready approved-allowance spacing preview."],
    };
  }

  const strips: BendStripRegion2D[] = [];
  const errors: string[] = [];
  for (const bend of spacing.bends) {
    const result = buildStrip(bend);
    if (result.strip) strips.push(result.strip);
    else errors.push(result.error ?? `Bend ${bend.bendId} strip could not be reconstructed.`);
  }

  if (errors.length || strips.length !== spacing.bends.length) {
    return {
      source: "approved-bend-allowance-strip",
      displayOnly: true,
      productionAuthoritative: false,
      status: "blocked",
      rootPanelId: spacing.rootPanelId,
      strips: [],
      errors: errors.length ? errors : ["Bend strip reconstruction did not cover every spaced bend."],
    };
  }

  return {
    source: "approved-bend-allowance-strip",
    displayOnly: true,
    productionAuthoritative: false,
    status: "ready",
    rootPanelId: spacing.rootPanelId,
    strips,
    errors: [],
  };
}
