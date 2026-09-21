import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { uploadLimits } from "@/lib/security/uploads";

const workspacePath = new URL("../components/cad/shared/useCadProject.ts", import.meta.url);
const formPath = new URL("../components/QuoteRequestForm.tsx", import.meta.url);
const manifestPath = new URL("../lib/instant-quote/calculation-manifest.ts", import.meta.url);

test("the browser stops at the same project size the server enforces", async () => {
  const [workspace, manifest] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile(manifestPath, "utf8"),
  ]);

  // The manifest refuses an eleventh position. Without the same ceiling in the
  // browser, adding one silently breaks the whole project at calculate time
  // rather than the one file that did not fit.
  assert.match(manifest, /parts\.length > 10/);
  assert.match(workspace, /const MAX_PROJECT_PARTS = 10;/);
  assert.match(workspace, /files\.slice\(0, Math\.max\(0, room\)\)/);
  assert.equal(uploadLimits.maximumFiles, 10);
});

test("the public CAD workspace starts a new uploaded part with the priced cold-rolled option", async () => {
  const workspace = await readFile(workspacePath, "utf8");

  assert.match(workspace, /setPartMaterial\(nextProject, partId, "cold", addedAt\)/);
});

test("a thickness read from the model is selected, not left at the default", async () => {
  const workspace = await readFile(workspacePath, "utf8");

  // A new position starts at 1 mm. If a 3 mm STEP left that untouched, the
  // customer would be quoted the wrong metal and the wrong laser rate.
  assert.match(workspace, /nearestThicknessOption\(preview\.cad\.thicknessFromModelMm\)/);
  assert.match(workspace, /setPartThickness\(next, partId, measuredThickness\)/);
  // and it is said out loud rather than applied silently
  assert.match(workspace, /modelReadings\(preview\.cad\)/);
});

test("the request carries the calculation number the engineer can open", async () => {
  const [workspace, form] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile(formPath, "utf8"),
  ]);

  // The internal production report is filed under the calculation id, so a
  // request that carries it can be matched to work already done instead of
  // being quoted a second time from the attachments.
  assert.match(workspace, /calc: calculation\.projectId/);
  assert.match(form, /params\.get\("calc"\)/);
  assert.match(form, /Номер расчёта/);
  // Only that opaque id travels: no basis, rate or geometry rides along.
  assert.equal(workspace.includes("directCost"), false);
  assert.equal(workspace.includes("rateRub"), false);
});
