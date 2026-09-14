import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../components/ManufacturingWorkspace.tsx", import.meta.url), "utf8");

test("public online-order configurator exposes only verified operation claims", () => {
  assert.doesNotMatch(workspace, /id:\s*"threading"/);
  assert.doesNotMatch(workspace, /id:\s*"countersink"/);
  assert.doesNotMatch(workspace, />Резьба</);
  assert.doesNotMatch(workspace, />Зенковка</);

  assert.match(workspace, /id:\s*"bending"/);
  assert.match(workspace, /id:\s*"welding"/);
  assert.match(workspace, /id:\s*"assembly"/);
  assert.match(workspace, /id:\s*"surface-preparation"/);
  assert.match(workspace, /id:\s*"powder-coating"/);
  assert.match(workspace, /id:\s*"packaging"/);
});
