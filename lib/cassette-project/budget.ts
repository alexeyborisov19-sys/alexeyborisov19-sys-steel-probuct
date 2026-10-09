import { getDefaultMetalCassetteRate, roundMoney, type MetalCassetteThickness } from '../metal-cassette-estimate';
import { buildCassetteElevation, normalizeCassetteProject, type CassetteProject } from './model';

export const CASSETTE_BUDGET_ASSUMPTIONS = 'Базовый ориентир: по фактическому остатку лицевых поверхностей с учётом типа и толщины. Швы и полностью исключённые ячейки не входят в площадь этого ориентира. Доплаты за нестандартную форму, резку у проёмов, борта, покрытие и малую партию не определены; окончательную стоимость подтверждает инженер. Подсистема, крепёж, доборы и монтаж не включены. Это не коммерческое предложение.';
/** Same live project geometry, public rate floor and rounding; no stored/imported price authority. */
export function estimateCassetteProjectBudget(value: CassetteProject) {
 const project=normalizeCassetteProject(value);
 const byElevation=project.elevations.map(elevation=>{
  const layout=buildCassetteElevation(elevation,project.id);
  const thickness=(elevation.panel.thicknessMm===1?'1.0':String(elevation.panel.thicknessMm)) as MetalCassetteThickness;
  const rateRubM2=getDefaultMetalCassetteRate(elevation.panel.type,thickness);
  return { elevationId:elevation.id, type:elevation.panel.type, thicknessMm:elevation.panel.thicknessMm, rateRubM2, faceAreaM2:layout.summary.panelFaceAreaM2, quantity:layout.summary.quantity, reviewQuantity:layout.summary.affected+layout.summary.edge, amountRub:roundMoney(layout.summary.panelFaceAreaM2*rateRubM2) };
 });
 return { projectId:project.id, revision:project.revision, currency:'RUB' as const, totalRub:byElevation.reduce((sum,e)=>sum+e.amountRub,0), faceAreaM2:Number(byElevation.reduce((sum,e)=>sum+e.faceAreaM2,0).toFixed(12)), quantity:byElevation.reduce((sum,e)=>sum+e.quantity,0), reviewQuantity:byElevation.reduce((sum,e)=>sum+e.reviewQuantity,0), byElevation, assumptions:CASSETTE_BUDGET_ASSUMPTIONS };
}
