import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const globalErrorPath = new URL("../app/global-error.tsx", import.meta.url);

test("global error hard-navigates home for stale client bundles", async () => {
  const source = await readFile(globalErrorPath, "utf8");

  assert.match(source, /location\.replace/);
  assert.match(source, /ChunkLoadError/);
  assert.match(source, /hardNavigateHome/);
  assert.match(source, /onClick=\{\(\) => reset\(\)\}/);
  assert.ok(!source.includes("window.location.reload()"), "must not use cache-prone reload()");
});

test("automatic stale-build recovery cannot loop forever", async () => {
  const source = await readFile(globalErrorPath, "utf8");

  // A recovery navigation that fails the same way must not start another one,
  // otherwise one missing chunk pins the visitor in an endless reload loop.
  assert.match(source, /sessionStorage/);
  assert.match(source, /canAutoRecover\(\)/);
  assert.match(source, /staleBuildPattern\.test\(signature\) && canAutoRecover\(\)/);
  assert.match(source, /markAutoRecovery\(\)/);

  // Storage can throw in restricted browser modes. Refusing to auto-navigate is
  // the only safe answer there, because the loop guard would not be readable.
  assert.match(source, /catch \{[\s\S]*?return false;/);
});

test("recovery keeps the visitor on the page they requested", async () => {
  const source = await readFile(globalErrorPath, "utf8");

  assert.match(source, /hardReloadCurrent/);
  assert.match(source, /window\.location\.pathname/);
  // Cache-busting must replace the previous marker instead of appending to it.
  assert.match(source, /searchParams\.set\("_sp"/);
  assert.ok(
    !source.includes('"/?_sp=" + Date.now()'),
    "must not hard-code the homepage as the recovery target",
  );
});
