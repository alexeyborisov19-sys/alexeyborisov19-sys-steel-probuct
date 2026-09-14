import type { NormalizedCadModel } from "@/lib/instant-quote/cad-model";
import {
  arcPoints,
  ellipsePreviewPoints,
  polylinePreviewPoints,
  type ParsedDxf,
} from "@/lib/instant-quote/dxf";
import type {
  ClientCadDrawingPreview,
  ClientCadPreview,
  ClientCadPreviewPoint,
  ClientCadPreviewPolyline,
} from "@/lib/instant-quote/client-cad-preview-types";

const MAX_PREVIEW_POLYLINES = 4_000;
const MAX_PREVIEW_POINTS = 50_000;
const CIRCLE_PREVIEW_SEGMENTS = 72;

function point(x: number, y: number): ClientCadPreviewPoint {
  return [x, y];
}

function limitedPolyline(
  points: ClientCadPreviewPoint[],
  closed: boolean,
  pointBudget: { remaining: number },
): ClientCadPreviewPolyline | null {
  if (points.length < 2 || pointBudget.remaining < 2) return null;
  const keep = points.slice(0, pointBudget.remaining);
  if (keep.length < 2) return null;
  pointBudget.remaining -= keep.length;
  return { points: keep, closed: closed && keep.length === points.length };
}

/**
 * Turns authoritative DXF parsing into display-only sampled linework. Exact
 * topology and production metrics stay on the server; the browser receives
 * only enough points to draw what the customer uploaded.
 */
export function createClientDxfDrawingPreview(parsed: ParsedDxf): ClientCadDrawingPreview {
  const polylines: ClientCadPreviewPolyline[] = [];
  const pointBudget = { remaining: MAX_PREVIEW_POINTS };

  for (const shape of parsed.shapes) {
    if (polylines.length >= MAX_PREVIEW_POLYLINES || pointBudget.remaining < 2) break;

    let preview: ClientCadPreviewPolyline | null = null;
    if (shape.kind === "line") {
      preview = limitedPolyline(
        [point(shape.a.x, shape.a.y), point(shape.b.x, shape.b.y)],
        false,
        pointBudget,
      );
    } else if (shape.kind === "polyline") {
      preview = limitedPolyline(
        polylinePreviewPoints(shape).map((item) => point(item.x, item.y)),
        shape.closed,
        pointBudget,
      );
    } else if (shape.kind === "circle") {
      const sampled = Array.from({ length: CIRCLE_PREVIEW_SEGMENTS }, (_, index) => {
        const angle = index / CIRCLE_PREVIEW_SEGMENTS * Math.PI * 2;
        return point(shape.c.x + Math.cos(angle) * shape.r, shape.c.y + Math.sin(angle) * shape.r);
      });
      preview = limitedPolyline(sampled, true, pointBudget);
    } else if (shape.kind === "ellipse") {
      preview = limitedPolyline(
        ellipsePreviewPoints(shape).map((item) => point(item.x, item.y)),
        false,
        pointBudget,
      );
    } else {
      preview = limitedPolyline(
        arcPoints(shape).map((item) => point(item.x, item.y)),
        false,
        pointBudget,
      );
    }

    if (preview) polylines.push(preview);
  }

  return {
    minX: parsed.minX,
    minY: parsed.minY,
    maxX: parsed.maxX,
    maxY: parsed.maxY,
    widthMm: parsed.width,
    heightMm: parsed.height,
    polylines,
  };
}

/**
 * Public CAD analysis may expose only customer-visible preview geometry and
 * coarse bounding dimensions. Production geometry/evidence (cut length,
 * pierces, areas, BRep faces, bend/thickness evidence, unfold data and detailed
 * warnings) must remain inside the confidential calculation boundary.
 */
export function createClientCadPreview(model: NormalizedCadModel, parsedDxf?: ParsedDxf): ClientCadPreview {
  const needsReview = model.warnings.length > 0;

  return {
    kind: "client-cad-preview",
    format: model.format,
    units: "mm",
    cad: {
      widthMm: model.geometry.widthMm ?? null,
      heightMm: model.geometry.heightMm ?? null,
      depthMm: model.geometry.depthMm ?? null,
    },
    meshes: model.meshes,
    root: model.root,
    drawing: parsedDxf ? createClientDxfDrawingPreview(parsedDxf) : null,
    status: needsReview ? "needs-review" : "recognized",
    message: needsReview
      ? "Модель загружена. Некоторые параметры потребуется уточнить перед окончательным расчётом."
      : "Модель распознана и готова к настройке.",
  };
}
