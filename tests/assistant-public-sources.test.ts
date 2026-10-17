import assert from "node:assert/strict";
import test from "node:test";
import {
  publicKnowledgeCheckedOn,
  publicKnowledgeSources,
  selfPublishedProductionSnapshot,
} from "../data/assistant-public-source-manifest";
import {
  laserCuttingCapabilities,
  productionEquipment,
  productionScale,
  productionScope,
} from "../data/manufacturing-facts";

test("all approved model knowledge URLs are publicly accessible source addresses", () => {
  assert.match(publicKnowledgeCheckedOn, /^20\d\d-\d\d-\d\d$/);
  const values = Object.values(publicKnowledgeSources);
  assert.equal(new Set(values).size, values.length);
  for (const url of values) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, "https:");
    assert.ok(["www.steelprodukt.ru", "github.com"].includes(parsed.hostname));
    assert.doesNotMatch(parsed.href, /\?|password|token|secret|\/private\//i);
  }
});

test("publicly recorded production numbers agree with approved canonical manufacturing facts", () => {
  assert.deepEqual(selfPublishedProductionSnapshot.equipment, productionEquipment);
  assert.deepEqual(selfPublishedProductionSnapshot.scale, productionScale);
  assert.equal(selfPublishedProductionSnapshot.laser.blackSteelThicknessRange, laserCuttingCapabilities.thicknessRange);
  assert.equal(selfPublishedProductionSnapshot.laser.tableWorkingArea, laserCuttingCapabilities.tableWorkingArea);
  assert.equal(selfPublishedProductionSnapshot.onSiteInstallation, productionScope.onSiteInstallation);
});

test("current public IFC data is referenced by code, never copied from the outdated facts-page summary", () => {
  assert.ok(publicKnowledgeSources.bimCassettesCode.includes("/blob/main/"));
  assert.ok(publicKnowledgeSources.bimTrimsCode.includes("/blob/main/"));
  assert.notEqual(publicKnowledgeSources.bimCassettesCode, publicKnowledgeSources.companyFacts);
  assert.notEqual(publicKnowledgeSources.bimTrimsCode, publicKnowledgeSources.companyFacts);
});