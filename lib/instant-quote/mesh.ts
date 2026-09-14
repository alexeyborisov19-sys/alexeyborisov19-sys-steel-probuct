import type { CadMeshPrimitive } from "@/lib/instant-quote/cad-model";

export type MeshBounds = {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  size: [number, number, number];
  radius: number;
};

export function calculateMeshBounds(meshes: CadMeshPrimitive[]): MeshBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let found = false;

  for (const mesh of meshes) {
    for (let index = 0; index + 2 < mesh.positions.length; index += 3) {
      const x = mesh.positions[index];
      const y = mesh.positions[index + 1];
      const z = mesh.positions[index + 2];
      if (![x, y, z].every(Number.isFinite)) continue;
      found = true;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
  }

  if (!found) return null;

  const center: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];
  const size: [number, number, number] = [maxX - minX, maxY - minY, maxZ - minZ];
  const radius = Math.max(Math.hypot(size[0], size[1], size[2]) / 2, 0.001);

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    center,
    size,
    radius,
  };
}

export function calculateTriangleNormals(mesh: CadMeshPrimitive): number[] {
  const normals = new Array(mesh.positions.length).fill(0);

  for (let index = 0; index + 2 < mesh.indices.length; index += 3) {
    const ia = mesh.indices[index] * 3;
    const ib = mesh.indices[index + 1] * 3;
    const ic = mesh.indices[index + 2] * 3;

    const ax = mesh.positions[ia];
    const ay = mesh.positions[ia + 1];
    const az = mesh.positions[ia + 2];
    const bx = mesh.positions[ib];
    const by = mesh.positions[ib + 1];
    const bz = mesh.positions[ib + 2];
    const cx = mesh.positions[ic];
    const cy = mesh.positions[ic + 1];
    const cz = mesh.positions[ic + 2];

    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;

    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;

    for (const vertex of [ia, ib, ic]) {
      normals[vertex] += nx;
      normals[vertex + 1] += ny;
      normals[vertex + 2] += nz;
    }
  }

  for (let index = 0; index + 2 < normals.length; index += 3) {
    const length = Math.hypot(normals[index], normals[index + 1], normals[index + 2]) || 1;
    normals[index] /= length;
    normals[index + 1] /= length;
    normals[index + 2] /= length;
  }

  return normals;
}

export function countMeshTriangles(meshes: CadMeshPrimitive[]) {
  return meshes.reduce((sum, mesh) => sum + Math.floor(mesh.indices.length / 3), 0);
}
