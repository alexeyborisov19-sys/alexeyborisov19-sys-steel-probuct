import assert from "node:assert/strict";
import test from "node:test";
import { deriveProductionParameters } from "../lib/instant-quote/production-parameters";

test("derives physical batch parameters independently from tariffs", () => {
  const result = deriveProductionParameters({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 10,
    geometry: {
      widthMm: 1000,
      heightMm: 500,
      areaMm2: 400000,
      blankAreaMm2: 500000,
      cutLengthMm: 3000,
      contourCount: 5,
      pierceCount: 5,
      holeCount: 4,
      bendCount: 2,
    },
    weldLengthMEach: 0.4,
    powderSides: 2,
  });

  assert.equal(result.status, "ready");
  assert.equal(result.stock.blankAreaMm2, 500000);
  assert.equal(result.stock.netAreaMm2, 400000);
  assert.equal(result.stock.wasteAreaMm2Each, 100000);
  assert.equal(result.stock.wastePct, 20);
  assert.equal(result.mass.netKgEach, 3.12);
  assert.equal(result.mass.purchasedKgEach, 3.9);
  assert.equal(result.mass.purchasedKgBatch, 39);
  assert.equal(result.cutting.cutLengthMBatch, 30);
  assert.equal(result.cutting.pierceCountBatch, 50);
  assert.equal(result.bending.bendCountBatch, 20);
  assert.equal(result.welding.weldLengthMBatch, 4);
  assert.equal(result.coating.powderAreaM2Each, 0.8);
  assert.equal(result.coating.powderAreaM2Batch, 8);
});

test("does not invent powder area without an explicit area or side selection", () => {
  const result = deriveProductionParameters({
    materialId: "hot",
    thicknessMm: 1,
    quantity: 1,
    geometry: {
      widthMm: 100,
      heightMm: 50,
      areaMm2: 5000,
      cutLengthMm: 300,
    },
  });

  assert.equal(result.coating.powderSides, null);
  assert.equal(result.coating.powderAreaM2Each, null);
});

test("blocks physical calculation when X×Y or thickness are missing", () => {
  const result = deriveProductionParameters({
    materialId: "cold",
    thicknessMm: 0,
    quantity: 1,
    geometry: { cutLengthMm: 100 },
  });

  assert.equal(result.status, "blocked");
  assert.ok(result.issues.some((issue) => /толщина/i.test(issue)));
  assert.ok(result.issues.some((issue) => /X×Y/i.test(issue)));
});
