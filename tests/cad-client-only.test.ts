import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createEmptyProject } from '../lib/instant-quote/domain';
import { addPartToProject } from '../lib/instant-quote/project';
import { createPublicCalculationManifest } from '../lib/instant-quote/client-calculation-request';
import { parsePublicCalculationManifest } from '../lib/instant-quote/calculation-manifest';
import { createClientCalculationView } from '../lib/instant-quote/client-calculation-view';
import { completeSelectedOperationInputs } from '../lib/instant-quote/operation-table-defaults';
import { createCadProjectFile, parseCadProjectFile, prepareCadProjectRestore } from '../lib/instant-quote/project-file';
function fixture() {
  const file = new File(['cad-source'], 'part.step');
  const project = addPartToProject(createEmptyProject(), { fileName: file.name, fileSizeBytes: file.size });
  project.parts[0].configuration = { materialId:'cold', thicknessMm:1, quantity:7, operations:['bending','welding','countersink','assembly','surface-preparation','powder-coating','packaging'], operationInputs:{bendCount:2,weldLengthM:1.5,countersinkCount:4,assemblyMinutes:25,powderSides:2,surfacePreparationSides:1} };
  return { project, file, part:project.parts[0] };
}
test('customer state defaults, manifest and parsed request exclude production assembly time', () => {
  const { project, part } = fixture();
  assert.equal(completeSelectedOperationInputs(part.configuration.operations, part.configuration.operationInputs!).assemblyMinutes, undefined);
  const manifest = createPublicCalculationManifest(project,[part.id]);
  assert.equal(manifest.parts[0].operationInputs.assemblyMinutes, undefined);
  assert.equal(manifest.parts[0].operations.length,7);
  const raw = JSON.parse(JSON.stringify(manifest)); raw.parts[0].operationInputs.assemblyMinutes=25;
  assert.equal(parsePublicCalculationManifest(JSON.stringify(raw),1).parts[0].operationInputs.assemblyMinutes,undefined);
});
test('legacy JSON is validated but restored/resaved customer data omits production time', async () => {
  const { project, part, file } = fixture();
  const saved = await createCadProjectFile(project,{[part.id]:file},{},1);
  assert.doesNotMatch(JSON.stringify(saved),/assemblyMinutes/);
  saved.positions[0].configuration.operationInputs!.assemblyMinutes=25;
  const restored=prepareCadProjectRestore(parseCadProjectFile(JSON.stringify(saved)));
  assert.equal(restored.project.parts[0].configuration.operationInputs!.assemblyMinutes,undefined);
  assert.equal(restored.project.parts[0].configuration.operations.length,7);
  assert.equal(restored.project.parts[0].quote.kind,'not-requested');
});
test('public projection keeps only sale result and generic customer warnings',()=>{
  const {project,part}=fixture();
  const view=createClientCalculationView(project,[{partId:part.id,status:'needs-review',estimatedSalePriceRub:12345,estimatedRateUsed:true,staleMaterialPriceDate:'2026-01-01',manufacturingWarnings:['PRIVATE NORM 987654; minimum ligament = 1mm']}]);
  const raw=JSON.stringify(view);
  assert.equal(view.parts[0].price.totalRub,12345);
  assert.doesNotMatch(raw,/PRIVATE|987654|materialPriceDate|соседним толщинам|закупоч|поставщик|assemblyMinutes/);
  assert.match(view.parts[0].message,/устарели/);
});
test('customer UI has seven operations without factory-time fields or batch equations',()=>{
  const controls=readFileSync('components/instant-quote/ClientOperationControls.tsx','utf8');
  const summary=readFileSync('components/cad/public/ClientOperationSummary.tsx','utf8');
  assert.doesNotMatch(controls,/табличн|Сборка, мин|assemblyMinutes/);
  assert.doesNotMatch(summary,/assemblyMinutes| × |норма сборки/);
  for(const label of ['Гибка','Сварка','Зенковка','Сборка','Подготовка поверхности','Порошковая окраска','Упаковка']) assert.ok(controls.includes(label));
});

test('partial countersink scope remains explicit without raw manufacturing details', () => {
  const {project,part}=fixture();
  const view=createClientCalculationView(project,[{partId:part.id,status:'needs-review',estimatedSalePriceRub:12345,countersinkReviewScope:"priced-count-only",manufacturingWarnings:['PRIVATE factory norm 987654']}]);
  assert.match(view.parts[0].message,/Зенковка учтена только в указанном количестве/);
  assert.match(view.parts[0].message,/Дополнительные зенковки.*отдельной оценки/);
  assert.doesNotMatch(JSON.stringify(view),/PRIVATE|987654/);
});

test('unpriced incomplete countersinks never claim inclusion', () => {
  const {project,part}=fixture();
  const view=createClientCalculationView(project,[{partId:part.id,status:'needs-review',estimatedSalePriceRub:12345,countersinkReviewScope:'not-priced'}]);
  assert.match(view.parts[0].message,/Зенковки распознаны не полностью и не включены/);
  assert.doesNotMatch(view.parts[0].message,/Зенковка учтена/);
});
