import type { CassetteBimInput } from './cassette';
import type { CassetteSolid, Vec3 } from './cassette-geometry';

export type CassetteInspectionMode = 'single' | 'neighbours' | 'exploded';
export type CassetteInspectionAxis = 'horizontal' | 'vertical';
export type CassetteInspectionInstance = { id: 'A' | 'B'; solids: CassetteSolid[]; offset: Vec3 };
export type CassetteInspectionBounds = { min: Vec3; max: Vec3 };
export type CassetteInspectionPolygon = { key: string; instanceId: 'A' | 'B'; points: Vec3[]; depth: number; light: number; edges: { points: [Vec3, Vec3]; silhouette: boolean }[] };
const MAX_VERTICES = 30_000, MAX_FACES = 12_000;
const finite = (values: number[]) => values.every(Number.isFinite);
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export function canInspectCassetteNeighbours(input: Pick<CassetteBimInput, 'profile'>) {
  return input.profile === 'open' || input.profile === 'closed';
}

/** Source solids stay intact. This is a face-pitch arrangement, never an engagement transform. */
export function createCassetteInspectionInstances(input: CassetteBimInput, solids: CassetteSolid[], mode: CassetteInspectionMode, axis: CassetteInspectionAxis): CassetteInspectionInstance[] {
  if (!finite([input.widthMm, input.heightMm, input.depthMm, input.jointMm]) || Math.min(input.widthMm, input.heightMm, input.depthMm) <= 0 || input.jointMm < 0) throw new Error('Проверьте размеры и шов кассеты.');
  const instances: CassetteInspectionInstance[] = [{ id: 'A', solids, offset: [0, 0, 0] }];
  if (mode === 'single' || !canInspectCassetteNeighbours(input)) return instances;
  const offset: Vec3 = axis === 'horizontal' ? [input.widthMm + input.jointMm, 0, 0] : [0, input.heightMm + input.jointMm, 0];
  // A visual separation of whole panels, explicitly not a physical joint/installation dimension.
  if (mode === 'exploded') offset[2] = Math.max(input.depthMm * 4, Math.min(input.widthMm, input.heightMm) * .2);
  instances.push({ id: 'B', solids, offset });
  return instances;
}

export function cassetteInspectionBounds(instances: CassetteInspectionInstance[]): CassetteInspectionBounds {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  let vertices = 0, faces = 0;
  for (const instance of instances) {
    if (!finite(instance.offset)) throw new Error('Некорректное положение кассеты.');
    for (const solid of instance.solids) {
      vertices += solid.vertices.length; faces += solid.faces.length;
      if (vertices > MAX_VERTICES || faces > MAX_FACES) throw new Error('Геометрия превышает предел предпросмотра.');
      for (const point of solid.vertices) {
        if (point.length !== 3 || !finite(point)) throw new Error('Геометрия содержит некорректную координату.');
        for (let axis = 0; axis < 3; axis++) {
          const value = point[axis] + instance.offset[axis];
          if (!Number.isFinite(value)) throw new Error('Геометрия выходит за предел координат.');
          min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
        }
      }
      for (const face of solid.faces) if (face.length < 3 || face.some(index => !Number.isInteger(index) || index < 0 || index >= solid.vertices.length)) throw new Error('Геометрия содержит некорректную грань.');
    }
  }
  if (!vertices || !faces || !finite(min) || !finite(max)) throw new Error('Нет геометрии для предпросмотра.');
  if (Math.max(...max.map((value, i) => value - min[i])) <= 1e-9) throw new Error('Геометрия имеет нулевые габариты.');
  return { min, max };
}

/** Orthographic technical camera: positive depth points away from the viewer. */
export function createCassetteInspectionCamera(instances: CassetteInspectionInstance[], yaw: number, pitch: number) {
  if (!finite([yaw, pitch])) throw new Error('Некорректный ракурс.');
  const bounds = cassetteInspectionBounds(instances);
  const a = yaw * Math.PI / 180, b = pitch * Math.PI / 180;
  const rotate = ([x, y, z]: Vec3): Vec3 => {
    const u = x * Math.cos(a) + z * Math.sin(a), depth = -x * Math.sin(a) + z * Math.cos(a);
    return [u, -y * Math.cos(b) + depth * Math.sin(b), y * Math.sin(b) + depth * Math.cos(b)];
  };
  const points = instances.flatMap(instance => instance.solids.flatMap(solid => solid.vertices.map(point => rotate(add(point, instance.offset)))));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) { minX = Math.min(minX, point[0]); minY = Math.min(minY, point[1]); maxX = Math.max(maxX, point[0]); maxY = Math.max(maxY, point[1]); }
  const width = maxX - minX, height = maxY - minY;
  if (!finite([width, height]) || Math.max(width, height) <= 1e-9) throw new Error('Геометрия не видна в этом ракурсе.');
  const scale = Math.min(780 / Math.max(width, 1e-9), 420 / Math.max(height, 1e-9));
  const project = (point: Vec3): Vec3 => {
    if (!finite(point)) throw new Error('Некорректная точка предпросмотра.');
    const p = rotate(point);
    return [450 + (p[0] - (minX + maxX) / 2) * scale, 265 + (p[1] - (minY + maxY) / 2) * scale, p[2]];
  };
  return { bounds, scale, rotate, project, viewBox: '0 0 900 560' };
}

function faceNormal(face: number[], vertices: Vec3[]): Vec3 {
  const origin = vertices[face[0]];
  for (let index = 1; index < face.length - 1; index++) {
    const a = vertices[face[index]].map((v, i) => v - origin[i]), b = vertices[face[index + 1]].map((v, i) => v - origin[i]);
    const normal: Vec3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const length = Math.hypot(...normal);
    if (length > 1e-12) return normal.map(value => value / length) as Vec3;
  }
  return [0, 0, 0];
}

export function cassetteInspectionLight(normal: Vec3) {
  // Winding in the source STEP meshes is outward (positive signed volume).
  // Signed Lambert lighting distinguishes opposite sides instead of brightening both equally.
  const light: Vec3 = [-.4, -.5, -Math.sqrt(.59)];
  const diffuse = Math.max(0, dot(normal, light));
  const rim = .07 * (1 - Math.min(1, Math.abs(normal[2]))) ** 2;
  return Math.min(1.06, .4 + .63 * diffuse + rim);
}

export function projectCassetteInspection(instances: CassetteInspectionInstance[], yaw: number, pitch: number) {
  const camera = createCassetteInspectionCamera(instances, yaw, pitch);
  const polygons: CassetteInspectionPolygon[] = [];
  for (const instance of instances) for (const [solidIndex, solid] of instance.solids.entries()) {
    const points = solid.vertices.map(point => camera.project(add(point, instance.offset)));
    const normals = solid.faces.map(face => camera.rotate(faceNormal(face, solid.vertices)));
    // Canonical coordinates also weld duplicated mesh indices without changing the source mesh.
    const vertexKey = (index: number) => solid.vertices[index].map(value => Number(value.toFixed(7))).join(',');
    const edgeKey = (a: number, b: number) => [vertexKey(a), vertexKey(b)].sort().join('|');
    const adjacent = new Map<string, number[]>();
    solid.faces.forEach((face, index) => { for (let i = 0; i < face.length; i++) { const key = edgeKey(face[i], face[(i + 1) % face.length]); adjacent.set(key, [...(adjacent.get(key) ?? []), index]); } });
    solid.faces.forEach((face, faceIndex) => {
      const normal = normals[faceIndex];
      if (Math.hypot(...normal) < .5) return;
      // Opaque, outward-wound source solids: omit surfaces facing away from the
      // camera. Sorting triangle centroids alone lets the opposite sheet face
      // overpaint a nearer face when their triangulations differ.
      if (normal[2] >= -1e-10) return;
      const polygonPoints = face.map(index => points[index]);
      const edges: CassetteInspectionPolygon['edges'] = [];
      for (let i = 0; i < face.length; i++) {
        const a = face[i], b = face[(i + 1) % face.length];
        const neighbours = (adjacent.get(edgeKey(a, b)) ?? []).filter(index => index !== faceIndex);
        const silhouette = !neighbours.length || neighbours.some(index => (normal[2] < 0) !== (normals[index][2] < 0));
        const crease = neighbours.some(index => dot(normal, normals[index]) < Math.cos(25 * Math.PI / 180));
        if (silhouette || crease) edges.push({ points: [points[a], points[b]], silhouette });
      }
      polygons.push({ key: `${instance.id}-${solidIndex}-${faceIndex}`, instanceId: instance.id, points: polygonPoints, depth: polygonPoints.reduce((sum, point) => sum + point[2], 0) / polygonPoints.length, light: cassetteInspectionLight(normal), edges });
    });
  }
  if (!polygons.length) throw new Error('Нет ненулевых граней для предпросмотра.');
  polygons.sort((a, b) => b.depth - a.depth);
  return { ...camera, polygons };
}

export function cassetteInspectionColour(colour: string, light: number) {
  const safe = /^#[0-9a-f]{6}$/i.test(colour) ? colour : '#a8b5b9';
  const factor = Number.isFinite(light) ? Math.max(0, Math.min(1.2, light)) : 1;
  return `rgb(${[1, 3, 5].map(index => Math.max(0, Math.min(255, Math.round(parseInt(safe.slice(index, index + 2), 16) * factor)))).join(',')})`;
}

/** The reference is the entered seam between face envelopes, not the distance between bent flanges. */
export function cassetteInspectionSeam(input: CassetteBimInput, axis: CassetteInspectionAxis): [Vec3, Vec3] {
  if (!finite([input.widthMm, input.heightMm, input.jointMm]) || input.widthMm <= 0 || input.heightMm <= 0 || input.jointMm < 0) throw new Error('Проверьте размеры шва.');
  return axis === 'horizontal' ? [[input.widthMm, input.heightMm, 0], [input.widthMm + input.jointMm, input.heightMm, 0]] : [[0, input.heightMm, 0], [0, input.heightMm + input.jointMm, 0]];
}
