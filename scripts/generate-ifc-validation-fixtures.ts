/** Synthetic fixtures only. Run with: node --import tsx scripts/generate-ifc-validation-fixtures.ts [directory] */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createCassetteIfc, createCassetteCsv, type CassetteBimInput } from '../lib/bim/cassette';
import { createCassetteLayoutIfc, cassetteLayoutExportSummary } from '../lib/bim/cassette-layout';
import { createCassetteProjectCsv } from '../lib/cassette-project/export';
import { type CassetteProject, type CassettePanelStatus } from '../lib/cassette-project/model';

type Vector = [number, number, number];
type PanelExpectation = {
  tag: string; name: string; positionMm: Vector; localBoundsMm: [Vector, Vector];
  faceAreaM2: number; finish: string; storey: string; status?: CassettePanelStatus;
};
type Fixture = {
  name: string; kind: 'detailed' | 'layout'; file: string; csv: string; identityGroup: string;
  expected: Record<string, unknown>; input: CassetteBimInput | CassetteProject;
};
const directory = resolve(process.argv[2] || 'output/ifc-validation');
mkdirSync(directory, { recursive: true });
const fixtures: Fixture[] = [];
function write(name: string, contents: string) { writeFileSync(join(directory, name), contents, 'utf8'); }

// These bounds/counts are fixed observations of the reviewed source STEP meshes,
// not values obtained from cassetteGeometry or parsed back from the IFC under test.
const detailedCases: {
  name: string; input: CassetteBimInput; bounds: [Vector, Vector];
  parts: number; verticesPerPart: number; trianglesPerPart: number; profileLabel: string;
}[] = [
  { name: 'open-07', input: { profile:'open', widthMm:545, heightMm:545, depthMm:20, thicknessMm:.7, jointMm:45, columns:2, rows:2, mark:'CI-ОТ07', finish:'RAL 9005' }, bounds:[[-19.3,-19.3,0],[564.3,564.3,20]], parts:1, verticesPerPart:1196, trianglesPerPart:2404, profileLabel:'Открытый тип · ОТ' },
  { name: 'open-10', input: { profile:'open', widthMm:1170, heightMm:545, depthMm:20, thicknessMm:1, jointMm:45, columns:2, rows:1, mark:'CI-ОТ10', finish:'RAL 9005' }, bounds:[[-19,-19,0],[1189,564,20]], parts:1, verticesPerPart:1168, trianglesPerPart:2348, profileLabel:'Открытый тип · ОТ' },
  { name: 'closed-07', input: { profile:'closed', widthMm:565, heightMm:530, depthMm:19.7, thicknessMm:.7, jointMm:35, columns:2, rows:2, mark:'CI-ЗТ07', finish:'RAL 9005' }, bounds:[[0,0,0],[565,561.9563,19.7]], parts:1, verticesPerPart:1036, trianglesPerPart:2076, profileLabel:'Закрытое крепление · верхний зацеп' },
  { name: 'closed-10', input: { profile:'closed', widthMm:1190, heightMm:530, depthMm:20, thicknessMm:1, jointMm:35, columns:1, rows:2, mark:'CI-ЗТ10', finish:'RAL 9005' }, bounds:[[0,0,0],[1190,561.4333,20]], parts:1, verticesPerPart:1008, trianglesPerPart:2020, profileLabel:'Закрытое крепление · верхний зацеп' },
  { name: 'open-stretched', input: { profile:'open', widthMm:745, heightMm:645, depthMm:20, thicknessMm:.7, jointMm:45, columns:2, rows:1, mark:'CI-STRETCH', finish:'RAL 9005' }, bounds:[[-19.3,-19.3,0],[764.3,664.3,20]], parts:1, verticesPerPart:1196, trianglesPerPart:2404, profileLabel:'Открытый тип · ОТ' },
  { name: 'corner', input: { profile:'corner', widthMm:290, returnWidthMm:330, heightMm:380, depthMm:20, thicknessMm:1, jointMm:45, columns:1, rows:2, mark:"CI-УГ'\\", finish:'RAL 9005' }, bounds:[[0,-20,0],[290,400,330]], parts:12, verticesPerPart:8, trianglesPerPart:12, profileLabel:'Угловая кассета · 90°' },
  { name: 'legacy-straight', input: { widthMm:700, heightMm:590, depthMm:40, thicknessMm:1.2, jointMm:20, columns:2, rows:2, mark:'CI-LEGACY', finish:'RAL 9005' }, bounds:[[0,0,0],[700,590,40]], parts:5, verticesPerPart:8, trianglesPerPart:12, profileLabel:'Прямые борта' },
];
for (const scenario of detailedCases) {
  const p: CassetteBimInput = { ...scenario.input, projectId:`ci-${scenario.name}`, panelColours:{ '0:0':{ ral:'RAL 7016', hex:'#383e42' } } };
  const panels: PanelExpectation[] = [];
  for (let row=0; row<p.rows; row++) for (let column=0; column<p.columns; column++) {
    const tag = `${p.mark}-${String(row*p.columns+column+1).padStart(3,'0')}`;
    panels.push({ tag, name:tag, positionMm:[column*(p.widthMm+p.jointMm),0,row*(p.heightMm+p.jointMm)], localBoundsMm:scenario.bounds,
      faceAreaM2:(p.widthMm+(p.returnWidthMm || 0))*p.heightMm/1e6, finish:row===0 && column===0 ? 'RAL 7016' : p.finish, storey:'Фасадный фрагмент' });
  }
  for (const suffix of ['', '-repeat']) {
    const name = scenario.name+suffix, file = `${name}.ifc`, csv = `${name}.csv`;
    write(file, createCassetteIfc(p)); write(csv, createCassetteCsv(p));
    fixtures.push({ name, kind:'detailed', file, csv, identityGroup:scenario.name, input:p,
      expected:{ panels, storeys:['Фасадный фрагмент'], material:'Оцинкованная сталь', manufacturer:'Сталь Продукт', profileLabel:scenario.profileLabel,
        partsPerPanel:scenario.parts, verticesPerPart:scenario.verticesPerPart, trianglesPerPart:scenario.trianglesPerPart,
        faceAreaM2:panels.reduce((sum,panel)=>sum+panel.faceAreaM2,0) } });
  }
}

const project: CassetteProject = { schemaVersion:1, kind:'steelprodukt-cassette-project', id:'ci-layout', revision:1, name:"CI 'проёмы' \\ координация", elevations:[
  { id:'south', name:'Южный', widthMm:2500, heightMm:1400, panel:{ faceWidthMm:1000, faceHeightMm:500, jointXMm:100, jointYMm:100, type:'open', thicknessMm:.7, finish:'RAL 7016' }, openings:[
    { id:'hole', name:'Внутренний проём', xMm:100, yMm:100, widthMm:300, heightMm:200 },
    { id:'removed', name:'Полная ячейка', xMm:1100, yMm:0, widthMm:1000, heightMm:500 },
    { id:'side', name:'Боковой срез', xMm:2200, yMm:0, widthMm:100, heightMm:500 },
    { id:'bottom', name:'Нижний срез', xMm:1100, yMm:600, widthMm:1000, heightMm:100 },
  ] },
  { id:'east', name:'Восточный', widthMm:950, heightMm:550, panel:{ faceWidthMm:400, faceHeightMm:200, jointXMm:100, jointYMm:100, type:'closed', thicknessMm:1, finish:'RAL 9010' }, openings:[] },
  { id:'empty', name:'Исключённый', widthMm:400, heightMm:200, panel:{ faceWidthMm:400, faceHeightMm:200, jointXMm:0, jointYMm:0, type:'open', thicknessMm:.7, finish:'RAL 7016' }, openings:[
    { id:'all', name:'Полностью в проёме', xMm:0, yMm:0, widthMm:400, heightMm:200 },
  ] },
] };
// Independently hand-calculated grid: 9 south + 4 east + 1 entirely removed.
// South leaves 7 rectangles (1.61 m²), a 0.44 m² nonrectangular face and a removed cell.
// East ends inside joints: four complete 0.08 m² panels, with no invented edge slivers.
const cells: { elevation:string; row:number; column:number; status:CassettePanelStatus; area:number; rect:[number,number,number,number] | null }[] = [
  { elevation:'south', row:1, column:1, status:'opening-affected', area:.44, rect:null },
  { elevation:'south', row:1, column:2, status:'opening-removed', area:0, rect:null },
  { elevation:'south', row:1, column:3, status:'opening-affected', area:.1, rect:[2300,0,200,500] },
  { elevation:'south', row:2, column:1, status:'complete', area:.5, rect:[0,600,1000,500] },
  { elevation:'south', row:2, column:2, status:'opening-affected', area:.4, rect:[1100,700,1000,400] },
  { elevation:'south', row:2, column:3, status:'edge', area:.15, rect:[2200,600,300,500] },
  { elevation:'south', row:3, column:1, status:'edge', area:.2, rect:[0,1200,1000,200] },
  { elevation:'south', row:3, column:2, status:'edge', area:.2, rect:[1100,1200,1000,200] },
  { elevation:'south', row:3, column:3, status:'edge', area:.06, rect:[2200,1200,300,200] },
  { elevation:'east', row:1, column:1, status:'complete', area:.08, rect:[0,0,400,200] },
  { elevation:'east', row:1, column:2, status:'complete', area:.08, rect:[500,0,400,200] },
  { elevation:'east', row:2, column:1, status:'complete', area:.08, rect:[0,300,400,200] },
  { elevation:'east', row:2, column:2, status:'complete', area:.08, rect:[500,300,400,200] },
  { elevation:'empty', row:1, column:1, status:'opening-removed', area:0, rect:null },
];
for (const suffix of ['', '-repeat', '-revision']) {
  const input = structuredClone(project);
  if (suffix === '-revision') { input.revision=2; input.elevations[0].panel.finish='RAL 9005'; }
  const panels: PanelExpectation[] = cells.flatMap(cell => {
    if (!cell.rect) return [];
    const [x,y,width,height] = cell.rect;
    const e = input.elevations.find(e=>e.id===cell.elevation)!;
    return [{ tag:`ci-layout/${cell.elevation}/r${cell.row}c${cell.column}`, name:`${cell.elevation}-R${String(cell.row).padStart(2,'0')}-C${String(cell.column).padStart(2,'0')}`,
      positionMm:[x+(cell.elevation==='east' ? 3500 : 0),0,y] as Vector, localBoundsMm:[[0,0,0],[width,e.panel.thicknessMm,height]] as [Vector,Vector],
      faceAreaM2:cell.area, finish:e.panel.finish, storey:e.name, status:cell.status }];
  });
  const name = 'layout-openings'+suffix, file = `${name}.ifc`, csv = `${name}.csv`;
  write(file, createCassetteLayoutIfc(input)); write(csv, createCassetteProjectCsv(input));
  const summaryFile = `${name}-summary.json`;
  write(summaryFile, JSON.stringify(cassetteLayoutExportSummary(input),null,2));
  fixtures.push({ name, kind:'layout', file, csv, identityGroup:'layout-openings', input,
    expected:{ panels, storeys:['Южный','Восточный','Исключённый'], partsPerPanel:1, verticesPerPart:8, trianglesPerPart:12,
      faceAreaM2:1.93, scheduleFaceAreaM2:2.37, cells:cells.map(c=>({...c,id:`ci-layout/${c.elevation}/r${c.row}c${c.column}`})),
      omittedPanelIds:['ci-layout/south/r1c1'], removedPanelIds:['ci-layout/south/r1c2','ci-layout/empty/r1c1'], summaryFile } });
}
// An empty export must fail explicitly, rather than produce a falsely successful IFC.
const noPanels = { ...project, elevations:[project.elevations[2]] };
let emptyExportRejected = false;
try { createCassetteLayoutIfc(noPanels); } catch (error) {
  if (!(error instanceof Error) || !error.message.includes('Нет прямоугольных кассет')) throw error;
  emptyExportRejected=true;
}
if (!emptyExportRejected) throw new Error('An all-removed layout silently produced an IFC.');
write('manifest.json', JSON.stringify({ schemaVersion:1, synthetic:true, ifcopenshellVersion:'0.8.5', emptyExportRejected, fixtures },null,2));
console.log(JSON.stringify({ ok:true, directory, fixtureCount:fixtures.length, emptyExportRejected }));
