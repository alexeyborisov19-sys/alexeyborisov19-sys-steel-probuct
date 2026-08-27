import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const globalErrorPath = new URL("../app/global-error.tsx", import.meta.url);

test("global error hard-navigates for stale client bundles", async () => {
  const source = await readFile(globalErrorPath, "utf8");

  assert.match(source, /location\.replace/);
  assert.match(source, /ChunkLoadError/);
  assert.match(source, /sessionStorage/);
  assert.match(source, /hardNavigateFresh/);
  assert.ok(!source.includes("window.location.reload()"), "must not use cache-prone reload()");
});
