import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("all 15 size-adaptation sources match their fixed IFC files", () => {
  const models = JSON.parse(read("public/bim/metallokassety-parametric/models.json")) as Array<{ id: string; ifcSha256: string; orientedCoordSha256?: string; orientation?: string }>;
  assert.equal(models.length, 15);
  assert.equal(new Set(models.map(model => model.id)).size, 15);
  for (const model of models) {
    assert.match(model.id, /^SP-(CAS|TRIM)-\d{2}$/);
    const content = read(`public/bim/metallokassety/IFC4_coordination/${model.id}.ifc`);
    assert.equal(createHash("sha256").update(content).digest("hex"), model.ifcSha256);
    if (model.orientedCoordSha256) {
      assert(["SP-CAS-01", "SP-CAS-03", "SP-CAS-05"].includes(model.id));
      const oriented = read(`public/bim/metallokassety-oriented/IFC4_coordination/${model.id}.ifc`);
      assert.equal(createHash("sha256").update(oriented).digest("hex"), model.orientedCoordSha256);
      assert.equal(model.orientation, "angled-upper-lock-on-positive-Z");
    }
  }
  for (const file of ["sizing.mjs", "numeric-mesh.mjs", "app.mjs", "renderer.mjs", "style.css", "index.html"]) {
    assert(read(`public/bim/metallokassety-parametric/${file}`).length > 1000, file);
  }
  // The complete boundary/geometry suite runs independently in cassette-ifc-quality.
  assert.match(read(".github/workflows/cassette-ifc-quality.yml"), /node scripts\/test-cassette-parametric\.mjs/);
  assert.match(read(".github/workflows/cassette-ifc-quality.yml"), /validate-cassette-ifcmcp\.py/);
});

test("BIM library links to size adaptation and preserves source downloads", () => {
  // Downloads moved into the reusable client catalog; retain the same checks.
  const source = read("components/CassetteBimLibrary.tsx") + read("components/CassetteBimCatalog.tsx");
  assert.match(source, /metallokassety-parametric\/index\.html/);
  assert.match(source, /Изменить размеры/);
  assert.match(source, /IFC4_coordination/);
  assert.match(source, /IFC4_exact_geometry/);
  assert.match(source, /не параметрические семейства RFA/);
  const html = read("public/bim/metallokassety-parametric/index.html");
  assert.match(html, /type="module" src="app.mjs"/);
  assert.match(html, /noindex,follow/);
});
