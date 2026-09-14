import type { CadMeshPrimitive } from "@/lib/instant-quote/cad-model";

export type MeshView = {
  yaw: number;
  pitch: number;
  zoom: number;
};

export type ProjectedTriangle = {
  meshId: string;
  points: [[number, number], [number, number], [number, number]];
  depth: number;
  light: number;
};

type V3 = [number, number, number];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rotate([x, y, z]: V3, yaw: number, pitch: number): V3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x1 = cy * x + sy * z;
  const z1 = -sy * x + cy * z;
  return [x1, cp * y - sp * z1, sp * y + cp * z1];
}

function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function length(v: V3) {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalise(v: V3): V3 {
  const l = length(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function dot(a: V3, b: V3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function meshBounds(meshes: CadMeshPrimitive[]) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let count = 0;

  for (const mesh of meshes) {
    for (let index = 0; index + 2 < mesh.positions.length; index += 3) {
      const x = mesh.positions[index];
      const y = mesh.positions[index + 1];
      const z = mesh.positions[index + 2];
      if (![x, y, z].every(Number.isFinite)) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      count++;
    }
  }

  if (!count) return null;
  return {
    min: [minX, minY, minZ] as V3,
    max: [maxX, maxY, maxZ] as V3,
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2] as V3,
    size: [maxX - minX, maxY - minY, maxZ - minZ] as V3,
  };
}

export function projectCadMeshes(
  meshes: CadMeshPrimitive[],
  viewportWidth: number,
  viewportHeight: number,
  view: MeshView,
): ProjectedTriangle[] {
  const bounds = meshBounds(meshes);
  if (!bounds || viewportWidth <= 0 || viewportHeight <= 0) return [];

  const modelSpan = Math.max(...bounds.size, 1);
  const fitScale = Math.min(viewportWidth, viewportHeight) * 0.72 / modelSpan;
  const scale = fitScale * clamp(view.zoom, 0.2, 5);
  const centerX = viewportWidth / 2;
  const centerY = viewportHeight / 2;
  const lightDirection = normalise([0.35, -0.45, 1]);
  const output: ProjectedTriangle[] = [];

  for (const mesh of meshes) {
    const vertices: V3[] = [];
    for (let index = 0; index + 2 < mesh.positions.length; index += 3) {
      vertices.push(rotate([
        mesh.positions[index] - bounds.center[0],
        mesh.positions[index + 1] - bounds.center[1],
        mesh.positions[index + 2] - bounds.center[2],
      ], view.yaw, view.pitch));
    }

    for (let index = 0; index + 2 < mesh.indices.length; index += 3) {
      const a = vertices[mesh.indices[index]];
      const b = vertices[mesh.indices[index + 1]];
      const c = vertices[mesh.indices[index + 2]];
      if (!a || !b || !c) continue;
      const normal = normalise(cross(sub(b, a), sub(c, a)));
      const facing = Math.abs(normal[2]);
      const directional = Math.abs(dot(normal, lightDirection));
      output.push({
        meshId: mesh.id,
        points: [
          [centerX + a[0] * scale, centerY - a[1] * scale],
          [centerX + b[0] * scale, centerY - b[1] * scale],
          [centerX + c[0] * scale, centerY - c[1] * scale],
        ],
        depth: (a[2] + b[2] + c[2]) / 3,
        light: clamp(0.2 + directional * 0.55 + facing * 0.25, 0.18, 1),
      });
    }
  }

  return output.sort((a, b) => a.depth - b.depth);
}
