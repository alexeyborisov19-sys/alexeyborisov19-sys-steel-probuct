import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { build } from 'esbuild';
import type { useCadProject } from '../components/cad/shared/useCadProject';

// Reconstructed from the reviewed regression's task context, not recovered Git
// bytes. This executes the real hook and helpers with deterministic state slots;
// React scheduling, effects, DOM interaction and browser layout need other gates.
const require = createRequire(`${process.cwd()}/package.json`);
const mockReact = `
  let slots = [], cursor = 0;
  export function useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
  }
  export function useRef(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = { current: initial };
    return slots[i];
  }
  export function useMemo(fn) { cursor++; return fn(); }
  export function useEffect() { cursor++; }
  export function reset() { cursor = 0; }
`;

async function createHarness() {
  const result = await build({
    stdin: {
      contents: `export {useCadProject} from './components/cad/shared/useCadProject'; export {reset} from 'react';`,
      resolveDir: process.cwd(), loader: 'ts',
    },
    write: false, bundle: true, platform: 'node', format: 'cjs', packages: 'external',
    plugins: [{ name: 'deterministic-hook-state', setup(build) {
      build.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'harness' }));
      build.onLoad({ filter: /.*/, namespace: 'harness' }, () => ({ contents: mockReact }));
    } }],
  });
  const bundledModule = { exports: {} as { useCadProject: typeof useCadProject; reset: () => void } };
  new Function('require', 'module', 'exports', result.outputFiles![0].text)(require, bundledModule, bundledModule.exports);
  return bundledModule.exports;
}

const preview = {
  kind: 'client-cad-preview', units: 'mm', format: 'step', status: 'recognized',
  cad: { widthMm: 100, heightMm: 100, depthMm: 3, thicknessFromModelMm: 3, bendCountFromModel: 2, countersinkCountFromModel: 4 },
  meshes: [], root: null, drawing: null, message: 'Synthetic fixture',
};

test('CAD byte budgets reject before project or network mutation and include existing files', async () => {
  const api = await createHarness();
  let hook!: ReturnType<typeof useCadProject>;
  const render = () => { api.reset(); hook = api.useCadProject(false); };
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount++;
    return new Response(JSON.stringify({ ok: true, preview }));
  };
  // Only metadata is under test. Avoid allocating 100 MiB of unused fixture data.
  const sizedFile = (name: string, size: number) => Object.defineProperty(new File(['synthetic'], name), 'size', { value: size });
  const mib = 1024 * 1024;
  try {
    render();
    const oversized = hook.ingestFiles([sizedFile('oversized.step', 50 * mib + 1)]);
    const rejected = assert.rejects(oversized, /50 МБ/);
    render();
    assert.equal(hook.project.parts.length, 0);
    assert.equal(requestCount, 0);
    await rejected;

    await hook.ingestFiles([sizedFile('first.step', 50 * mib)]); render();
    await hook.ingestFiles([sizedFile('second.step', 50 * mib)]); render();
    assert.equal(hook.project.parts.length, 2);
    assert.equal(requestCount, 2);
    const priorProject = hook.project;
    const priorRevision = hook.projectRevision;
    const overflow = hook.ingestFiles([new File(['x'], 'third.step')]);
    const totalRejected = assert.rejects(overflow, /100 МБ/);
    render();
    assert.equal(hook.project, priorProject);
    assert.equal(hook.projectRevision, priorRevision);
    assert.equal(requestCount, 2);
    await totalRejected;
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('CAD hook preserves late edits, cosmetic rename and valid quantity while hiding invalid draft prices', async () => {
  const api = await createHarness();
  let hook!: ReturnType<typeof useCadProject>;
  const render = () => { api.reset(); hook = api.useCadProject(false); };
  const calls: Array<{ url: Parameters<typeof fetch>[0]; options?: RequestInit }> = [];
  let respond!: (response: Pick<Response, 'ok' | 'json'>) => void;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return await new Promise<Response>(resolve => { respond = response => resolve(response as Response); });
  };
  const sendQuote = () => respond({ ok: true, json: async () => ({ ok: true, calculation: {
    kind: 'client-calculation', projectId: hook.project.id, title: 'Original title', paymentEnabled: false,
    parts: [{ partId: hook.activePart!.id, fileName: hook.activePart!.fileName, format: 'step', status: 'ready',
      price: { status: 'approved', totalRub: 12345 }, message: 'Предварительная стоимость позиции: 12 345 ₽.',
      configuration: hook.activePart!.configuration }],
  } }) });
  try {
    render();
    const ingestion = hook.ingestFiles([new File(['synthetic'], 'deferred.step')]);
    render(); hook.updateThickness(4);
    render(); hook.toggleOperation('bending');
    render(); hook.updateOperationInputs({ bendCount: 7 });
    render(); hook.toggleOperation('countersink');
    render(); hook.updateOperationInputs({ countersinkCount: 8 });
    render(); hook.toggleOperation('countersink');
    render();
    respond({ ok: true, json: async () => ({ ok: true, preview }) });
    await ingestion; render();
    assert.equal(hook.thickness, 4);
    assert.equal(hook.activePart!.configuration.operationInputs!.bendCount, 7);
    assert.equal(hook.activePart!.configuration.operationInputs!.countersinkCount, 8);
    assert.equal(hook.activePart!.configuration.operations.includes('countersink'), false);

    const quote = hook.calculateProject(); render();
    const signal = calls.at(-1)!.options!.signal!;
    hook.renameProject('Renamed during calculation'); render();
    assert.equal(signal.aborted, false);
    sendQuote(); await quote; render();
    assert.equal(hook.approvedProjectTotalRub, 12345);
    hook.renameProject('Renamed after calculation'); render();
    assert.equal(hook.approvedProjectTotalRub, 12345);

    for (const draft of ['', '0', '1.9', '100001']) {
      hook.updateQuantity(draft); render();
      assert.equal(hook.quantityDraft, draft);
      assert.equal(hook.quantity, 1);
      assert.equal(hook.calculation, null);
      assert.equal(hook.activeCalculation, null);
      assert.equal(hook.approvedProjectTotalRub, null);
      assert.equal(hook.estimatedProjectTotalRub, null);
      assert.equal(hook.canCalculate, false);
      const href = new URL(hook.quoteHandoffHref, 'https://example.invalid');
      assert.equal(href.searchParams.has('calc'), false);
      assert.equal(href.searchParams.has('total'), false);
      const callCount: number = calls.length;
      await hook.calculateProject();
      assert.equal(calls.length, callCount);
    }
    hook.updateQuantity('1'); render();
    assert.equal(hook.approvedProjectTotalRub, 12345);
    hook.updateQuantity('10'); render();
    assert.equal(hook.quantity, 10);
    assert.equal(hook.calculation, null);
    assert.equal(hook.canCalculate, true);

    const staleQuote = hook.calculateProject(); render();
    hook.updateQuantity('11'); render();
    sendQuote(); await staleQuote; render();
    assert.equal(hook.calculation, null);
    assert.equal(hook.quantity, 11);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
