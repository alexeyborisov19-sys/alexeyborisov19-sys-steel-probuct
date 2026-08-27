import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const globalErrorPath = new URL("../app/global-error.tsx", import.meta.url);

test("global error performs a full document reload for stale client bundles", async () => {
  const source = await readFile(globalErrorPath, "utf8");

  assert.match(source, /window\.location\.reload\(\)/);
  assert.match(source, /ChunkLoadError/);
  assert.match(source, /sessionStorage/);
  assert.match(source, /onClick=\{forceDocumentReload\}/);
  assert.ok(!source.includes("onClick={reset}"), "global error must not retry only the stale React tree");
});
