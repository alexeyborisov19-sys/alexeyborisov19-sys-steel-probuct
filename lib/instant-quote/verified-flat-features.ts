import type { ParsedDxf } from './dxf';
import { FlatContourError, buildFlatContours, contourBounds, contourContains, contourDistance, contourWidth } from './flat-contours';

export type VerifiedFlatFeatures = {
  supported: boolean;
  /** Exact closed/simple LINE/ARC topology; not a ligament/manufacturing approval. */
  topologyVerified?: true;
  /** A known invalid contour must not receive even a preliminary price. */
  invalidGeometry?: true;
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
const unsupported = (reason: string, flags: {topologyVerified?:true;invalidGeometry?:true} = {}): VerifiedFlatFeatures => ({ supported: false, ...flags, reasons: [reason], holeCount: 0, minHoleDiameterMm: null, minLigamentMm: null, minPartSideMm: null });
/** Convex LINE/ARC contours are measured analytically, never from preview points.
 * Concave boundaries remain manual: bounding boxes cannot prove narrow-neck safety.
 */
export function measureVerifiedFlatFeatures(input: Pick<ParsedDxf, 'shapes' | 'units' | 'unsupportedEntities'>): VerifiedFlatFeatures {
  if (input.units !== 'мм') return unsupported('Единицы геометрии должны быть подтверждены в миллиметрах.');
  if (input.unsupportedEntities.length) return unsupported('Часть геометрии DXF не распознана.');
  try {
    const contours = buildFlatContours(input.shapes, {allowConcave:true}).sort((a,b) => b.area-a.area);
    const outer=contours[0], holes=contours.slice(1);
    if(holes.length>MAX_HOLES) return unsupported('Слишком много отверстий для автоматической проверки.');
    let diameter=Infinity,ligament=Infinity;
    // Validate ALL boundaries before returning any unsupported-feature review.
    // Otherwise an early concavity/width review could conceal later crossings.
    for(let i=0;i<holes.length;i++){
      const hole=holes[i];
      const gap=contourDistance(outer,hole);
      if(gap<=1e-8||!contourContains(outer,hole.edges[0].a))return unsupported('Отверстие пересекает наружный контур, касается его или находится снаружи.', {invalidGeometry:true});
      ligament=Math.min(ligament,gap);
      for(let j=0;j<i;j++){
        const other=holes[j], between=contourDistance(hole,other);
        if(between<=1e-8||contourContains(hole,other.edges[0].a)||contourContains(other,hole.edges[0].a))return unsupported('Отверстия касаются, пересекаются или вложены друг в друга.', {invalidGeometry:true});
        ligament=Math.min(ligament,between);
      }
    }
    if(contours.some(contour=>!contour.convex)) return unsupported('Вогнутый контур требует проверки узких перемычек технологом.', {topologyVerified:true});
    for(const hole of holes){
      const width=contourWidth(hole);
      if(width===null||!Number.isFinite(width)||width<=0) return unsupported('Форма отверстия требует проверки минимальной ширины технологом.', {topologyVerified:true});
      diameter=Math.min(diameter,width);
    }
    const bounds=contourBounds(outer);
    return {supported:true,reasons:[],holeCount:holes.length,minHoleDiameterMm:holes.length?diameter:null,minLigamentMm:holes.length?ligament:null,minPartSideMm:Math.min(bounds.width,bounds.height)};
  }catch(error){return unsupported(error instanceof Error?error.message:'Геометрия требует проверки технологом.', error instanceof FlatContourError&&error.invalidGeometry ? {invalidGeometry:true}:{});}
}

/** Missing or inapplicable owner-approved norms never imply permission to manufacture. */
export function validateVerifiedFlatFeatures(features: VerifiedFlatFeatures, norm: FlatFeatureNorm | null | undefined, selection: { materialId: string; thicknessMm: number }): FlatFeatureValidation {
  const review = (reason: string): FlatFeatureValidation => ({ status: 'needs-review', reasons: [reason], normVersion: null });
  if(features.invalidGeometry) return {status:'blocked',reasons:features.reasons,normVersion:null};
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
