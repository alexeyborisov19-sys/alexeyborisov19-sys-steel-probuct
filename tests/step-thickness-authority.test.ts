import assert from "node:assert/strict";
import test from "node:test";
import { createClientCadPreview } from "@/lib/instant-quote/client-cad-preview";
import { measuredThicknessMm } from "@/lib/instant-quote/sheet-metal";
import { nearestThicknessOption } from "@/lib/instant-quote/client-labels";
import type { NormalizedCadModel } from "@/lib/instant-quote/cad-model";
import type { SheetMetalAnalysis } from "@/lib/instant-quote/sheet-metal";

function analysis(thicknessMm: number, confidence: "low" | "medium"): SheetMetalAnalysis {
  return {
    source: "brep",
    status: "candidate",
    planarFaceCount: 2,
    cylindricalFaceCount: 0,
    otherFaceCount: 0,
    thicknessCandidate: { thicknessMm, confidence, evidencePairs: 1, evidenceFaceIds: ["top", "bottom"] },
    bendCandidates: [],
    warnings: [],
  } as unknown as SheetMetalAnalysis;
}

function modelWith(sheetMetal: SheetMetalAnalysis | undefined): NormalizedCadModel {
  return {
    format: "step",
    units: "mm",
    geometry: { widthMm: 300, heightMm: 200, depthMm: 3 },
    meshes: [{ id: "mesh-1", positions: [0, 0, 0], indices: [0] }],
    root: null,
    features: [],
    ...(sheetMetal ? { sheetMetal } : {}),
    metadata: { sourceFileName: "part.step", sourceBytes: 10, parser: "test", analyzedAt: "2026-09-15T00:00:00.000Z" },
    warnings: [],
  } as unknown as NormalizedCadModel;
}

test("a medium-confidence thickness candidate is the measured thickness, a low one is not", () => {
  assert.equal(measuredThicknessMm(analysis(3, "medium")), 3);
  assert.equal(measuredThicknessMm(analysis(3, "low")), null);
  assert.equal(measuredThicknessMm(undefined), null);
  assert.equal(measuredThicknessMm(analysis(0, "medium")), null);
});

test("the customer's preview reports the thickness their own model was drawn in", () => {
  assert.equal(createClientCadPreview(modelWith(analysis(3, "medium"))).cad.thicknessFromModelMm, 3);
  // A DXF is a flat drawing: it has no sheet-metal analysis and no thickness.
  assert.equal(createClientCadPreview(modelWith(undefined)).cad.thicknessFromModelMm, null);
});

test("a measured thickness snaps onto a stocked one, or onto nothing at all", () => {
  assert.equal(nearestThicknessOption(3), 3);
  // Mill tolerance and modelling rounding must not push a part off its stock.
  assert.equal(nearestThicknessOption(1.95), 2);
  assert.equal(nearestThicknessOption(10.4), 10);
  // 3,5 mm is not stocked and is too far from 3 or 4 to stand in for either.
  assert.equal(nearestThicknessOption(3.5), null);
  assert.equal(nearestThicknessOption(null), null);
  assert.equal(nearestThicknessOption(0), null);
  assert.equal(nearestThicknessOption(Number.NaN), null);
});

test("a bent part says on upload that it will not be priced automatically", () => {
  const bent = modelWith(analysis(1.5, "medium"));
  bent.geometry.bendCount = 1;
  const preview = createClientCadPreview(bent);

  // Without this the customer configures the whole position and only learns at
  // "Рассчитать проект" that there is no automatic price for it.
  assert.equal(preview.status, "recognized");
  assert.match(preview.message, /гибами/);
  assert.match(preview.message, /не автоматически/);
  // The bends and thickness it did read are still reported.
  assert.equal(preview.cad.bendCountFromModel, 1);
  assert.equal(preview.cad.thicknessFromModelMm, 1.5);
});
