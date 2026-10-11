import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const hook = () => readFile(new URL('../components/cad/shared/useCadProject.ts', import.meta.url), 'utf8');
const workspace = () => readFile(new URL('../components/ClientManufacturingWorkspace.tsx', import.meta.url), 'utf8');
test('CAD checks the complete byte budget before ingestion', async () => {
  const source = await hook();
  const ingest = source.slice(source.indexOf('const ingestFiles ='), source.indexOf('const restoreProject ='));
  assert.match(ingest, /validateCadUploadBudget\(/);
  assert.ok(ingest.indexOf('validateCadUploadBudget(') < ingest.indexOf('ingestLock.current=true'));
});
test('quantity draft has an explicit accessible error instead of silent coercion', async () => {
  const source = await workspace();
  assert.match(source, /value=\{quantityDraft\}/);
  assert.match(source, /aria-invalid=\{Boolean\(quantityError\)\}/);
  assert.match(source, /id="part-quantity-error"/);
  assert.doesNotMatch(source, /updateQuantity\(Number\(event.target.value\)\)/);
});
test('late analysis retains fields explicitly edited by the customer', async () => {
  const source = await hook();
  assert.match(source, /applyCadDetectedConfiguration\(/);
  assert.match(source, /editedFieldsByPartId/);
});
test('project rename cannot invalidate or abort a manufacturing quote', async () => {
  const source = await hook();
  const rename = source.slice(source.indexOf('const renameProject ='), source.indexOf('const onChange ='));
  assert.doesNotMatch(rename, /dropStaleCalculation|abort|calculationEpoch/);
});
test('mobile parameters precede preview and processing choices remain exposed', async () => {
  const source = await workspace();
  assert.match(source, /order-first[^"\n]*lg:order-last/);
  assert.doesNotMatch(source, /<summary[^>]*>[^\n]*Дополнительная обработка/);
  assert.match(source, /<ClientOperationControls/);
});

import { CAD_INPUT_LIMITS, validateCadUploadBudget, parseCadQuantityDraft, applyCadDetectedConfiguration } from '../lib/instant-quote/cad-input-workflow';
import { cadUploadLimits } from '../lib/security/uploads';
import { createEmptyProject } from '../lib/instant-quote/domain';
import { addPartToProject } from '../lib/instant-quote/project';
test('client upload limits equal unchanged server limits and count existing positions', () => {
  assert.equal(CAD_INPUT_LIMITS.maximumFileBytes, cadUploadLimits.maximumFileBytes);
  assert.equal(CAD_INPUT_LIMITS.maximumTotalBytes, cadUploadLimits.maximumTotalBytes);
  const size = 50 * 1024 * 1024;
  assert.doesNotThrow(() => validateCadUploadBudget([{ name: 'a.step', size }, { name: 'b.step', size }], 0));
  assert.throws(() => validateCadUploadBudget([{ name: 'a.step', size: size + 1 }], 0), /50 МБ/);
  assert.throws(() => validateCadUploadBudget([{ name: 'a.step', size }], size + 1), /100 МБ/);
});
test('quantity rejects invalid drafts without rounding and accepts both bounds', () => {
  for (const value of ['', '0', '-1', '1.9', '100001', 'Infinity', '1e3', ' 2 ']) {
    assert.equal(parseCadQuantityDraft(value).value, null, value);
    assert.ok(parseCadQuantityDraft(value).error, value);
  }
  for (const value of ['1', '7', '100000']) assert.equal(parseCadQuantityDraft(value).value, Number(value));
});
test('automatic defaults only fill untouched fields without mutating unrelated operations', () => {
  let project = addPartToProject(createEmptyProject(), { fileName: 'fixture.step', fileSizeBytes: 20 });
  const id = project.activePartId!;
  project = { ...project, parts: project.parts.map(part => ({ ...part, configuration: { ...part.configuration, thicknessMm: 2, operations: ['laser-cutting', 'welding'], operationInputs: { bendCount: 7, countersinkCount: 9, weldLengthM: 3 } } })) };
  const detected = { thicknessFromModelMm: 3, bendCountFromModel: 4, countersinkCountFromModel: 6 };
  assert.deepEqual(applyCadDetectedConfiguration(project, id, detected, new Set(['thickness', 'bending', 'countersink'])), project);
  const automatic = applyCadDetectedConfiguration(project, id, detected).parts[0].configuration;
  assert.equal(automatic.thicknessMm, 3);
  assert.equal(automatic.operationInputs?.bendCount, 4);
  assert.equal(automatic.operationInputs?.countersinkCount, 9);
  assert.equal(automatic.operationInputs?.weldLengthM, 3);
  assert.deepEqual(automatic.operations, ['laser-cutting', 'welding', 'bending', 'countersink']);
  assert.deepEqual(project.parts[0].configuration.operations, ['laser-cutting', 'welding']);
});
