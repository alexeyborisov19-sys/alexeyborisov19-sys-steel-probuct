import type {
  BendOrientationPreview,
  Matrix3,
  RigidTransform3,
} from "@/lib/instant-quote/bend-orientation-preview";
import type { Vector3 } from "@/lib/instant-quote/sheet-metal";
import type { BRepPanelRegionEvidence } from "@/lib/instant-quote/unfold-geometry";

export type FlatBoundaryEdge2D = {
  id: string;
  curveKind: string;
  pointsMm: Array<[number, number]>;
};

export type FlatBoundaryWire2D = {
  id: string;
  edges: FlatBoundaryEdge2D[];
};

export type FlatPanelBoundary2D = {
  panelId: string;
  wires: FlatBoundaryWire2D[];
};

export type BendBoundaryPreview2D = {
  source: "brep-rigid-rotation";
  displayOnly: true;
  commercialSpacingApplied: false;
  status: "ready" | "blocked";
  rootPanelId?: string;
  panels: FlatPanelBoundary2D[];
  errors: string[];
};

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

function applyTransform(transform: RigidTransform3, point: Vector3): Vector3 {
  return add(multiplyMatrixVector(transform.rotation, point), transform.translation);
}

function planeBasis(normal: Vector3): { u: Vector3; v: Vector3 } | null {
  const n = normalize(normal);
  if (!n) return null;
  const seed: Vector3 = Math.abs(n[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
  const u = normalize(subtract(seed, scale(n, dot(seed, n))));
  if (!u) return null;
  const v = normalize(cross(n, u));
  if (!v) return null;
  return { u, v };
}

/**
 * Projects already-rotated display-only BRep skin boundaries into one 2D frame.
 * It deliberately ignores normal-direction offsets between the chosen skin and
 * the panel mid-surface. No bend allowance, bend deduction, setback or neutral
 * axis spacing is applied, so this object must never feed pricing or CAM.
 */
export function buildBendBoundaryPreview2D(input: {
  orientation: BendOrientationPreview;
  panels: BRepPanelRegionEvidence[];
}): BendBoundaryPreview2D {
  const { orientation, panels } = input;
  if (orientation.status !== "ready" || !orientation.rootPanelId) {
    return {
      source: "brep-rigid-rotation",
      displayOnly: true,
      commercialSpacingApplied: false,
      status: "blocked",
      rootPanelId: orientation.rootPanelId,
      panels: [],
      errors: orientation.errors.length ? [...orientation.errors] : ["Boundary preview requires a ready orientation preview."],
    };
  }

  const sourceByPanel = new Map(panels.map((panel) => [panel.id, panel]));
  const orientationByPanel = new Map(orientation.panels.map((panel) => [panel.panelId, panel]));
  const rootOrientation = orientationByPanel.get(orientation.rootPanelId);
  const rootSource = sourceByPanel.get(orientation.rootPanelId);
  if (!rootOrientation || !rootSource) {
    return {
      source: "brep-rigid-rotation",
      displayOnly: true,
      commercialSpacingApplied: false,
      status: "blocked",
      rootPanelId: orientation.rootPanelId,
      panels: [],
      errors: ["Root panel is missing from boundary or orientation evidence."],
    };
  }

  const basis = planeBasis(rootOrientation.transformedNormal);
  if (!basis) {
    return {
      source: "brep-rigid-rotation",
      displayOnly: true,
      commercialSpacingApplied: false,
      status: "blocked",
      rootPanelId: orientation.rootPanelId,
      panels: [],
      errors: ["Cannot construct a stable 2D basis for the root panel."],
    };
  }

  const origin = rootOrientation.transformedCenterMm;
  const output: FlatPanelBoundary2D[] = [];
  const errors: string[] = [];

  for (const orientedPanel of orientation.panels) {
    const source = sourceByPanel.get(orientedPanel.panelId);
    if (!source?.boundary3d) {
      errors.push(`Panel ${orientedPanel.panelId} has no display-only BRep skin boundary.`);
      continue;
    }

    const wires: FlatBoundaryWire2D[] = [];
    for (const wire of source.boundary3d.wires) {
      const edges: FlatBoundaryEdge2D[] = [];
      for (const edge of wire.edges) {
        const pointsMm: Array<[number, number]> = [];
        for (const point of edge.pointsMm) {
          const transformed = applyTransform(orientedPanel.transform, point);
          const relative = subtract(transformed, origin);
          const u = dot(relative, basis.u);
          const v = dot(relative, basis.v);
          if (!Number.isFinite(u) || !Number.isFinite(v)) {
            errors.push(`Panel ${orientedPanel.panelId} contains a non-finite transformed BRep boundary point.`);
            break;
          }
          pointsMm.push([u, v]);
        }
        if (pointsMm.length !== edge.pointsMm.length || pointsMm.length < 2) continue;
        edges.push({ id: edge.id, curveKind: edge.curveKind, pointsMm });
      }
      if (edges.length !== wire.edges.length || !edges.length) {
        errors.push(`Panel ${orientedPanel.panelId} contains an incomplete transformed BRep wire.`);
        continue;
      }
      wires.push({ id: wire.id, edges });
    }

    if (wires.length !== source.boundary3d.wires.length || !wires.length) {
      errors.push(`Panel ${orientedPanel.panelId} does not have a complete projected BRep boundary.`);
      continue;
    }
    output.push({ panelId: orientedPanel.panelId, wires });
  }

  if (errors.length || output.length !== orientation.panels.length) {
    return {
      source: "brep-rigid-rotation",
      displayOnly: true,
      commercialSpacingApplied: false,
      status: "blocked",
      rootPanelId: orientation.rootPanelId,
      panels: [],
      errors: errors.length ? errors : ["Projected BRep boundaries do not cover every flattened panel."],
    };
  }

  return {
    source: "brep-rigid-rotation",
    displayOnly: true,
    commercialSpacingApplied: false,
    status: "ready",
    rootPanelId: orientation.rootPanelId,
    panels: output,
    errors: [],
  };
}
