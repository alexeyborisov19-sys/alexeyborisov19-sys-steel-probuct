import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("production report storage is server-only and outside public web tree", async () => {
  const report = await source("lib/server/instant-quote/private-production-report.ts");
  assert.match(report, /import\s+["']server-only["']/);
  assert.match(report, /STEEL_PRODUCT_PRIVATE_PRODUCTION_REPORT_ROOT/);
  assert.match(report, /0o700/);
  assert.match(report, /0o600/);
  assert.match(report, /must not be stored under public/);
});

test("confidential calculation orchestrator returns only client-safe DTO", async () => {
  const service = await source("lib/server/instant-quote/run-confidential-calculation.ts");
  assert.match(service, /import\s+["']server-only["']/);
  assert.match(service, /writeInternalProductionReport\(report\)/);
  assert.match(service, /const result = createClientCalculationView\(project, signals\)/);
  assert.match(service, /calculationStage\("CLIENT_RESULT_OK"\)/);
  assert.match(service, /return result;/);
  assert.doesNotMatch(service, /return\s+\{[^}]*reportId/);
  assert.doesNotMatch(service, /return\s+\{[^}]*fileName/);
});

test("internal production report pages require authenticated page context", async () => {
  const list = await source("app/(internal)/internal/production-calculations/page.tsx");
  const detail = await source("app/(internal)/internal/production-calculations/[fileName]/page.tsx");
  for (const page of [list, detail]) {
    assert.match(page, /requireProductionPageContext\(["']VIEW_DASHBOARD["']\)/);
    assert.match(page, /force-dynamic/);
  }
});

test("public online-order has no internal production report import", async () => {
  const page = await source("app/(public)/online-order/page.tsx");
  const workspace = await source("components/ClientManufacturingWorkspace.tsx");
  for (const sourceText of [page, workspace]) {
    assert.doesNotMatch(sourceText, /private-production-report/);
    assert.doesNotMatch(sourceText, /private-calculation-basis/);
    assert.doesNotMatch(sourceText, /runConfidentialCalculationForClient/);
  }
});
