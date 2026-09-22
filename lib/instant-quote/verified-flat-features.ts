import type { DxfShape, ParsedDxf, Point2D } from './dxf';

export type VerifiedFlatFeatures = {
  supported: boolean;
  reasons: string[];
  holeCount: number;
  minHoleDiameterMm: number | null;
  /** Minimum hole-to-edge or hole-to-hole clearance; null when there are no holes. */
  minLigamentMm: number | null;
  minPartSideMm: number | null;
};
export type FlatFeatureNorm = {
  version: string;
  materialId: string;
  thicknessMm: number;
  minHoleDiameterMm: number;
  minLigamentMm: number;
  minPartSideMm: number | null;
  source: { id: string; label: string; confirmedAt: string; note: string };
};
export type FlatFeatureValidation = { status: 'pass' | 'blocked' | 'needs-review'; reasons: string[]; normVersion: string | null };
const MAX_HOLES = 1000;
const unsupported = (reason: string): VerifiedFlatFeatures => ({ supported: false, reasons: [reason], holeCount: 0, minHoleDiameterMm: null, minLigamentMm: null, minPartSideMm: null });
const finitePoint = (point: Point2D) => Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) <= 1e9 && Math.abs(point.y) <= 1e9;
const key = (p: Point2D) => `${p.x},${p.y}`;
const segmentKey = (a: Point2D, b: Point2D) => [key(a), key(b)].sort().join('|');

/** Strict subset only. No tolerances snap imperfect contours into manufacturable rectangles. */
export function measureVerifiedFlatFeatures(input: Pick<ParsedDxf, 'shapes' | 'units' | 'unsupportedEntities'>): VerifiedFlatFeatures {
  if (input.units !== 'мм') return unsupported('Единицы геометрии должны быть подтверждены в миллиметрах.');
  if (input.unsupportedEntities.length) return unsupported('Часть геометрии DXF не распознана.');
  if (!input.shapes.length || input.shapes.length > MAX_HOLES + 4) return unsupported('Число элементов выходит за пределы проверяемого поднабора.');
  const circles = input.shapes.filter((s): s is Extract<DxfShape, { kind: 'circle' }> => s.kind === 'circle');
  if (circles.length > MAX_HOLES) return unsupported('Поддерживается не более 1000 круглых отверстий.');
  const outline = input.shapes.filter(s => s.kind !== 'circle');
  let segments: { a: Point2D; b: Point2D }[];
  if (outline.length === 4 && outline.every(s => s.kind === 'line')) {
    segments = outline as Extract<DxfShape, { kind: 'line' }>[];
  } else if (outline.length === 1 && outline[0].kind === 'polyline') {
    const poly = outline[0];
    if (!poly.closed || poly.points.length !== 4 || poly.bulges.some(b => !Number.isFinite(b) || b !== 0)) return unsupported('Наружный контур должен быть замкнутым прямоугольником без дуг.');
    segments = poly.points.map((a, i) => ({ a, b: poly.points[(i + 1) % 4] }));
  } else return unsupported('Поддерживается только один прямоугольный контур с круглыми отверстиями.');
  const points = segments.flatMap(s => [s.a, s.b]);
  if (!points.every(finitePoint)) return unsupported('Координаты геометрии недопустимы.');
  const xs = [...new Set(points.map(p => p.x))].sort((a, b) => a - b);
  const ys = [...new Set(points.map(p => p.y))].sort((a, b) => a - b);
  if (xs.length !== 2 || ys.length !== 2) return unsupported('Наружный контур не является осевым прямоугольником.');
  const corners = [{ x: xs[0], y: ys[0] }, { x: xs[1], y: ys[0] }, { x: xs[1], y: ys[1] }, { x: xs[0], y: ys[1] }];
  const expected = new Set(corners.map((a, i) => segmentKey(a, corners[(i + 1) % 4])));
  const actual = new Set(segments.map(s => segmentKey(s.a, s.b)));
  if (actual.size !== 4 || [...actual].some(s => !expected.has(s))) return unsupported('Стороны прямоугольника разорваны, дублируются или пересекаются.');
  let diameter = Infinity, ligament = Infinity;
  for (let i = 0; i < circles.length; i++) {
    const hole = circles[i];
    if (!finitePoint(hole.c) || !Number.isFinite(hole.r) || hole.r <= 0 || hole.r > 1e9) return unsupported('Геометрия круглого отверстия недопустима.');
    const edgeGap = Math.min(hole.c.x - xs[0], xs[1] - hole.c.x, hole.c.y - ys[0], ys[1] - hole.c.y) - hole.r;
    if (edgeGap <= 0) return unsupported('Отверстие касается наружного контура или выходит за него.');
    diameter = Math.min(diameter, 2 * hole.r);
    ligament = Math.min(ligament, edgeGap);
    for (let j = 0; j < i; j++) {
      const other = circles[j];
      const gap = Math.hypot(hole.c.x - other.c.x, hole.c.y - other.c.y) - hole.r - other.r;
      if (gap <= 0) return unsupported('Отверстия касаются, пересекаются или вложены друг в друга.');
      ligament = Math.min(ligament, gap);
    }
  }
  return { supported: true, reasons: [], holeCount: circles.length, minHoleDiameterMm: circles.length ? diameter : null, minLigamentMm: circles.length ? ligament : null, minPartSideMm: Math.min(xs[1] - xs[0], ys[1] - ys[0]) };
}

/** Missing or inapplicable owner-approved norms never imply permission to manufacture. */
export function validateVerifiedFlatFeatures(features: VerifiedFlatFeatures, norm: FlatFeatureNorm | null | undefined, selection: { materialId: string; thicknessMm: number }): FlatFeatureValidation {
  const review = (reason: string): FlatFeatureValidation => ({ status: 'needs-review', reasons: [reason], normVersion: null });
  if (!features.supported) return { status: 'needs-review', reasons: features.reasons, normVersion: null };
  if (!norm) return review('Подтверждённые технологические нормы не заданы.');
  const nonempty = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  if (![norm.version, norm.materialId, norm.source?.id, norm.source?.label, norm.source?.note, norm.source?.confirmedAt].every(nonempty)
    || !Number.isFinite(Date.parse(norm.source.confirmedAt))
    || ![norm.thicknessMm, norm.minHoleDiameterMm, norm.minLigamentMm].every(v => Number.isFinite(v) && v > 0)) return review('Технологические нормы не содержат корректных значений или источника.');
  if (norm.minPartSideMm !== null && (!Number.isFinite(norm.minPartSideMm) || norm.minPartSideMm <= 0)) return review('Некорректный минимальный размер детали.');
  if (norm.materialId !== selection.materialId || norm.thicknessMm !== selection.thicknessMm) return review('Технологические нормы не соответствуют материалу и толщине.');
  if (!Number.isInteger(features.holeCount) || features.holeCount < 0 || features.holeCount > MAX_HOLES || features.minPartSideMm == null || !Number.isFinite(features.minPartSideMm) || features.minPartSideMm <= 0
    || (features.holeCount > 0 && [features.minHoleDiameterMm, features.minLigamentMm].some(v => v == null || !Number.isFinite(v) || v <= 0))
    || (features.holeCount === 0 && (features.minHoleDiameterMm !== null || features.minLigamentMm !== null))) return review('Измерения геометрии неполны.');
  const reasons: string[] = [];
  if (norm.minPartSideMm !== null && features.minPartSideMm < norm.minPartSideMm) reasons.push('Габарит детали меньше технологического минимума.');
  if (features.minHoleDiameterMm != null && features.minHoleDiameterMm < norm.minHoleDiameterMm) reasons.push('Диаметр отверстия меньше технологического минимума.');
  if (features.minLigamentMm != null && features.minLigamentMm < norm.minLigamentMm) reasons.push('Перемычка меньше технологического минимума.');
  return { status: reasons.length ? 'blocked' : 'pass', reasons, normVersion: norm.version };
}
