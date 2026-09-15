import assert from "node:assert/strict";
import test from "node:test";
import {
  CalculationManifestError,
  parsePublicCalculationManifest,
} from "../lib/instant-quote/calculation-manifest";

function manifest(part: Record<string, unknown>) {
  return JSON.stringify({
    title: "Project",
    parts: [{ clientPartId: "a", fileIndex: 0, materialId: "hot", thicknessMm: 2, quantity: 1, ...part }],
  });
}

test("accepts the quantities a CAD file cannot carry", () => {
  const parsed = parsePublicCalculationManifest(manifest({
    operations: ["bending", "welding", "assembly", "powder-coating"],
    operationInputs: { bendCount: 4, weldLengthM: 1.5, assemblyMinutes: 30, powderSides: 2 },
  }), 1);

  assert.deepEqual(parsed.parts[0].operationInputs, {
    bendCount: 4,
    weldLengthM: 1.5,
    assemblyMinutes: 30,
    powderSides: 2,
  });
});

test("drops a quantity whose operation was not selected", () => {
  const parsed = parsePublicCalculationManifest(manifest({
    operations: ["bending"],
    operationInputs: { bendCount: 2, weldLengthM: 10, powderSides: 2, assemblyMinutes: 5 },
  }), 1);

  assert.deepEqual(parsed.parts[0].operationInputs, { bendCount: 2 });
});

test("a manifest without quantities stays valid", () => {
  const parsed = parsePublicCalculationManifest(manifest({ operations: [] }), 1);
  assert.deepEqual(parsed.parts[0].operationInputs, {});
});

test("rejects out-of-range, non-integer and unsupported values", () => {
  const rejected: Array<Record<string, unknown>> = [
    { operations: ["bending"], operationInputs: { bendCount: -1 } },
    { operations: ["bending"], operationInputs: { bendCount: 501 } },
    { operations: ["bending"], operationInputs: { bendCount: 1.5 } },
    { operations: ["bending"], operationInputs: { bendCount: "4" } },
    { operations: ["welding"], operationInputs: { weldLengthM: 501 } },
    { operations: ["assembly"], operationInputs: { assemblyMinutes: 10_001 } },
    { operations: ["powder-coating"], operationInputs: { powderSides: 0 } },
    { operations: ["powder-coating"], operationInputs: { powderSides: 3 } },
    { operations: ["bending"], operationInputs: "4" },
  ];

  for (const part of rejected) {
    assert.throws(
      () => parsePublicCalculationManifest(manifest(part), 1),
      CalculationManifestError,
      `should reject ${JSON.stringify(part)}`,
    );
  }
});
