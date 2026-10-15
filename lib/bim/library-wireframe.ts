import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import catalog from "@/data/bim/cassette-library.json";
import sources from "@/public/bim/metallokassety-parametric/models.json";

type Point = [number, number, number];
const dot = (a: Point, b: Point) => a.reduce((sum, n, i) => sum + n * b[i], 0);
const subtract = (a: Point, b: Point): Point => a.map((n, i) => n - b[i]) as Point;
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (p: Point): Point => p.map(n => n / Math.hypot(...p)) as Point;

// Rendered on the server/build, not 15 geometry downloads in the visitor's browser.
// These are source-derived wireframes, not dimension drawings or approved joints.
export function libraryWireframe(modelId: string): string {
  const source = sources.find(item => item.id === modelId);
  if (!source || !catalog.some(item => item.id === modelId)) throw new Error("Unknown BIM source");
  const bytes = readFileSync(path.join(process.cwd(), "public/bim/metallokassety/IFC4_coordination", `${modelId}.ifc`));
  if (createHash("sha256").update(bytes).digest("hex") !== source.ifcSha256) throw new Error("BIM thumbnail source checksum mismatch");
  const text = bytes.toString("ascii");
  const pointsRecord = text.match(/^#\d+=IFCCARTESIANPOINTLIST3D\((.*)\);$/m);
  const facesRecord = text.match(/^#\d+=IFCTRIANGULATEDFACESET\((.*)\);$/m);
  if (!pointsRecord || !facesRecord) throw new Error("BIM thumbnail source mesh missing");
  const tuples = (record: string): Point[] => Array.from(record.matchAll(/\(([^()]+)\)/g), match => match[1].split(",").map(Number) as Point);
  const points = tuples(pointsRecord[1]);
  const faces = tuples(facesRecord[1]).map(face => face.map(n => n - 1));
  if (!points.length || points.length > 70000 || faces.length > 120000) throw new Error("Invalid source mesh size");
  const camera = unit([1.1, -2.5, 1.3]);
  const right = unit(cross([0, 0, 1], camera)), up = cross(camera, right);
  const edges = new Map<string, { a: number; b: number; normals: Point[] }>();
  for (const face of faces) {
    if (face.some(i => !Number.isInteger(i) || !points[i])) throw new Error("Invalid source face");
    const [a, b, c] = face.map(i => points[i]);
    const n = unit(cross(subtract(b, a), subtract(c, a)));
    for (let j = 0; j < 3; j++) {
      const a = face[j], b = face[(j + 1) % 3], key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const edge: { a: number; b: number; normals: Point[] } = edges.get(key) || { a, b, normals: [] };
      edge.normals.push(n); edges.set(key, edge);
    }
  }
  const projected = points.map(p => [dot(p, right), -dot(p, up)]);
  const minimum = [0, 1].map(i => Math.min(...projected.map(p => p[i])));
  const maximum = [0, 1].map(i => Math.max(...projected.map(p => p[i])));
  const scale = Math.min(244 / (maximum[0] - minimum[0]), 142 / (maximum[1] - minimum[1]));
  const centre = minimum.map((v, i) => (v + maximum[i]) / 2);
  const coordinate = (index: number) => projected[index].map((v, i) => ((v - centre[i]) * scale + [140, 85][i]).toFixed(1)).join(" ");
  const segments = new Map<string, string>();
  for (const edge of edges.values()) {
    if (edge.normals.length !== 2) throw new Error("Source thumbnail mesh is not closed");
    const [n1, n2] = edge.normals, first = dot(n1, camera), second = dot(n2, camera);
    const silhouette = (first >= 0) !== (second >= 0);
    const visibleCrease = Math.max(first, second) >= 0 && dot(n1, n2) < 0.75;
    if (silhouette || visibleCrease) {
      const a = coordinate(edge.a), b = coordinate(edge.b);
      if (a !== b) segments.set([a, b].sort().join(":"), `M${a}L${b}`);
    }
  }
  if (!segments.size) throw new Error("Empty BIM source thumbnail");
  return [...segments.values()].join("");
}
