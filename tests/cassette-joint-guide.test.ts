import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");
const guide = JSON.parse(read("data/bim/cassette-joints.json")) as {
  cases: Array<{id: string; ownCatalogPages: number[]; sourceIds: string[]; open: string; closed: string; required: string[]; status: string; approvedDrawing: null; assemblyPose: null; geometryCollisionCheck: null; assemblyPathCheck: null}>;
  sources: Array<{id: string; url: string; application: string}>;
  readiness: {scenarioCount: number; approvedAssemblies: number; manufacturerDimensionsAdopted: boolean; competitorGeometryCopied: boolean; substructureInOwnBillOfMaterials: boolean};
};
test("joint research does not promote references to approved assemblies", () => {
  assert.equal(guide.cases.length, 14);
  assert.equal(new Set(guide.cases.map(item => item.id)).size, 14);
  assert.equal(guide.readiness.scenarioCount, 28);
  assert.equal(guide.readiness.approvedAssemblies, 0);
  assert.equal(guide.readiness.manufacturerDimensionsAdopted, false);
  assert.equal(guide.readiness.competitorGeometryCopied, false);
  assert.equal(guide.readiness.substructureInOwnBillOfMaterials, false);
  for (const item of guide.cases) {
    assert.notEqual(item.open, item.closed);
    assert.equal(item.status, "requires-project-verification");
    for (const key of ["approvedDrawing", "assemblyPose", "geometryCollisionCheck", "assemblyPathCheck"] as const) assert.equal(item[key], null);
    assert.equal(item.required.length, 4);
    assert(item.ownCatalogPages.every(page => page >= 7 && page <= 24));
    assert(item.sourceIds.every(id => guide.sources.some(source => source.id === id)));
  }
  for (const source of guide.sources) {
    assert.equal(new URL(source.url).protocol, "https:");
    assert(source.application.length > 40);
  }
});
test("library-first page preserves the facade generator and three independent measurements", () => {
  const page = read("app/(public)/products/metallokassety/bim/page.tsx");
  assert(page.indexOf("<CassetteBimLibrary") < page.indexOf("<CassetteBimConfigurator"));
  assert.equal((page.match(/<CassetteBimConfigurator\s*\/>/g) || []).length, 1);
  assert(page.includes('<CassetteJointGuide />'));
  const component = read("components/CassetteJointGuide.tsx");
  for (const label of ["Лицевой шов", "Монтажный модуль", "Зазор в соединении", "не комплект утверждённых"]) assert(component.includes(label));
  const catalog = read("components/CassetteBimCatalog.tsx");
  for (const label of ["Найти модель", "Сбросить поиск", "IFC4_coordination", "IFC4_exact_geometry"]) assert(catalog.includes(label));
  assert(!/\.rfa["'`]/i.test(catalog));
});
