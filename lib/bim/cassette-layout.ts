import { buildCassetteElevation, normalizeCassetteProject, type CassetteProject } from '../cassette-project/model';
import { ifcString, stableIfcGuid } from './ifc-identity';

export const cassetteLayoutScope = 'Координационная раскладка: замкнутые плоские габариты лиц кассет, без бортов, замков, крепежа, подсистемы и монтажа. Непрямоугольные участки у проёмов не моделируются; см. полную CSV-ведомость. Не для изготовления или расчёта нагрузок.';

export function cassetteLayoutExportSummary(value: CassetteProject) {
  const project = normalizeCassetteProject(value);
  const panels = project.elevations.flatMap(elevation => buildCassetteElevation(elevation, project.id).panels);
  const included = panels.filter(panel => panel.coordinationRect !== null);
  const omitted = panels.filter(panel => panel.status !== 'opening-removed' && panel.coordinationRect === null);
  return { exportedPanels: included.length, omittedPanels: omitted.length, omittedPanelIds: omitted.map(panel => panel.id), removedPanels: panels.filter(panel => panel.status === 'opening-removed').length, exportedFaceAreaM2: included.reduce((sum,panel) => sum + panel.coordinationRect!.widthMm * panel.coordinationRect!.heightMm / 1e6,0) };
}

/** Layout-only boxes; the separate profile BIM editor retains source STEP geometry. */
export function createCassetteLayoutIfc(value: CassetteProject): string {
  const project = normalizeCassetteProject(value);
  const summary = cassetteLayoutExportSummary(project);
  if (!summary.exportedPanels) throw new Error('Нет прямоугольных кассет для IFC. Сохраните полную ведомость для проверки инженером.');
  const lines: string[] = [];
  const add = (entity: string) => { const ref = `#${lines.length+1}`; lines.push(`${ref}=${entity};`); return ref; };
  const n = (v: number) => Number.isInteger(v) ? `${v}.` : `${Number(v.toFixed(8))}`;
  const seen = new Set<string>();
  const guid = (key: string) => {
    const id = stableIfcGuid(`${project.id}/${key}`);
    if (seen.has(id)) throw new Error('Повтор идентификаторов IFC. Проверьте проект.');
    seen.add(id); return ifcString(id);
  };
  const point = (x:number,y:number,z:number) => add(`IFCCARTESIANPOINT((${n(x)},${n(y)},${n(z)}))`);
  const zAxis = add('IFCDIRECTION((0.,0.,1.))');
  const xAxis = add('IFCDIRECTION((1.,0.,0.))');
  const placementAt = (x:number,y:number,z:number) => add(`IFCLOCALPLACEMENT($,${add(`IFCAXIS2PLACEMENT3D(${point(x,y,z)},${zAxis},${xAxis})`)})`);
  const origin = add(`IFCAXIS2PLACEMENT3D(${point(0,0,0)},${zAxis},${xAxis})`);
  const context = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,0.00001,${origin},$)`);
  const units = add(`IFCUNITASSIGNMENT((${add('IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)')},${add('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)')}))`);
  const projectRef = add(`IFCPROJECT(${guid('project')},$,${ifcString(project.name)},${ifcString(cassetteLayoutScope)},$,$,$,(${context}),${units})`);
  const building = add(`IFCBUILDING(${guid('building')},$,${ifcString('Развёртки: разнесены по оси X, не пространственная модель здания')},$,$,${placementAt(0,0,0)},$,$,.ELEMENT.,$,$,$)`);
  add(`IFCRELAGGREGATES(${guid('project-building')},$,$,$,${projectRef},(${building}))`);
  let elevationOffset = 0;
  for (const elevation of project.elevations) {
    const storey = add(`IFCBUILDINGSTOREY(${guid(`elevation/${elevation.id}`)},$,${ifcString(elevation.name)},${ifcString('Плоская развёртка, собственное начало координат слева внизу')},$,${placementAt(0,0,0)},$,$,.ELEMENT.,0.)`);
    add(`IFCRELAGGREGATES(${guid(`building/${elevation.id}`)},$,$,$,${building},(${storey}))`);
    const panels: string[] = [];
    for (const panel of buildCassetteElevation(elevation,project.id).panels) {
      const rect = panel.coordinationRect;
      if (!rect) continue;
      const w = rect.widthMm, h = rect.heightMm, t = elevation.panel.thicknessMm;
      // X: width; Y: shallow sheet envelope; Z: elevation height. Each edge belongs to two triangles.
      const vertices = [[0,0,0],[w,0,0],[w,0,h],[0,0,h],[0,t,0],[w,t,0],[w,t,h],[0,t,h]];
      const triangles = [[1,2,3],[1,3,4],[5,8,7],[5,7,6],[1,5,6],[1,6,2],[2,6,7],[2,7,3],[3,7,8],[3,8,4],[4,8,5],[4,5,1]];
      const coords = add(`IFCCARTESIANPOINTLIST3D((${vertices.map(v=>`(${v.map(n).join(',')})`).join(',')}))`);
      const mesh = add(`IFCTRIANGULATEDFACESET(${coords},$,.T.,(${triangles.map(face=>`(${face.join(',')})`).join(',')}),$)`);
      const representation = add(`IFCSHAPEREPRESENTATION(${context},'Body','Tessellation',(${mesh}))`);
      const shape = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${representation}))`);
      const ref = add(`IFCPLATE(${guid(`panel/${panel.id}`)},$,${ifcString(panel.mark)},${ifcString(cassetteLayoutScope)},$,${placementAt(elevationOffset+rect.xMm,0,rect.yMm)},${shape},${ifcString(panel.id)},.CURTAIN_PANEL.)`);
      panels.push(ref);
      const properties = Object.entries({ PanelId:panel.id, ProjectId:project.id, Revision:String(project.revision), Elevation:elevation.name, ReviewStatus:panel.status, Finish:elevation.panel.finish, Profile:elevation.panel.type, Geometry:'Rectangular face envelope only', Scope:cassetteLayoutScope, OmittedPanels:String(summary.omittedPanels) }).map(([key,value])=>add(`IFCPROPERTYSINGLEVALUE(${ifcString(key)},$,IFCTEXT(${ifcString(value)}),$)`));
      const pset = add(`IFCPROPERTYSET(${guid(`properties/${panel.id}`)},$,'SP_CassetteLayout',$,(${properties.join(',')}))`);
      add(`IFCRELDEFINESBYPROPERTIES(${guid(`panel-properties/${panel.id}`)},$,$,$,(${ref}),${pset})`);
      const area = add(`IFCQUANTITYAREA('FaceArea',$,$,${n(w*h/1e6)},$)`);
      const quantity = add(`IFCELEMENTQUANTITY(${guid(`quantity/${panel.id}`)},$,'SP_CassetteLayoutQuantities',$,$,(${area}))`);
      add(`IFCRELDEFINESBYPROPERTIES(${guid(`panel-quantity/${panel.id}`)},$,$,$,(${ref}),${quantity})`);
    }
    if (panels.length) add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${guid(`containment/${elevation.id}`)},$,$,$,(${panels.join(',')}),${storey})`);
    elevationOffset += elevation.widthMm + 1000; // Presentation separation, explicitly not building coordinates.
  }
  return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('Cassette elevation coordination envelopes; see complete CSV schedule'),'2;1');\nFILE_NAME('steelprodukt-cassette-layout.ifc','${new Date().toISOString()}',('Steel Produkt'),('Steel Produkt'),'Steel Produkt layout 1.0','Steel Produkt','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`;
}
