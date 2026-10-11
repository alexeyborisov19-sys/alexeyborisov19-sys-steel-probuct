/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { clampCadZoom, pinchCadZoom } from '../lib/instant-quote/cad-view-controls';
test('spreading fingers brings camera closer and closing fingers moves it away', () => {
  assert.equal(pinchCadZoom(1, 100, 200), 0.5);
  assert.equal(pinchCadZoom(1, 200, 100), 2);
});
test('pinch and wheel share existing bounded camera scale', () => {
  assert.equal(pinchCadZoom(1, 100, 1000), 0.35);
  assert.equal(pinchCadZoom(1, 1000, 100), 4);
  assert.equal(clampCadZoom(0.01), 0.35); assert.equal(clampCadZoom(20), 4);
  for (const distance of [0, -1, NaN, Infinity]) assert.equal(pinchCadZoom(1, 100, distance), 1);
});
test('viewer registers two pointers for pinch and clears cancelled pointers without new buttons', () => {
  const source = readFileSync('components/CadMeshViewer.tsx', 'utf8');
  assert.match(source, /pointersRef\.current\.set\(event\.pointerId/);
  assert.match(source, /pointersRef\.current\.size >= 2/);
  assert.match(source, /zoomRef\.current = pinchCadZoom/);
  assert.match(source, /pointersRef\.current\.delete\(event\.pointerId\)/);
  assert.match(source, /onPointerCancel=\{onPointerUp\}/);
  assert.match(source, /разведите пальцы — масштаб/);
  const audit = readFileSync('scripts/audit-cad-actions-twice.mjs', 'utf8');
  assert.match(audit, /Input\.dispatchTouchEvent/);
  assert.match(audit, /event\.type === 'touch' && event\.trusted/);
  assert.match(audit, /toBeGreaterThan\(initial\.nonzero \* 1\.5\)/);
  assert.match(audit, /page\.mouse\.wheel\(0, 240\)/);
});

test('real viewer handlers preserve rotation through pinch transitions and clean cancelled captures', async () => {
  const refs: { current: any }[] = [];
  const result = await build({ entryPoints: ['components/CadMeshViewer.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic' });
  const require = createRequire(`${process.cwd()}/package.json`);
  const hooks = { useRef: (value: any) => { const ref = { current: value }; refs.push(ref); return ref; }, useMemo: (fn: () => any) => fn(), useEffect: () => {}, useState: (value: any) => [value, () => {}] };
  const bundledModule = { exports: {} as any };
  new Function('require', 'module', 'exports', result.outputFiles![0].text)((id: string) => id === 'react' ? hooks : require(id), bundledModule, bundledModule.exports);
  const tree = bundledModule.exports.CadMeshViewer({ meshes: [{ positions: [0,0,0, 100,0,0, 0,100,0], indices: [0,1,2] }] });
  const canvas = tree.props.children.find((node: any) => node?.type === 'canvas');
  assert.ok(canvas);
  const event = (pointerId: number, clientX: number, clientY = 0) => ({ pointerId, clientX, clientY, currentTarget: { setPointerCapture() {} } });
  canvas.props.onPointerDown(event(1, 0)); canvas.props.onPointerMove(event(1, 10));
  const yaw = refs[1].current;
  canvas.props.onPointerDown(event(2, 110)); canvas.props.onPointerMove(event(2, 210));
  assert.equal(refs[3].current, 0.5); assert.equal(refs[1].current, yaw);
  canvas.props.onPointerUp(event(2, 210)); canvas.props.onPointerMove(event(1, 15));
  assert.equal(refs[1].current, yaw + 5 * 0.008, 'remaining pointer rotates without a stale-coordinate jump');
  canvas.props.onPointerDown(event(2, 15)); canvas.props.onPointerMove(event(2, 15));
  assert.equal(refs[3].current, 0.5, 'zero-distance pinch is harmless');
  canvas.props.onPointerCancel(event(2, 15)); canvas.props.onLostPointerCapture(event(1, 15));
  assert.equal(refs[5].current.size, 0); assert.equal(refs[4].current, null); assert.equal(refs[6].current, null);
  const lastYaw = refs[1].current;
  canvas.props.onPointerMove(event(1, 1000)); assert.equal(refs[1].current, lastYaw);
});
