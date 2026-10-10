import type { CassetteRect } from "@/lib/cassette-project/model";

export type CassetteView = "perspective" | "plan";
export type CassettePoint = { x: number; y: number };

/** Camera transform only: it never changes layout geometry or invents cassette depth. */
export function createCassetteProjection(widthMm: number, heightMm: number, view: CassetteView) {
  const yaw = -.38, pitch = .12, distance = Math.max(widthMm, heightMm) * 2.8;
  function camera(xMm: number, yMm: number): CassettePoint {
    const x = xMm - widthMm / 2, y = heightMm / 2 - yMm;
    if (view === "plan") return { x, y };
    const turnedX = x * Math.cos(yaw), depth = -x * Math.sin(yaw);
    const turnedY = y * Math.cos(pitch) - depth * Math.sin(pitch);
    const turnedDepth = y * Math.sin(pitch) + depth * Math.cos(pitch);
    const perspective = distance / (distance + turnedDepth);
    return { x: turnedX * perspective, y: turnedY * perspective };
  }
  const corners = [camera(0, 0), camera(widthMm, 0), camera(widthMm, heightMm), camera(0, heightMm)];
  const left = Math.min(...corners.map(p => p.x)), right = Math.max(...corners.map(p => p.x));
  const top = Math.min(...corners.map(p => p.y)), bottom = Math.max(...corners.map(p => p.y));
  const scale = Math.min(720 / (right - left), 350 / (bottom - top));
  return (xMm: number, yMm: number): CassettePoint => {
    const p = camera(xMm, yMm);
    return { x: 400 + (p.x - (left + right) / 2) * scale, y: 208 + (p.y - (top + bottom) / 2) * scale };
  };
}

export function cassetteRectPoints(rect: CassetteRect, project: (xMm: number, yMm: number) => CassettePoint) {
  return [project(rect.xMm, rect.yMm), project(rect.xMm + rect.widthMm, rect.yMm), project(rect.xMm + rect.widthMm, rect.yMm + rect.heightMm), project(rect.xMm, rect.yMm + rect.heightMm)];
}

export function cassettePolygon(points: CassettePoint[]) {
  return points.map(p => `${Number(p.x.toFixed(4))},${Number(p.y.toFixed(4))}`).join(" ");
}
