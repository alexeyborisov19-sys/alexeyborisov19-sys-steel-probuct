import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyProject, type InstantQuoteProject } from '../lib/instant-quote/domain';
import { addPartToProject } from '../lib/instant-quote/project';
import { createManualSheetDxf, readManualSheetDxf } from '../lib/instant-quote/manual-sheet';
import { createCadProjectFile, parseCadProjectFile, prepareCadProjectRestore, verifyCadAttachment, MAX_PROJECT_FILE_BYTES } from '../lib/instant-quote/project-file';

const manualInput = { lengthMm: 400, widthMm: 350, holes: true, holeGroups: [{ count: 4, diameterMm: 10 }, { count: 2, diameterMm: 20 }] };
function fixture() {
  const manual = new File([createManualSheetDxf(manualInput)], 'Пластина — по габаритам.dxf', { lastModified: 123 });
  const cad = new File(['solid-source'], 'original.step', { lastModified: 456 });
  let project = addPartToProject(createEmptyProject(new Date(1000)), { fileName: manual.name, fileSizeBytes: manual.size }, new Date(1001));
  project = addPartToProject(project, { fileName: cad.name, fileSizeBytes: cad.size }, new Date(1002));
  project.title = 'Корпус, ревизия А';
  project.parts[0].configuration = { materialId: 'zinc', thicknessMm: 1.5, quantity: 25, operations: ['laser-cutting', 'bending', 'welding', 'powder-coating', 'countersink'], operationInputs: { bendCount: 2, weldLengthM: 0.4, powderSides: 2, countersinkCount: 6 } };
  project.parts[1].configuration.materialId = 'cold';
  project.parts[1].geometry = { widthMm: 999, cutLengthMm: 888 };
  project.parts[1].quote = { kind: 'calculated', totalRub: 12345, unitRub: 12345, calculatedAt: '2026-10-01' };
  return { project, files: { [project.parts[0].id]: manual, [project.parts[1].id]: cad }, cad };
}

test('mixed project round trip preserves inputs and regenerated manual source but never trusts imported CAD geometry or price', async () => {
  const { project, files } = fixture();
  const saved = await createCadProjectFile(project, files, {}, 7);
  const serialized = JSON.stringify(saved);
  for (const forbidden of ['solid-source', '12345', 'cutLengthMm', 'calculatedAt', 'projectId', 'geometry', 'quote']) assert.ok(!serialized.includes(forbidden), forbidden);
  const decoded = parseCadProjectFile(serialized);
  assert.equal(decoded.revision, 7);
  assert.equal(decoded.title, 'Корпус, ревизия А');
  const restored = prepareCadProjectRestore(decoded);
  assert.equal(restored.project.title, project.title);
  assert.equal(restored.project.parts.length, 2);
  assert.deepEqual(restored.project.parts[0].configuration, project.parts[0].configuration);
  assert.equal(restored.project.activePartId, restored.project.parts[1].id);
  assert.notEqual(restored.project.id, project.id);
  for (const part of restored.project.parts) { assert.equal(part.geometry, null); assert.deepEqual(part.quote, { kind: 'not-requested' }); assert.equal(part.state, 'queued'); }
  assert.equal(Object.keys(restored.filesByPartId).length, 1);
  assert.equal(restored.filesByPartId[restored.project.parts[1].id], undefined);
  assert.deepEqual(readManualSheetDxf(await restored.filesByPartId[restored.project.parts[0].id].text()), manualInput);
  const resaved = await createCadProjectFile(restored.project, restored.filesByPartId, restored.sourcesByPartId, 7);
  assert.deepEqual(resaved.positions, decoded.positions);
});

test('attachment matching verifies content, including same name size and timestamp with different bytes', async () => {
  const { project, files, cad } = fixture();
  const saved = await createCadProjectFile(project, files, {}, 1);
  const source = saved.positions[1].source;
  assert.equal(source.kind, 'cad');
  if (source.kind !== 'cad') throw new Error('Expected CAD');
  await verifyCadAttachment(cad, source.attachment);
  await verifyCadAttachment(new File(['solid-source'], cad.name, { lastModified: 999 }), source.attachment);
  await assert.rejects(verifyCadAttachment(new File(['other-source'], cad.name, { lastModified: cad.lastModified }), source.attachment), /содержим/i);
  await assert.rejects(verifyCadAttachment(new File(['solid-source'], 'renamed.step'), source.attachment), /имя/i);
});

test('project validation rejects old or future schemas, corrupt JSON, hidden authority and oversized or unbounded inputs', async () => {
  const { project, files } = fixture();
  const good = await createCadProjectFile(project, files, {}, 1);
  const rejected: unknown[] = [null, [], {}, { ...good, schemaVersion: 0 }, { ...good, schemaVersion: 2 }, { ...good, calculationId: 'forged' }, { ...good, positions: [] }, { ...good, positions: Array(6).fill(good.positions[0]) }, { ...good, revision: 1e100 }, { ...good, activePosition: 6 }];
  const change = (fn: (copy: typeof good) => void) => { const copy = structuredClone(good); fn(copy); rejected.push(copy); };
  change(copy => { copy.positions[0].configuration.quantity = 100001; });
  change(copy => { copy.positions[0].configuration.operations.push('threading'); });
  change(copy => { copy.positions[0].configuration.operationInputs = { bendCount: 0.5 }; });
  change(copy => { copy.positions[0].configuration.materialId = 'invented'; });
  change(copy => { if (copy.positions[0].source.kind === 'manual') copy.positions[0].source.input.lengthMm = 1e100; });
  change(copy => { if (copy.positions[1].source.kind === 'cad') copy.positions[1].source.attachment.sha256 = 'invalid'; });
  change(copy => { if (copy.positions[1].source.kind === 'cad') copy.positions[1].source.attachment.fileName = '../../evil.step'; });
  change(copy => { if (copy.positions[1].source.kind === 'cad') copy.positions[1].source.attachment.sizeBytes = 51 * 1024 * 1024; });
  for (const bad of rejected) assert.throws(() => parseCadProjectFile(JSON.stringify(bad)));
  for (const raw of ['{', '{"__proto__":{"polluted":true}}', '['.repeat(10000), ' '.repeat(MAX_PROJECT_FILE_BYTES + 1)]) assert.throws(() => parseCadProjectFile(raw));
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
  assert.deepEqual(project.parts[1].quote.kind, 'calculated');
});

test('validating the whole restore is atomic and rejects missing CAD source rather than inventing a manifest', async () => {
  const { project, files } = fixture();
  const original = structuredClone(project);
  await assert.rejects(createCadProjectFile(project, {}, {}, 1), /исходн/i);
  assert.deepEqual(project, original);
  const good = await createCadProjectFile(project, files, {}, 1);
  const forged = { ...good, positions: good.positions.map(position => ({ ...position, geometry: { widthMm: 1 } })) };
  assert.throws(() => prepareCadProjectRestore(forged as unknown as typeof good));
  assert.deepEqual(project, original);
});

test('legacy manual declarations remain resumable without treating them as production drawings', async () => {
  const input = { lengthMm: 400, widthMm: 350, holes: true, holeCount: 2, holeDiameterMm: 10 };
  const file = new File([createManualSheetDxf(input)], 'legacy.dxf');
  const project: InstantQuoteProject = addPartToProject(createEmptyProject(), { fileName: file.name, fileSizeBytes: file.size });
  const saved = await createCadProjectFile(project, { [project.parts[0].id]: file }, {}, 1);
  const restored = prepareCadProjectRestore(parseCadProjectFile(JSON.stringify(saved)));
  assert.deepEqual(readManualSheetDxf(await Object.values(restored.filesByPartId)[0].text()), input);
  assert.equal(restored.project.parts[0].geometry, null);
});

test('five CAD positions retain distinct attachment slots even when source names match', async () => {
  let project = createEmptyProject();
  const files: Record<string, File> = {};
  for (let index = 0; index < 5; index++) {
    const file = new File([`revision-${index}`], 'same-name.dxf', { lastModified: 123 });
    project = addPartToProject(project, { fileName: file.name, fileSizeBytes: file.size });
    files[project.activePartId!] = file;
  }
  const restored = prepareCadProjectRestore(await createCadProjectFile(project, files, {}, 1));
  assert.equal(new Set(restored.project.parts.map(part => part.id)).size, 5);
  assert.equal(Object.keys(restored.sourcesByPartId).length, 5);
  assert.deepEqual(restored.filesByPartId, {});
  const sources = Object.values(restored.sourcesByPartId);
  assert.equal(sources[0].kind, 'cad');
  assert.equal(sources[1].kind, 'cad');
  if (sources[0].kind === 'cad' && sources[1].kind === 'cad') assert.notEqual(sources[0].attachment.sha256, sources[1].attachment.sha256);
});

test('all operation inputs survive independently, including large bounded hole groups', async () => {
  const { project, files } = fixture();
  project.parts[0].configuration.operations = ['laser-cutting', 'bending', 'countersink', 'welding', 'assembly', 'powder-coating', 'surface-preparation', 'packaging'];
  project.parts[0].configuration.operationInputs = { bendCount: 3, countersinkCount: 2000, weldLengthM: 1.5, assemblyMinutes: 12.5, powderSides: 1, surfacePreparationSides: 2 };
  const saved = await createCadProjectFile(project, files, {}, 1);
  assert.deepEqual(prepareCadProjectRestore(saved).project.parts[0].configuration.operationInputs, { bendCount: 3, countersinkCount: 2000, weldLengthM: 1.5, assemblyMinutes: 12.5, powderSides: 1, surfacePreparationSides: 2 });
  const large = new File([createManualSheetDxf({ lengthMm: 10000, widthMm: 10000, holes: true, holeGroups: [{ count: 200000, diameterMm: 1 }] })], files[project.parts[0].id].name);
  const largeSaved = await createCadProjectFile(project, { ...files, [project.parts[0].id]: large }, {}, 1);
  const restored = prepareCadProjectRestore(largeSaved);
  const input = readManualSheetDxf(await restored.filesByPartId[restored.project.parts[0].id].text());
  assert.ok(input && 'holeGroups' in input);
  assert.equal(input.holeGroups[0].count, 200000);
});

test('project source budget and nested unknown keys fail before restore, not after partial state application', async () => {
  const { project, files } = fixture();
  const good = await createCadProjectFile(project, files, {}, 1);
  const cad = good.positions[1];
  if (cad.source.kind !== 'cad') throw new Error('Expected CAD');
  const attachment = cad.source.attachment;
  const large = { ...cad, source: { kind: 'cad', attachment: { ...attachment, sizeBytes: 40 * 1024 * 1024 } } };
  assert.throws(() => parseCadProjectFile(JSON.stringify({ ...good, positions: [large, large, large] })), /100 МБ/);
  const oversized = JSON.stringify({ ...good, title: 'я'.repeat(40_000) });
  assert.throws(() => parseCadProjectFile(oversized), /64 КБ/);
  const polluted = JSON.stringify(good).replace('"bendCount":2', '"__proto__":{"polluted":true},"bendCount":2');
  assert.throws(() => parseCadProjectFile(polluted));
  assert.throws(() => parseCadProjectFile(JSON.stringify({ ...good, positions: [{ ...cad, configuration: { ...cad.configuration, privateRate: 5 } }] })));
  assert.throws(() => parseCadProjectFile(JSON.stringify({ ...good, positions: [{ ...cad, source: { kind: 'cad', attachment: { ...attachment, content: 'embedded source' } } }] })));
});
