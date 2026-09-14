import assert from "node:assert/strict";
import test from "node:test";
import { CalculationManifestError, parsePublicCalculationManifest } from "../lib/instant-quote/calculation-manifest";

test("accepts only customer configuration and adds laser server-side", () => {
  const result = parsePublicCalculationManifest(JSON.stringify({
    title: "Project A",
    parts: [{
      clientPartId: "part-1",
      fileIndex: 0,
      materialId: "hot",
      thicknessMm: 2,
      quantity: 25,
      operations: ["bending", "powder-coating"],
    }],
  }), 1);

  assert.equal(result.parts[0].quantity, 25);
  assert.deepEqual(result.parts[0].operations, ["laser-cutting", "bending", "powder-coating"]);
});

test("rejects internal production metrics supplied by using unsupported manifest shape only", () => {
  const raw = JSON.stringify({
    parts: [{
      clientPartId: "part-1",
      fileIndex: 0,
      materialId: "hot",
      thicknessMm: 2,
      quantity: 1,
      operations: [],
      cutLengthMm: 999999,
      directCostRub: 1,
      supplierPrice: 1,
    }],
  });
  const result = parsePublicCalculationManifest(raw, 1);
  assert.equal("cutLengthMm" in result.parts[0], false);
  assert.equal("directCostRub" in result.parts[0], false);
  assert.equal("supplierPrice" in result.parts[0], false);
});

test("rejects duplicate file mapping and private operations", () => {
  assert.throws(() => parsePublicCalculationManifest(JSON.stringify({
    parts: [
      { clientPartId: "a", fileIndex: 0, materialId: "hot", thicknessMm: 1, quantity: 1, operations: [] },
      { clientPartId: "b", fileIndex: 0, materialId: "hot", thicknessMm: 1, quantity: 1, operations: [] },
    ],
  }), 2), CalculationManifestError);

  assert.throws(() => parsePublicCalculationManifest(JSON.stringify({
    parts: [{ clientPartId: "a", fileIndex: 0, materialId: "hot", thicknessMm: 1, quantity: 1, operations: ["threading"] }],
  }), 1), CalculationManifestError);
});

test("rejects file-count mismatch, unknown public material and invalid quantity", () => {
  assert.throws(() => parsePublicCalculationManifest(JSON.stringify({
    parts: [{ clientPartId: "a", fileIndex: 0, materialId: "hot", thicknessMm: 1, quantity: 1, operations: [] }],
  }), 2), CalculationManifestError);

  assert.throws(() => parsePublicCalculationManifest(JSON.stringify({
    parts: [{ clientPartId: "a", fileIndex: 0, materialId: "alu", thicknessMm: 1, quantity: 1, operations: [] }],
  }), 1), CalculationManifestError);

  assert.throws(() => parsePublicCalculationManifest(JSON.stringify({
    parts: [{ clientPartId: "a", fileIndex: 0, materialId: "hot", thicknessMm: 1, quantity: 0, operations: [] }],
  }), 1), CalculationManifestError);
});
