import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { before } from 'node:test';

type Run = { width: number; replay: number; status: string; evidence: unknown };
type Action = { id: string; scenario: string; assertion: string; owner: string; runs: Run[] };
type Matrix = { actions: Action[]; delegated: { id: string; owner: string; runs: Run[] }[] };
type Inventory = {
  CAD_ACTIONS: Omit<Action, 'runs'>[];
  CAD_ACTION_VIEWPORTS: number[];
  CAD_ACTION_REPLAYS: number[];
  createPendingCadActionMatrix: () => Matrix;
  localCandidateOrigin: (value?: string) => string;
  recordCadAction: (matrix: Matrix, id: string, width: number, replay: number, status: string, evidence: unknown) => void;
  cadActionSummary: (matrix: Matrix) => Record<string, number>;
  applyDelegatedCoreEvidence: (matrix: Matrix, report: unknown, options: { executionGroup: string | null; candidate: unknown; now?: string }) => { accepted: boolean; reason: string };
};
let inventory: Inventory;
let runner: { CAD_ACTION_SCENARIOS: Record<string, unknown> };
before(async () => {
  inventory = await import(new URL('../scripts/cad-action-matrix.mjs', import.meta.url).href) as Inventory;
  runner = await import(new URL('../scripts/audit-cad-actions-twice.mjs', import.meta.url).href) as typeof runner;
});
const source = readFileSync(new URL('../scripts/audit-cad-actions-twice.mjs', import.meta.url), 'utf8');
const core = readFileSync(new URL('../scripts/audit-cad-input-workflow.mjs', import.meta.url), 'utf8');

test('CAD action plan names every implemented family and starts 156 independent mobile/desktop cells pending', () => {
  const matrix = inventory.createPendingCadActionMatrix();
  assert.equal(matrix.actions.length, 39);
  assert.equal(new Set(matrix.actions.map(action => action.id)).size, 39);
  assert.deepEqual(inventory.CAD_ACTION_VIEWPORTS, [360, 1440]);
  assert.deepEqual(inventory.CAD_ACTION_REPLAYS, [1, 2]);
  assert.deepEqual(inventory.cadActionSummary(matrix), { pending: 156, pass: 0, fail: 0, unavailable: 0 });
  for (const action of matrix.actions) {
    assert.equal(typeof runner.CAD_ACTION_SCENARIOS[action.scenario], 'function', `${action.id} must have an executable scenario`);
    assert.ok(action.assertion.length > 30);
    assert.equal(action.owner, 'audit-cad-actions-twice.mjs');
    assert.deepEqual(action.runs.map(({ width, replay, status, evidence }) => [width, replay, status, evidence]), [
      [360, 1, 'pending', null], [360, 2, 'pending', null], [1440, 1, 'pending', null], [1440, 2, 'pending', null],
    ]);
    if (!action.id.startsWith('operation-') || ['operation-counts-unknown', 'operation-sides-unknown'].includes(action.id)) {
      assert.ok(source.includes(`await step('${action.id}'`), `${action.id} must be executed through the assertion recorder`);
    }
  }
  assert.deepEqual(Object.keys(runner.CAD_ACTION_SCENARIOS).sort(), [...new Set(matrix.actions.map(action => action.scenario))].sort());
});

test('all seven processing toggles and numeric/sides unknown states have individual action coverage', () => {
  const ids = inventory.CAD_ACTIONS.filter(action => action.scenario === 'operations').map(action => action.id);
  assert.deepEqual(ids, ['operation-bending', 'operation-welding', 'operation-countersink', 'operation-assembly', 'operation-surface-preparation', 'operation-powder-coating', 'operation-packaging', 'operation-counts-unknown', 'operation-sides-unknown']);
  assert.ok(source.includes('await step(`operation-${id}`'));
  assert.match(source, /Disabled operation inputs must not leak into the manifest/);
  for (const key of ['bendCount', 'weldLengthM', 'countersinkCount', 'surfacePreparationSides', 'powderSides']) assert.ok(source.includes(key));
  assert.ok(source.includes('Не знаю — уточнит инженер'));
});

test('assembly replay asserts selection-only UI and no customer time in requests or project JSON', () => {
  const operations = source.slice(source.indexOf('async operations('), source.indexOf('async preview2d('));
  assert.match(operations, /\['assembly', 'Сборка', null\]/);
  assert.match(operations, /if \(id === 'assembly'\)/);
  assert.match(operations, /getByRole\('spinbutton'\)\)\.toHaveCount\(0\)/);
  assert.match(operations, /getByLabel\('Сборка, мин на деталь', \{ exact: true \}\)\)\.toHaveCount\(0\)/);
  assert.ok(operations.includes("toContainText('Состав сборки и окончательную стоимость уточнит специалист.')"));
  assert.match(operations, /Object\.hasOwn\(part\.operationInputs, 'assemblyMinutes'\), false/);
  assert.match(operations, /saved\.positions\[0\]\.configuration\.operations\.includes\('assembly'\)/);
  assert.match(operations, /Object\.hasOwn\(saved\.positions\[0\]\.configuration\.operationInputs, 'assemblyMinutes'\), false/);
  const numericInputs = operations.slice(operations.indexOf("await step('operation-counts-unknown'"), operations.indexOf("await step('operation-sides-unknown'"));
  assert.doesNotMatch(numericInputs, /assemblyMinutes|Сборка/);
  assert.deepEqual([...numericInputs.matchAll(/'([^']+)', '[0-9.]+'\]/g)].map(match => match[1]), ['bendCount', 'weldLengthM', 'countersinkCount']);
});

test('CAD browser replay rejects non-loopback origins and ambiguous URL forms before launch', () => {
  for (const value of ['https://steel-product.example', 'http://localhost.evil.example', 'http://localhost@evil.example', 'http://example.com@localhost', 'file:///tmp/example', 'ftp://localhost', 'http://localhost/path', 'http://localhost?target=remote', 'http://localhost#fragment']) {
    assert.throws(() => inventory.localCandidateOrigin(value), /loopback-only/);
  }
  for (const value of ['http://localhost:3106', 'http://127.0.0.1:3106', 'http://[::1]:3106', 'https://localhost:3443/']) {
    assert.equal(inventory.localCandidateOrigin(value), new URL(value).origin);
  }
  assert.ok(source.indexOf('const origin = localCandidateOrigin(') < source.indexOf('browser = await chromium.launch('));
  assert.ok(source.indexOf('if (planOnly) {') < source.indexOf('browser = await chromium.launch('));
});

test('CAD replay blocks all real writes/external traffic and sockets without an endpoint exception', () => {
  const routes = source.slice(source.indexOf('async function installSafetyRoutes'), source.indexOf('await context.addInitScript'));
  assert.match(routes, /url\.origin !== origin/);
  assert.match(routes, /return route\.abort\('blockedbyclient'\)/);
  assert.match(routes, /!\['GET', 'HEAD'\]\.includes\(request\.method\(\)\)/);
  assert.match(routes, /return route\.fulfill\(\{ status: 503/);
  assert.doesNotMatch(routes, /cad\/analyze|online-order\/calculate/);
  assert.match(routes, /routeWebSocket\('\*\*\/\*'/);
  assert.match(source, /serviceWorkers: 'block'/);
  assert.match(source, /assert\.deepEqual\(traffic\.blockedWrites, \[\]/);
  assert.match(source, /Navigation must not submit a lead/);
});

test('CAD result recorder refuses empty evidence, unknown actions and replacing a recorded result', () => {
  const matrix = inventory.createPendingCadActionMatrix();
  const id = matrix.actions[0].id;
  assert.throws(() => inventory.recordCadAction(matrix, id, 360, 1, 'pass', null), /evidence/);
  assert.throws(() => inventory.recordCadAction(matrix, 'invented-action', 360, 1, 'pass', {}), /Unknown/);
  assert.throws(() => inventory.recordCadAction(matrix, id, 480, 1, 'pass', {}), /Unknown/);
  assert.throws(() => inventory.recordCadAction(matrix, id, 360, 1, 'pending', {}), /executed/);
  const evidence = { finishedAt: '2026-10-11T00:00:00.000Z', detail: 'Unit fixture tests recorder state only; not browser evidence.' };
  inventory.recordCadAction(matrix, id, 360, 1, 'unavailable', evidence);
  assert.equal(matrix.actions[0].runs[0].status, 'unavailable');
  assert.throws(() => inventory.recordCadAction(matrix, id, 360, 1, 'pass', evidence), /already recorded/);
  assert.deepEqual(inventory.cadActionSummary(matrix), { pending: 155, pass: 0, fail: 0, unavailable: 1 });
  // A fresh plan cannot inherit any of the recorder fixture's state.
  assert.deepEqual(inventory.cadActionSummary(inventory.createPendingCadActionMatrix()), { pending: 156, pass: 0, fail: 0, unavailable: 0 });
});

test('source existence never marks delegated core checks or absent reports as passed', () => {
  const delegated = inventory.createPendingCadActionMatrix().delegated;
  assert.deepEqual(delegated.map(action => action.id), ['late-step-no-overwrite', 'byte-upload-budgets', 'axe-layout-runtime', 'price-hidden-invalid-and-unpriced']);
  for (const action of delegated) {
    assert.equal(action.owner, 'audit-cad-input-workflow.mjs');
    assert.ok(action.runs.every(run => run.status === 'pending' && run.evidence === null));
  }
  assert.deepEqual(delegated.find(action => action.id === 'byte-upload-budgets')!.runs.map(run => [run.width, run.replay]), [[360, 1], [360, 2], [1440, 1], [1440, 2]]);
  assert.match(core, /for \(const pass of \[1, 2\]\)/);
  assert.match(core, /for \(const width of \[360, 480, 1440\]\)/);
  assert.match(core, /if \(\[360, 1440\]\.includes\(width\)\)/);
  assert.ok(core.indexOf('results.push(') > core.indexOf('assert.deepEqual(errors, [])'));
  assert.match(core, /width, pass, passed: true, syntheticOnly: true/);
  assert.match(source, /Delegated cells remain pending/);
});

test('restore, PDF and synthetic 3D coverage assert real outputs rather than only clicks', () => {
  assert.match(source, /createHash\('sha256'\)\.update\(uploadBytes\)/);
  assert.match(source, /wrong\[0\] \^= 1/);
  assert.match(source, /A matching name and size must not bypass SHA-256/);
  assert.match(source, /Digest match still requires fresh CAD analysis/);
  assert.match(source, /Manual source must be regenerated and reanalysed/);
  assert.match(source, /await page\.pdf\(/);
  assert.match(source, /'%PDF-'/);
  assert.match(source, /gl\.readPixels\(/);
  assert.match(source, /throw new UnavailableEvidence\('WebGL2 unavailable/);
  assert.match(source, /await assertions\(\);\s*recordCadAction\(matrix, id, width, replay, 'pass'/);
  assert.match(source, /for \(const width of CAD_ACTION_VIEWPORTS\) for \(const replay of CAD_ACTION_REPLAYS\) for/);
  assert.match(source, /context = await browser\.newContext/);
  assert.match(source, /await context\.close\(\)/);
});

test('CAD results identify the exact candidate, unique run and dirty source fingerprint without importing old artifacts', () => {
  assert.match(source, /process\.env\.GITHUB_SHA/);
  assert.match(source, /\['rev-parse', 'HEAD'\]/);
  assert.match(source, /\['status', '--porcelain'\]/);
  assert.match(source, /sourceFingerprint: createHash\('sha256'\)/);
  assert.match(source, /randomUUID\(\)/);
  assert.match(source, /matrix\.execution = planOnly \? 'not-started-plan-only'/);
  assert.match(source, /executed-local-actions-pass-delegated-pending/);
  assert.match(source, /applyDelegatedCoreEvidence\(matrix, coreReport/);
  assert.match(source, /matrix\.execution !== 'executed-all-declared-actions-pass'/);
});

function coreEvidenceFixture() {
  const candidate = { gitHead: 'a'.repeat(40), githubSha: null, sourceFingerprint: 'b'.repeat(64) };
  const report = {
    kind: 'cad-core-evidence', candidate, executionGroup: 'unit-fixture-never-browser-evidence',
    startedAt: '2026-10-11T00:00:00.000Z', finishedAt: '2026-10-11T00:01:00.000Z',
    results: [360, 480, 1440].flatMap(width => [1, 2].map(pass => ({ width, pass, passed: true, syntheticOnly: true,
      actions: ['late-step-no-overwrite', 'axe-layout-runtime', 'price-hidden-invalid-and-unpriced', ...(width === 480 ? [] : ['byte-upload-budgets'])] }))),
  };
  return { report, options: { executionGroup: report.executionGroup, candidate, now: '2026-10-11T00:02:00.000Z' } };
}

test('delegated evidence admits only complete exact-candidate action cells from the same explicit execution group', () => {
  const matrix = inventory.createPendingCadActionMatrix();
  const { report, options } = coreEvidenceFixture();
  assert.deepEqual(inventory.applyDelegatedCoreEvidence(matrix, report, options), { accepted: true, reason: 'Exact-candidate core assertions matched every delegated cell.' });
  const delegated = matrix.delegated.flatMap(action => action.runs);
  assert.equal(delegated.length, 22);
  assert.ok(delegated.every(run => run.status === 'pass' && run.evidence !== null));
  assert.deepEqual(inventory.cadActionSummary(matrix), { pending: 156, pass: 0, fail: 0, unavailable: 0 }, 'Core evidence cannot mark unexecuted complementary browser actions passed');
  assert.equal(inventory.applyDelegatedCoreEvidence(matrix, report, options).accepted, false, 'Never overwrite an admitted result');
});

test('missing, stale-group, wrong-candidate, malformed and incomplete core reports leave every delegated cell pending', () => {
  const cases: Array<(fixture: ReturnType<typeof coreEvidenceFixture>) => void> = [
    fixture => { fixture.report.kind = 'legacy-array'; },
    fixture => { fixture.report.executionGroup = 'previous-run'; },
    fixture => { fixture.options.executionGroup = ''; },
    fixture => { fixture.report.candidate = { ...fixture.report.candidate, gitHead: 'c'.repeat(40) }; },
    fixture => { fixture.report.candidate = { ...fixture.report.candidate, sourceFingerprint: 'd'.repeat(64) }; },
    fixture => { Object.assign(fixture.report.candidate = { ...fixture.report.candidate }, { githubSha: 'e'.repeat(40) }); },
    fixture => { fixture.report.startedAt = 'invalid'; },
    fixture => { fixture.report.finishedAt = '2026-10-11T00:00:00.000Z'; fixture.report.startedAt = '2026-10-11T00:01:00.000Z'; },
    fixture => { fixture.report.finishedAt = '2099-01-01T00:00:00.000Z'; },
    fixture => { fixture.report.results.pop(); },
    fixture => { fixture.report.results[1] = { ...fixture.report.results[0] }; },
    fixture => { fixture.report.results[0].passed = false; },
    fixture => { fixture.report.results[0].syntheticOnly = false; },
    fixture => { fixture.report.results[0].actions = ['late-step-no-overwrite']; },
    fixture => { fixture.report.results[0].width = 390; },
  ];
  for (const mutate of cases) {
    const fixture = coreEvidenceFixture(); mutate(fixture);
    const matrix = inventory.createPendingCadActionMatrix();
    assert.equal(inventory.applyDelegatedCoreEvidence(matrix, fixture.report, fixture.options).accepted, false);
    assert.ok(matrix.delegated.flatMap(action => action.runs).every(run => run.status === 'pending' && run.evidence === null));
  }
  for (const report of [null, {}, [], { kind: 'cad-core-evidence' }]) {
    const matrix = inventory.createPendingCadActionMatrix();
    assert.equal(inventory.applyDelegatedCoreEvidence(matrix, report, coreEvidenceFixture().options).accepted, false);
    assert.ok(matrix.delegated.flatMap(action => action.runs).every(run => run.status === 'pending'));
  }
  const fixture = coreEvidenceFixture();
  assert.equal(inventory.applyDelegatedCoreEvidence(inventory.createPendingCadActionMatrix(), fixture.report, { ...fixture.options, executionGroup: null }).accepted, false);
});
