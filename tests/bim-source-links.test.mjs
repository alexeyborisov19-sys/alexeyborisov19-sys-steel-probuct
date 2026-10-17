// Behaviour-level controller regression: real selectModel/sourceMesh/fields code,
// with only browser drawing, DOM plumbing and network responses substituted.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';
import { TextEncoder } from 'node:util';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function harness() {
  const elements = new Map();
  class Element {
    constructor() { this.attributes = new Map(); this.children = []; this.value = ''; this.dataset = {}; }
    set id(value) { this._id = value; elements.set(value, this); }
    get id() { return this._id; }
    set href(value) { this.setAttribute('href', value); }
    get href() { return this.getAttribute('href') || ''; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
    removeAttribute(name) { this.attributes.delete(name); }
    addEventListener() {}
    append(...values) { this.children.push(...values); }
    replaceChildren(...values) { this.children = values; }
  }
  const byId = id => {
    if (!elements.has(id)) { const element = new Element(); element.id = id; }
    return elements.get(id);
  };
  const requests = [];
  const sourceTexts = Object.fromEntries(['SP-CAS-02', 'SP-CAS-01', 'SP-CAS-04'].map(id => [id, 'fixture IFC ' + id]));
  const models = Object.entries(sourceTexts).map(([id, text]) => {
    const hash = createHash('sha256').update(text).digest('hex');
    return { id, name: id, category: 'Металлокассета', measured_thickness_mm: 0.7,
      ifcSha256: hash, orientedCoordSha256: id === 'SP-CAS-01' ? hash : null };
  });
  const context = vm.createContext({
    document: { getElementById: byId, createElement: () => new Element(), querySelectorAll: () => [], body: new Element() },
    fetch: url => new Promise((resolve, reject) => requests.push({ url, resolve, reject })),
    crypto: webcrypto, TextEncoder, Uint8Array, URLSearchParams, console,
    fixtures: models,
    readMesh: text => text,
    prepareMesh: () => ({ axes: [500, 20, 600].map(original => ({ original, editable: true, min: 1, max: 2000 })) }),
    resize: (_mesh, dimensions) => ({ stats: { size: dimensions } }),
    createIfc() {}, makeProject() {}, readProject() {}, GeometryViewer: class {},
  });
  const appPath = path.join(__dirname, '../public/bim/metallokassety-parametric/app.mjs');
  const source = fs.readFileSync(appPath, 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/\ninit\(\);\s*$/, '\n');
  vm.runInContext(source + '\nmodels=fixtures;viewer={setGeometry(){},zoom:1};globalThis.controller={selectModel};', context, { filename: appPath });
  async function resolve(id, request = requests[requests.length - 1]) {
    request.resolve({ ok: true, status: 200, text: async () => sourceTexts[id] });
  }
  function links(expectedId, oriented = false) {
    const base = oriented ? 'metallokassety-oriented' : 'metallokassety';
    for (const [id, folder] of [['source-mesh', 'IFC4_coordination'], ['source-exact', 'IFC4_exact_geometry']]) {
      assert.equal(byId(id).getAttribute('href'), `../${base}/${folder}/${expectedId}.ifc`);
      assert.equal(byId(id).getAttribute('aria-disabled'), null);
    }
  }
  function disabledLinks() {
    for (const id of ['source-mesh', 'source-exact']) {
      assert.equal(byId(id).getAttribute('href'), null, id + ' must not point to a previous model');
      assert.equal(byId(id).getAttribute('aria-disabled'), 'true');
    }
  }
  async function loadInitial() {
    const promise = context.controller.selectModel('SP-CAS-02');
    await resolve('SP-CAS-02'); await promise; links('SP-CAS-02');
  }
  return { controller: context.controller, requests, resolve, links, disabledLinks, loadInitial, byId };
}

test('pending source load removes both previous download targets immediately', async () => {
  const h = harness(); await h.loadInitial();
  const pending = h.controller.selectModel('SP-CAS-01');
  h.disabledLinks();
  await h.resolve('SP-CAS-01'); await pending;
  h.links('SP-CAS-01', true);
});

test('failed source load keeps both links disabled and exposes the error', async () => {
  const h = harness(); await h.loadInitial();
  const pending = h.controller.selectModel('SP-CAS-01');
  h.requests[h.requests.length - 1].resolve({ ok: false, status: 503 });
  await pending;
  h.disabledLinks();
  assert.equal(h.byId('error').hidden, false);
  assert.match(h.byId('error').textContent, /503/);
});

test('verified source load enables links for the selected oriented model only', async () => {
  const h = harness();
  const pending = h.controller.selectModel('SP-CAS-01');
  h.disabledLinks(); await h.resolve('SP-CAS-01'); await pending;
  h.links('SP-CAS-01', true);
});

test('late success and late failure cannot replace links for a newer selection', async () => {
  const h = harness(); await h.loadInitial();
  const old = h.controller.selectModel('SP-CAS-01');
  const oldRequest = h.requests[h.requests.length - 1];
  const latest = h.controller.selectModel('SP-CAS-04');
  await h.resolve('SP-CAS-04'); await latest;
  h.links('SP-CAS-04');
  await h.resolve('SP-CAS-01', oldRequest); await old;
  h.links('SP-CAS-04');
  // An old failure must not disable the newer model's valid source links either.
  const h2 = harness();
  const failing = h2.controller.selectModel('SP-CAS-01');
  const failingRequest = h2.requests[h2.requests.length - 1];
  const succeeding = h2.controller.selectModel('SP-CAS-04');
  await h2.resolve('SP-CAS-04'); await succeeding;
  failingRequest.reject(new Error('late failure')); await failing;
  h2.links('SP-CAS-04');
});
