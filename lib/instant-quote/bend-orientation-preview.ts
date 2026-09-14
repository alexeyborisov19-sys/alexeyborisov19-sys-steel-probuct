import type { BendUnfoldPlan } from "@/lib/instant-quote/bend-unfold-plan";
import type { Vector3 } from "@/lib/instant-quote/sheet-metal";
import type { BRepPanelRegionEvidence } from "@/lib/instant-quote/unfold-geometry";

export type Matrix3 = [number, number, number, number, number, number, number, number, number];

export type RigidTransform3 = {
  rotation: Matrix3;
  translation: Vector3;
};

export type FlattenedPanelOrientation = {
  panelId: string;
  transformedCenterMm: Vector3;
  transformedNormal: Vector3;
  transform: RigidTransform3;
};

export type BendOrientationPreview = {
  source: "brep-rigid-rotation";
  displayOnly: true;
  commercialSpacingApplied: false;
  status: "ready" | "blocked";
  rootPanelId?: string;
  panels: FlattenedPanelOrientation[];
  errors: string[];
};

const IDENTITY: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function add(a: Vector3, b: Vector3): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(a: Vector3, factor: number): Vector3 {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
}

function dot(a: Vector3, b: Vector3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(a: Vector3): Vector3 | null {
  const magnitude = Math.hypot(a[0], a[1], a[2]);
  if (!(magnitude > 1e-9) || !Number.isFinite(magnitude)) return null;
  return scale(a, 1 / magnitude);
}

function multiplyMatrixVector(matrix: Matrix3, vector: Vector3): Vector3 {
  return [
    matrix[0] * vector[0] + matrix[1] * vector[1] + matrix[2] * vector[2],
    matrix[3] * vector[0] + matrix[4] * vector[1] + matrix[5] * vector[2],
    matrix[6] * vector[0] + matrix[7] * vector[1] + matrix[8] * vector[2],
  ];
}

function multiplyMatrices(left: Matrix3, right: Matrix3): Matrix3 {
  const result = Array.from({ length: 9 }, () => 0);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      result[row * 3 + column] =
        left[row * 3] * right[column]
        + left[row * 3 + 1] * right[3 + column]
        + left[row * 3 + 2] * right[6 + column];
    }
  }
  return result as Matrix3;
}

function applyTransform(transform: RigidTransform3, point: Vector3): Vector3 {
  return add(multiplyMatrixVector(transform.rotation, point), transform.translation);
}

function compose(left: RigidTransform3, right: RigidTransform3): RigidTransform3 {
  return {
    rotation: multiplyMatrices(left.rotation, right.rotation),
    translation: add(multiplyMatrixVector(left.rotation, right.translation), left.translation),
  };
}

function rotationAroundAxis(axis: Vector3, angleRad: number): Matrix3 {
  const [x, y, z] = axis;
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const oneMinusC = 1 - c;
  return [
    c + x * x * oneMinusC,
    x * y * oneMinusC - z * s,
    x * z * oneMinusC + y * s,
    y * x * oneMinusC + z * s,
    c + y * y * oneMinusC,
    y * z * oneMinusC - x * s,
    z * x * oneMinusC - y * s,
    z * y * oneMinusC + x * s,
    c + z * z * oneMinusC,
  ];
}

function rotationAroundLine(startMm: Vector3, endMm: Vector3, angleRad: number): RigidTransform3 | null {
  const axis = normalize(subtract(endMm, startMm));
  if (!axis) return null;
  const rotation = rotationAroundAxis(axis, angleRad);
  return {
    rotation,
    translation: subtract(startMm, multiplyMatrixVector(rotation, startMm)),
  };
}

function angleBetween(a: Vector3, b: Vector3) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return null;
  return Math.acos(Math.max(-1, Math.min(1, dot(left, right))));
}

function signedRotationToAlign(child: Vector3, parent: Vector3, axis: Vector3) {
  const childNormal = normalize(child);
  const parentNormal = normalize(parent);
  const axisNormal = normalize(axis);
  if (!childNormal || !parentNormal || !axisNormal) return null;
  return Math.atan2(dot(axisNormal, cross(childNormal, parentNormal)), dot(childNormal, parentNormal));
}

/**
 * Rotates panel coordinate frames into one common plane using exact BRep bend
 * axes. This preview intentionally applies no bend allowance, setback, neutral
 * axis translation or laser boundary construction. It cannot be priced.
 */
export function buildBendOrientationPreview(input: {
  plan: BendUnfoldPlan;
  panels: BRepPanelRegionEvidence[];
}): BendOrientationPreview {
  const { plan, panels } = input;
  if (plan.status !== "ready" || !plan.rootFaceId) {
    return {
      source: "brep-rigid-rotation",
      displayOnly: true,
      commercialSpacingApplied: false,
      status: "blocked",
      rootPanelId: plan.rootFaceId,
      panels: [],
      errors: plan.errors.length ? [...plan.errors] : ["Orientation preview requires a ready bend-unfold plan."],
    };
  }

  const panelById = new Map(panels.map((panel) => [panel.id, panel]));
  const root = panelById.get(plan.rootFaceId);
  if (!root) {
    return {
      source: "brep-rigid-rotation",
      displayOnly: true,
      commercialSpacingApplied: false,
      status: "blocked",
      rootPanelId: plan.rootFaceId,
      panels: [],
      errors: [`Root panel ${plan.rootFaceId} is missing from BRep panel evidence.`],
    };
  }

  const transforms = new Map<string, RigidTransform3>();
  transforms.set(root.id, { rotation: IDENTITY, translation: [0, 0, 0] });
  const errors: string[] = [];

  for (const step of plan.steps) {
    const parent = panelById.get(step.parentFaceId);
    const child = panelById.get(step.childFaceId);
    const parentTransform = transforms.get(step.parentFaceId);
    if (!parent || !child || !parentTransform) {
      errors.push(`Missing parent/child BRep panel geometry for bend ${step.bendId}.`);
      continue;
    }

    const transformedParentNormal = normalize(multiplyMatrixVector(parentTransform.rotation, parent.normal));
    const transformedChildNormal = normalize(multiplyMatrixVector(parentTransform.rotation, child.normal));
    const transformedAxisStart = applyTransform(parentTransform, step.axisStartMm);
    const transformedAxisEnd = applyTransform(parentTransform, step.axisEndMm);
    const transformedAxis = normalize(subtract(transformedAxisEnd, transformedAxisStart));
    if (!transformedParentNormal || !transformedChildNormal || !transformedAxis) {
      errors.push(`Bend ${step.bendId} has unusable transformed panel normals or axis.`);
      continue;
    }

    const geometricAngle = angleBetween(transformedChildNormal, transformedParentNormal);
    const signedAngle = signedRotationToAlign(transformedChildNormal, transformedParentNormal, transformedAxis);
    if (geometricAngle == null || signedAngle == null) {
      errors.push(`Bend ${step.bendId} does not have a finite geometric panel angle.`);
      continue;
    }

    const geometricAngleDeg = geometricAngle * 180 / Math.PI;
    const angleToleranceDeg = Math.max(0.5, step.angleDeg * 0.01);
    if (Math.abs(geometricAngleDeg - step.angleDeg) > angleToleranceDeg) {
      errors.push(`Bend ${step.bendId} BRep panel angle ${geometricAngleDeg.toFixed(3)}° does not agree with detected bend angle ${step.angleDeg}°.`);
      continue;
    }

    const localRotation = rotationAroundLine(transformedAxisStart, transformedAxisEnd, signedAngle);
    if (!localRotation) {
      errors.push(`Bend ${step.bendId} has a zero-length transformed axis.`);
      continue;
    }

    const childTransform = compose(localRotation, parentTransform);
    const flattenedNormal = normalize(multiplyMatrixVector(childTransform.rotation, child.normal));
    if (!flattenedNormal || Math.abs(dot(flattenedNormal, transformedParentNormal)) < 0.999999) {
      errors.push(`Bend ${step.bendId} failed the post-rotation coplanarity check.`);
      continue;
    }
    transforms.set(child.id, childTransform);
  }

  if (errors.length || transforms.size !== plan.panelOrder.length) {
    return {
      source: "brep-rigid-rotation",
      displayOnly: true,
      commercialSpacingApplied: false,
      status: "blocked",
      rootPanelId: plan.rootFaceId,
      panels: [],
      errors: errors.length ? errors : ["Orientation traversal did not cover every planned panel."],
    };
  }

  return {
    source: "brep-rigid-rotation",
    displayOnly: true,
    commercialSpacingApplied: false,
    status: "ready",
    rootPanelId: plan.rootFaceId,
    panels: plan.panelOrder.map((panelId) => {
      const panel = panelById.get(panelId)!;
      const transform = transforms.get(panelId)!;
      return {
        panelId,
        transformedCenterMm: applyTransform(transform, panel.centerMm),
        transformedNormal: normalize(multiplyMatrixVector(transform.rotation, panel.normal))!,
        transform,
      };
    }),
    errors: [],
  };
}
