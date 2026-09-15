import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../components/ClientManufacturingWorkspace.tsx", import.meta.url), "utf8");
// The operation list lives in the control the workspace renders.
const controls = readFileSync(new URL("../components/instant-quote/ClientOperationControls.tsx", import.meta.url), "utf8");

test("public online-order configurator exposes only verified operation claims", () => {
  for (const source of [workspace, controls]) {
    assert.doesNotMatch(source, /id:\s*"threading"/);
    assert.doesNotMatch(source, /id:\s*"countersink"/);
    assert.doesNotMatch(source, />Резьба</);
    assert.doesNotMatch(source, />Зенковка</);
  }

  assert.match(controls, /id:\s*"bending"/);
  assert.match(controls, /id:\s*"welding"/);
  assert.match(controls, /id:\s*"assembly"/);
  assert.match(controls, /id:\s*"surface-preparation"/);
  assert.match(controls, /id:\s*"powder-coating"/);
  assert.match(controls, /id:\s*"packaging"/);

  // The workspace must actually render that control, not its own list.
  assert.match(workspace, /<ClientOperationControls/);
});
