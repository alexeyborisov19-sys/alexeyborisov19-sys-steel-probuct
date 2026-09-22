import assert from "node:assert/strict";
import test from "node:test";
import { parseInternalCalculationRevisionRequest } from "../lib/instant-quote/internal-revision-request";

test("accepts only physical internal revision parameters", () => {
  const result = parseInternalCalculationRevisionRequest({
    reason: "Уточнено технологом по КД",
    internalNote: "Проверено вручную",
    parts: {
      "part-1": {
        bendCount: 4,
        weldLengthM: 1.25,
        powderAreaM2: 0.84,
        powderSides: 2,
        assemblyMinutes: 18.5,
        surfacePreparationAreaM2: 0.91,
        rateRub: 999999,
        directCostRub: 123,
        supplierPrice: 456,
      },
    },
  });

  assert.equal(result.reason, "Уточнено технологом по КД");
  assert.deepEqual(result.parts["part-1"], {
    bendCount: 4,
    weldLengthM: 1.25,
    powderAreaM2: 0.84,
    powderSides: 2,
    assemblyMinutes: 18.5,
    surfacePreparationAreaM2: 0.91,
  });
  const json = JSON.stringify(result);
  assert.equal(json.includes("rateRub"), false);
  assert.equal(json.includes("directCostRub"), false);
  assert.equal(json.includes("supplierPrice"), false);
});

test("supports explicit clearing of previously entered physical values", () => {
  const result = parseInternalCalculationRevisionRequest({
    reason: "Снять ошибочно внесённые параметры",
    parts: {
      "part-1": {
        weldLengthM: null,
        powderSides: "",
        assemblyMinutes: null,
        surfacePreparationAreaM2: "",
      },
    },
  });

  assert.deepEqual(result.parts["part-1"], {
    weldLengthM: null,
    powderSides: null,
    assemblyMinutes: null,
    surfacePreparationAreaM2: null,
  });
});

test("rejects impossible or unsafe revision inputs", () => {
  assert.throws(() => parseInternalCalculationRevisionRequest({ reason: "x", parts: { "part-1": { bendCount: 1 } } }));
  assert.throws(() => parseInternalCalculationRevisionRequest({ reason: "valid", parts: { "part-1": { bendCount: -1 } } }));
  assert.throws(() => parseInternalCalculationRevisionRequest({ reason: "valid", parts: { "part-1": { bendCount: 1.5 } } }));
  assert.throws(() => parseInternalCalculationRevisionRequest({ reason: "valid", parts: { "part-1": { weldLengthM: 0 } } }));
  assert.throws(() => parseInternalCalculationRevisionRequest({ reason: "valid", parts: { "part-1": { powderSides: 3 } } }));
  assert.throws(() => parseInternalCalculationRevisionRequest({ reason: "valid", parts: { "part-1": { assemblyMinutes: 0 } } }));
  assert.throws(() => parseInternalCalculationRevisionRequest({ reason: "valid", parts: { "part-1": { surfacePreparationAreaM2: -0.1 } } }));
});

test("requires at least one actual physical change", () => {
  assert.throws(() => parseInternalCalculationRevisionRequest({ reason: "valid reason", parts: {} }));
  assert.throws(() => parseInternalCalculationRevisionRequest({ reason: "valid reason", parts: { "part-1": {} } }));
  assert.throws(() => parseInternalCalculationRevisionRequest({
    reason: "valid reason",
    parts: { "part-1": { rateRub: 100, directCostRub: 500 } },
  }));
});

test("countersink revision accepts only bounded integer counts and explicit clearing", () => {
  for (const countersinkCount of [1, 100000, null]) {
    const parsed = parseInternalCalculationRevisionRequest({ reason: "Update operation", parts: { part: { countersinkCount } } });
    assert.equal(parsed.parts.part.countersinkCount, countersinkCount);
  }
  for (const countersinkCount of [0, -1, 1.5, 100001, "invalid"]) {
    assert.throws(() => parseInternalCalculationRevisionRequest({ reason: "Update operation", parts: { part: { countersinkCount } } }));
  }
});
