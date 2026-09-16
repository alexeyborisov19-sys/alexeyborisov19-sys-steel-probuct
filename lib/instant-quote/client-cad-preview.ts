import type { NormalizedCadModel } from "@/lib/instant-quote/cad-model";
import { measuredThicknessMm } from "@/lib/instant-quote/sheet-metal";
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
  if (points.length < 2) return null;
  // Whole or nothing. A polyline cut off at the budget draws a contour that
  // stops in mid-air, and the customer reads that as a gap in their part
  // rather than as a preview that ran out of room.
  if (points.length > pointBudget.remaining) return null;
  pointBudget.remaining -= points.length;
  return { points, closed };
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
    excludedLayers: [...(parsed.skippedServiceLayers ?? [])],
  };
}

/**
 * Public CAD analysis may expose preview geometry, coarse bounding dimensions
 * and the plain facts of the customer's own file — how thick they drew it and
 * how many bends it has. What stays inside the confidential calculation
 * boundary is Steel Product's reading of that file for production: cut length,
 * pierces, areas, BRep faces, unfold data, stock allocation and detailed
 * warnings. The test is whose knowledge it is, not whether a number is
 * geometric.
 */
/**
 * The kernel meshes in single precision, and widening those floats to JavaScript
 * numbers exposes the binary tail: 12.3 is serialised as 12.300000190734863,
 * nineteen characters where four would do. Rounding to a micron — three orders
 * of magnitude finer than anything a preview of a 100–3000 mm part can show —
 * more than halves the payload.
 *
 * Only the displayed copy is rounded. Nothing is measured from it: thickness,
 * bends and the blank all come from the BRep analysis, never from this mesh.
 */
function displayMesh(mesh: NormalizedCadModel["meshes"][number]) {
  const micron = (value: number) => Math.round(value * 1000) / 1000;
  return {
    ...mesh,
    positions: mesh.positions.map(micron),
    ...(mesh.normals ? { normals: mesh.normals.map((value) => Math.round(value * 10000) / 10000) } : {}),
  };
}

export function createClientCadPreview(model: NormalizedCadModel, parsedDxf?: ParsedDxf): ClientCadPreview {
  const needsReview = model.warnings.length > 0;
  // A bent part is the one case where "needs review" has a specific, knowable
  // reason. Saying it here means the customer learns it on upload instead of
  // after configuring the position and pressing calculate.
  const bent = (model.geometry.bendCount ?? 0) > 0;
  // Production geometry reached the summary, so this part has a price. For a
  // bent part that is the difference between a number and a wait.
  const priced = (model.geometry.cutLengthMm ?? 0) > 0 && (model.geometry.blankAreaMm2 ?? 0) > 0;

  return {
    kind: "client-cad-preview",
    format: model.format,
    units: "mm",
    cad: {
      widthMm: model.geometry.widthMm ?? null,
      heightMm: model.geometry.heightMm ?? null,
      depthMm: model.geometry.depthMm ?? null,
      bendCountFromModel: model.geometry.bendCount ?? null,
      thicknessFromModelMm: measuredThicknessMm(model.sheetMetal),
    },
    meshes: model.meshes.map(displayMesh),
    root: model.root,
    drawing: parsedDxf ? createClientDxfDrawingPreview(parsedDxf) : null,
    status: needsReview ? "needs-review" : "recognized",
    message: bent && priced
      ? "Деталь с гибами. Толщина, гибы и размер развёртки определены по модели — стоимость рассчитывается автоматически."
      : bent
        ? "Деталь с гибами. Гибы и толщина определены по модели, но развёртку этой детали автоматически подтвердить не удалось, поэтому её проверит технолог."
        : needsReview
          ? "Модель загружена. Некоторые параметры потребуется уточнить перед окончательным расчётом."
          : "Модель распознана и готова к настройке.",
  };
}
