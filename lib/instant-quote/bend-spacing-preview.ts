import type {
  BendBoundaryPreview2D,
  FlatPanelBoundary2D,
} from "@/lib/instant-quote/bend-boundary-preview";
import type {
  BendOrientationPreview,
  Matrix3,
  RigidTransform3,
} from "@/lib/instant-quote/bend-orientation-preview";
import type { BendUnfoldPlan } from "@/lib/instant-quote/bend-unfold-plan";
import type { Vector3 } from "@/lib/instant-quote/sheet-metal";
import type {
  BRepBendGeometryEvidence,
  BRepPanelTangentSegment3D,
} from "@/lib/instant-quote/unfold-geometry";

export type Vector2 = [number, number];

export type BendSpacingStep2D = {
  bendId: string;
  parentPanelId: string;
  childPanelId: string;
  bendAllowanceMm: number;
  gapBeforeMm: number;
  gapAfterMm: number;
  childCorrectionMm: Vector2;
  parentTangentMm: [Vector2, Vector2];
  childTangentBeforeMm: [Vector2, Vector2];
  childTangentAfterMm: [Vector2, Vector2];
};

export type BendAllowanceSpacingPreview = {
  source: "approved-bend-allowance-spacing";
  displayOnly: true;
  productionAuthoritative: false;
  commercialSpacingApplied: boolean;
  status: "ready" | "blocked";
  rootPanelId?: string;
  panelTranslationsMm: Array<{ panelId: string; translationMm: Vector2 }>;
  bends: BendSpacingStep2D[];
  errors: string[];
};

export type SpacedBendBoundaryPreview2D = {
  source: "approved-bend-allowance-spacing";
  displayOnly: true;
  productionAuthoritative: false;
  commercialSpacingApplied: boolean;
  status: "ready" | "blocked";
  rootPanelId?: string;
  panels: FlatPanelBoundary2D[];
  bends: BendSpacingStep2D[];
  errors: string[];
};

const PARALLEL_DOT = 0.9995;
const AXIAL_OVERLAP_RATIO = 0.95;
const SIDE_EPSILON_MM = 0.05;

function add2(a: Vector2, b: Vector2): Vector2 {
  return [a[0] + b[0], a[1] + b[1]];
}

function subtract2(a: Vector2, b: Vector2): Vector2 {
  return [a[0] - b[0], a[1] - b[1]];
}

function scale2(a: Vector2, factor: number): Vector2 {
  return [a[0] * factor, a[1] * factor];
}

function dot2(a: Vector2, b: Vector2) {
  return a[0] * b[0] + a[1] * b[1];
}

function length2(a: Vector2) {
  return Math.hypot(a[0], a[1]);
}

function normalize2(a: Vector2): Vector2 | null {
  const magnitude = length2(a);
  if (!(magnitude > 1e-9) || !Number.isFinite(magnitude)) return null;
  return scale2(a, 1 / magnitude);
}

function midpoint2(a: Vector2, b: Vector2): Vector2 {
  return scale2(add2(a, b), 0.5);
}

function add3(a: Vector3, b: Vector3): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract3(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(a: Vector3, factor: number): Vector3 {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
}

function dot3(a: Vector3, b: Vector3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vector3, b: Vector3): Vector3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize3(a: Vector3): Vector3 | null {
  const magnitude = Math.hypot(a[0], a[1], a[2]);
  if (!(magnitude > 1e-9) || !Number.isFinite(magnitude)) return null;
  return scale3(a, 1 / magnitude);
}

function multiplyMatrixVector(matrix: Matrix3, vector: Vector3): Vector3 {
  return [
    matrix[0] * vector[0] + matrix[1] * vector[1] + matrix[2] * vector[2],
    matrix[3] * vector[0] + matrix[4] * vector[1] + matrix[5] * vector[2],
    matrix[6] * vector[0] + matrix[7] * vector[1] + matrix[8] * vector[2],
  ];
}

function applyTransform(transform: RigidTransform3, point: Vector3): Vector3 {
  return add3(multiplyMatrixVector(transform.rotation, point), transform.translation);
}

function planeBasis(normal: Vector3): { u: Vector3; v: Vector3 } | null {
  const n = normalize3(normal);
  if (!n) return null;
  const seed: Vector3 = Math.abs(n[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
  const u = normalize3(subtract3(seed, scale3(n, dot3(seed, n))));
  if (!u) return null;
  const v = normalize3(cross3(n, u));
  return v ? { u, v } : null;
}

function projectPoint(
  point: Vector3,
  transform: RigidTransform3,
  origin: Vector3,
  basis: { u: Vector3; v: Vector3 },
): Vector2 | null {
  const transformed = applyTransform(transform, point);
  const relative = subtract3(transformed, origin);
  const u = dot3(relative, basis.u);
  const v = dot3(relative, basis.v);
  return Number.isFinite(u) && Number.isFinite(v) ? [u, v] : null;
}

function projectTangent(
  tangent: BRepPanelTangentSegment3D,
  transform: RigidTransform3,
  origin: Vector3,
  basis: { u: Vector3; v: Vector3 },
): [Vector2, Vector2] | null {
  const start = projectPoint(tangent.startMm, transform, origin, basis);
  const end = projectPoint(tangent.endMm, transform, origin, basis);
  return start && end && length2(subtract2(end, start)) > 1e-8 ? [start, end] : null;
}

function alignLineDirection(
  reference: [Vector2, Vector2],
  candidate: [Vector2, Vector2],
): [Vector2, Vector2] | null {
  const referenceDirection = normalize2(subtract2(reference[1], reference[0]));
  const candidateDirection = normalize2(subtract2(candidate[1], candidate[0]));
  if (!referenceDirection || !candidateDirection) return null;
  const alignment = dot2(referenceDirection, candidateDirection);
  if (Math.abs(alignment) < PARALLEL_DOT) return null;
  return alignment >= 0 ? candidate : [candidate[1], candidate[0]];
}

function axialOverlapRatio(
  reference: [Vector2, Vector2],
  candidate: [Vector2, Vector2],
) {
  const direction = normalize2(subtract2(reference[1], reference[0]));
  if (!direction) return 0;
  const referenceLength = length2(subtract2(reference[1], reference[0]));
  const candidateLength = length2(subtract2(candidate[1], candidate[0]));
  if (!(referenceLength > 1e-8) || !(candidateLength > 1e-8)) return 0;

  const candidateA = dot2(subtract2(candidate[0], reference[0]), direction);
  const candidateB = dot2(subtract2(candidate[1], reference[0]), direction);
  const overlapStart = Math.max(0, Math.min(candidateA, candidateB));
  const overlapEnd = Math.min(referenceLength, Math.max(candidateA, candidateB));
  const overlap = Math.max(0, overlapEnd - overlapStart);
  return overlap / Math.min(referenceLength, candidateLength);
}

function translatedLine(line: [Vector2, Vector2], translation: Vector2): [Vector2, Vector2] {
  return [add2(line[0], translation), add2(line[1], translation)];
}

function blocked(rootPanelId: string | undefined, errors: string[]): BendAllowanceSpacingPreview {
  return {
    source: "approved-bend-allowance-spacing",
    displayOnly: true,
    productionAuthoritative: false,
    commercialSpacingApplied: false,
    status: "blocked",
    rootPanelId,
    panelTranslationsMm: [],
    bends: [],
    errors,
  };
}

/**
 * Converts the rigidly flattened panel tree into a spacing candidate using only
 * the exact approved bend allowance already resolved by BendUnfoldPlan and the
 * BRep tangency segments that bound the physical cylindrical bend zone.
 *
 * The result is still display/evidence only. It does not stitch one laser-ready
 * contour, classify holes, detect self-overlap or authorize pricing/CAM.
 */
export function buildBendAllowanceSpacingPreview(input: {
  plan: BendUnfoldPlan;
  orientation: BendOrientationPreview;
  bends: BRepBendGeometryEvidence[];
}): BendAllowanceSpacingPreview {
  const { plan, orientation, bends } = input;
  if (plan.status !== "ready" || !plan.rootFaceId) {
    return blocked(plan.rootFaceId, plan.errors.length ? [...plan.errors] : ["Bend spacing requires a ready unfold plan."]);
  }
  if (orientation.status !== "ready" || !orientation.rootPanelId || orientation.rootPanelId !== plan.rootFaceId) {
    return blocked(plan.rootFaceId, orientation.errors.length
      ? [...orientation.errors]
      : ["Bend spacing requires a ready orientation preview for the same root panel."]);
  }

  const orientationByPanel = new Map(orientation.panels.map((panel) => [panel.panelId, panel]));
  const root = orientationByPanel.get(plan.rootFaceId);
  if (!root) return blocked(plan.rootFaceId, ["Root panel orientation is missing."]);
  const basis = planeBasis(root.transformedNormal);
  if (!basis) return blocked(plan.rootFaceId, ["Cannot construct a stable root-plane basis for bend spacing."]);

  const origin = root.transformedCenterMm;
  const bendById = new Map(bends.map((bend) => [bend.bendId, bend]));
  const translations = new Map<string, Vector2>([[plan.rootFaceId, [0, 0]]]);
  const output: BendSpacingStep2D[] = [];
  const errors: string[] = [];

  for (const step of plan.steps) {
    const parentOrientation = orientationByPanel.get(step.parentFaceId);
    const childOrientation = orientationByPanel.get(step.childFaceId);
    const bend = bendById.get(step.bendId);
    const parentTranslation = translations.get(step.parentFaceId);
    if (!parentOrientation || !childOrientation || !parentTranslation || !bend) {
      errors.push(`Bend ${step.bendId} is missing orientation, parent spacing or BRep bend evidence.`);
      continue;
    }
    if (!bend.tangentSegments) {
      errors.push(`Bend ${step.bendId} has no paired BRep tangency segments.`);
      continue;
    }

    const parentTangent = bend.tangentSegments.find((segment) => segment.panelId === step.parentFaceId);
    const childTangent = bend.tangentSegments.find((segment) => segment.panelId === step.childFaceId);
    if (!parentTangent || !childTangent) {
      errors.push(`Bend ${step.bendId} tangency evidence does not match its planned parent and child panels.`);
      continue;
    }

    const parentLineRaw = projectTangent(parentTangent, parentOrientation.transform, origin, basis);
    const childLineRawUnaligned = projectTangent(childTangent, childOrientation.transform, origin, basis);
    if (!parentLineRaw || !childLineRawUnaligned) {
      errors.push(`Bend ${step.bendId} has non-projectable BRep tangency geometry.`);
      continue;
    }
    const childLineRaw = alignLineDirection(parentLineRaw, childLineRawUnaligned);
    if (!childLineRaw) {
      errors.push(`Bend ${step.bendId} flattened tangency lines are not parallel.`);
      continue;
    }
    if (axialOverlapRatio(parentLineRaw, childLineRaw) < AXIAL_OVERLAP_RATIO) {
      errors.push(`Bend ${step.bendId} flattened tangency lines do not overlap over the bend length.`);
      continue;
    }

    const childBaseTranslation = parentTranslation;
    const parentLine = translatedLine(parentLineRaw, parentTranslation);
    const childLineBefore = translatedLine(childLineRaw, childBaseTranslation);
    const parentCenter = add2(
      projectPoint(parentOrientation.transformedCenterMm, { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0] }, origin, basis) ?? [0, 0],
      parentTranslation,
    );
    const childCenterProjected = projectPoint(
      childOrientation.transformedCenterMm,
      { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0] },
      origin,
      basis,
    );
    if (!childCenterProjected) {
      errors.push(`Bend ${step.bendId} child panel center cannot be projected into the root plane.`);
      continue;
    }
    const childCenter = add2(childCenterProjected, childBaseTranslation);

    const tangentDirection = normalize2(subtract2(parentLine[1], parentLine[0]));
    if (!tangentDirection) {
      errors.push(`Bend ${step.bendId} has a zero-length flattened parent tangency line.`);
      continue;
    }
    const normal2: Vector2 = [-tangentDirection[1], tangentDirection[0]];
    const parentMid = midpoint2(parentLine[0], parentLine[1]);
    const childMid = midpoint2(childLineBefore[0], childLineBefore[1]);
    const parentInteriorSide = dot2(subtract2(parentCenter, parentMid), normal2);
    const childInteriorSide = dot2(subtract2(childCenter, childMid), normal2);
    if (Math.abs(parentInteriorSide) <= SIDE_EPSILON_MM || Math.abs(childInteriorSide) <= SIDE_EPSILON_MM) {
      errors.push(`Bend ${step.bendId} cannot prove which side of the tangency line contains each panel interior.`);
      continue;
    }
    if (Math.sign(parentInteriorSide) === Math.sign(childInteriorSide)) {
      errors.push(`Bend ${step.bendId} flattened panel interiors lie on the same side of the tangency line.`);
      continue;
    }

    const currentSignedGap = dot2(subtract2(childMid, parentMid), normal2);
    const targetSignedGap = Math.sign(childInteriorSide) * step.bendAllowanceMm;
    const correctionScalar = targetSignedGap - currentSignedGap;
    const correction = scale2(normal2, correctionScalar);
    const childTranslation = add2(childBaseTranslation, correction);
    translations.set(step.childFaceId, childTranslation);

    const childLineAfter = translatedLine(childLineRaw, childTranslation);
    const gapAfter = Math.abs(dot2(subtract2(midpoint2(childLineAfter[0], childLineAfter[1]), parentMid), normal2));
    const tolerance = Math.max(0.02, step.bendAllowanceMm * 0.002);
    if (!Number.isFinite(gapAfter) || Math.abs(gapAfter - step.bendAllowanceMm) > tolerance) {
      errors.push(`Bend ${step.bendId} failed the approved bend-allowance spacing check.`);
      translations.delete(step.childFaceId);
      continue;
    }

    output.push({
      bendId: step.bendId,
      parentPanelId: step.parentFaceId,
      childPanelId: step.childFaceId,
      bendAllowanceMm: step.bendAllowanceMm,
      gapBeforeMm: Math.abs(currentSignedGap),
      gapAfterMm: gapAfter,
      childCorrectionMm: correction,
      parentTangentMm: parentLine,
      childTangentBeforeMm: childLineBefore,
      childTangentAfterMm: childLineAfter,
    });
  }

  if (errors.length || translations.size !== plan.panelOrder.length || output.length !== plan.steps.length) {
    return blocked(plan.rootFaceId, errors.length ? errors : ["Bend spacing traversal did not cover every planned panel and bend."]);
  }

  return {
    source: "approved-bend-allowance-spacing",
    displayOnly: true,
    productionAuthoritative: false,
    commercialSpacingApplied: true,
    status: "ready",
    rootPanelId: plan.rootFaceId,
    panelTranslationsMm: plan.panelOrder.map((panelId) => ({ panelId, translationMm: translations.get(panelId)! })),
    bends: output,
    errors: [],
  };
}

export function applyBendAllowanceSpacingToBoundaryPreview(input: {
  boundary: BendBoundaryPreview2D;
  spacing: BendAllowanceSpacingPreview;
}): SpacedBendBoundaryPreview2D {
  const { boundary, spacing } = input;
  if (boundary.status !== "ready" || spacing.status !== "ready" || !spacing.rootPanelId) {
    return {
      source: "approved-bend-allowance-spacing",
      displayOnly: true,
      productionAuthoritative: false,
      commercialSpacingApplied: false,
      status: "blocked",
      rootPanelId: spacing.rootPanelId ?? boundary.rootPanelId,
      panels: [],
      bends: [],
      errors: [
        ...boundary.errors,
        ...spacing.errors,
        ...(boundary.status === "ready" && spacing.status === "ready" ? [] : ["Spaced boundary preview requires ready boundary and spacing evidence."]),
      ],
    };
  }

  const translationByPanel = new Map(spacing.panelTranslationsMm.map((item) => [item.panelId, item.translationMm]));
  const panels: FlatPanelBoundary2D[] = [];
  const errors: string[] = [];
  for (const panel of boundary.panels) {
    const translation = translationByPanel.get(panel.panelId);
    if (!translation) {
      errors.push(`No bend-spacing translation exists for panel ${panel.panelId}.`);
      continue;
    }
    panels.push({
      panelId: panel.panelId,
      wires: panel.wires.map((wire) => ({
        id: wire.id,
        edges: wire.edges.map((edge) => ({
          id: edge.id,
          curveKind: edge.curveKind,
          pointsMm: edge.pointsMm.map((point) => add2(point, translation)),
        })),
      })),
    });
  }

  if (errors.length || panels.length !== boundary.panels.length) {
    return {
      source: "approved-bend-allowance-spacing",
      displayOnly: true,
      productionAuthoritative: false,
      commercialSpacingApplied: false,
      status: "blocked",
      rootPanelId: spacing.rootPanelId,
      panels: [],
      bends: [],
      errors: errors.length ? errors : ["Spacing translations do not cover every projected panel boundary."],
    };
  }

  return {
    source: "approved-bend-allowance-spacing",
    displayOnly: true,
    productionAuthoritative: false,
    commercialSpacingApplied: true,
    status: "ready",
    rootPanelId: spacing.rootPanelId,
    panels,
    bends: spacing.bends,
    errors: [],
  };
}
