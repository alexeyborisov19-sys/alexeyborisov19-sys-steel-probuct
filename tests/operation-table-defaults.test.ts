import assert from "node:assert/strict";
import test from "node:test";
import {
  completeSelectedOperationInputs,
  OPERATION_TABLE_DEFAULTS,
  operationTableDefaultInputPatch,
  reconcileManualOperationInputs,
} from "../lib/instant-quote/operation-table-defaults";

test("bending prefers STEP evidence and otherwise uses the approved table value", () => {
  assert.deepEqual(
    operationTableDefaultInputPatch("bending", {}, { detectedBendCount: 7 }),
    { bendCount: 7 },
  );
  assert.deepEqual(
    operationTableDefaultInputPatch("bending", {}, {}),
    { bendCount: OPERATION_TABLE_DEFAULTS.bendCount },
  );
});

test("welding uses the approved one-metre editable value", () => {
  assert.deepEqual(
    operationTableDefaultInputPatch("welding", {}, {}),
    { weldLengthM: OPERATION_TABLE_DEFAULTS.weldLengthM },
  );
});

test("manual hole count is used for countersinking when STEP has no count", () => {
  assert.deepEqual(
    operationTableDefaultInputPatch("countersink", {}, { manualHoleCount: 9 }),
    { countersinkCount: 9 },
  );
});

test("STEP countersink count takes priority over manual geometry and the table", () => {
  assert.deepEqual(
    operationTableDefaultInputPatch("countersink", {}, {
      detectedCountersinkCount: 7,
      manualHoleCount: 9,
    }),
    { countersinkCount: 7 },
  );
});

test("countersink falls back to the approved table value without evidence", () => {
  assert.deepEqual(
    operationTableDefaultInputPatch("countersink", {}, null),
    { countersinkCount: OPERATION_TABLE_DEFAULTS.countersinkCount },
  );
});

test("existing operation inputs are never overwritten", () => {
  assert.deepEqual(
    operationTableDefaultInputPatch("bending", { bendCount: 12 }, { detectedBendCount: 7 }),
    {},
  );
  assert.deepEqual(
    operationTableDefaultInputPatch("welding", { weldLengthM: 2.5 }, {}),
    {},
  );
  assert.deepEqual(
    operationTableDefaultInputPatch("countersink", { countersinkCount: 12 }, {
      detectedCountersinkCount: 7,
      manualHoleCount: 9,
    }),
    {},
  );
  assert.deepEqual(
    operationTableDefaultInputPatch("assembly", { assemblyMinutes: 25 }, {}),
    {},
  );
  assert.deepEqual(
    operationTableDefaultInputPatch("powder-coating", { powderSides: 1 }, {}),
    {},
  );
  assert.deepEqual(
    operationTableDefaultInputPatch("surface-preparation", { surfacePreparationSides: 1 }, {}),
    {},
  );
});

test("explicitly cleared values remain unknown instead of silently returning", () => {
  assert.deepEqual(operationTableDefaultInputPatch("bending", { bendCount: undefined }, {}), {});
  assert.deepEqual(operationTableDefaultInputPatch("welding", { weldLengthM: undefined }, {}), {});
  assert.deepEqual(operationTableDefaultInputPatch("countersink", { countersinkCount: undefined }, { manualHoleCount: 8 }), {});
  assert.deepEqual(operationTableDefaultInputPatch("assembly", { assemblyMinutes: undefined }, {}), {});
  assert.deepEqual(operationTableDefaultInputPatch("powder-coating", { powderSides: undefined }, {}), {});
  assert.deepEqual(operationTableDefaultInputPatch("surface-preparation", { surfacePreparationSides: undefined }, {}), {});
});

test("assembly and both area operations receive their approved defaults", () => {
  assert.deepEqual(
    operationTableDefaultInputPatch("assembly", {}),
    { assemblyMinutes: OPERATION_TABLE_DEFAULTS.assemblyMinutes },
  );
  assert.deepEqual(
    operationTableDefaultInputPatch("powder-coating", {}),
    { powderSides: OPERATION_TABLE_DEFAULTS.powderSides },
  );
  assert.deepEqual(
    operationTableDefaultInputPatch("surface-preparation", {}),
    { surfacePreparationSides: OPERATION_TABLE_DEFAULTS.surfacePreparationSides },
  );
});

test("all selected priced operations can be completed in one pass", () => {
  assert.deepEqual(
    completeSelectedOperationInputs([
      "laser-cutting",
      "bending",
      "welding",
      "countersink",
      "assembly",
      "surface-preparation",
      "powder-coating",
      "packaging",
    ], {}, { manualHoleCount: 6 }),
    {
      bendCount: 2,
      weldLengthM: 1,
      countersinkCount: 6,
      assemblyMinutes: 10,
      surfacePreparationSides: 2,
      powderSides: 2,
    },
  );
});

test("new manual geometry pre-seeds countersink count before the operation is selected", () => {
  assert.deepEqual(
    reconcileManualOperationInputs(["laser-cutting"], {}, null, 8),
    { countersinkCount: 8 },
  );
});

test("editing manual geometry updates an automatically derived countersink count", () => {
  assert.deepEqual(
    reconcileManualOperationInputs(
      ["laser-cutting", "countersink"],
      { countersinkCount: 6 },
      6,
      9,
    ),
    { countersinkCount: 9 },
  );
});

test("editing manual geometry preserves a deliberate countersink override", () => {
  assert.deepEqual(
    reconcileManualOperationInputs(
      ["laser-cutting", "countersink"],
      { countersinkCount: 2 },
      6,
      9,
    ),
    { countersinkCount: 2 },
  );
});

test("editing manual geometry preserves an explicit unknown value", () => {
  assert.deepEqual(
    reconcileManualOperationInputs(
      ["laser-cutting", "countersink"],
      { countersinkCount: undefined },
      6,
      9,
    ),
    { countersinkCount: undefined },
  );
});

test("unsupported or parameterless operations receive no hidden input", () => {
  assert.deepEqual(operationTableDefaultInputPatch("packaging", {}), {});
  assert.deepEqual(operationTableDefaultInputPatch("laser-cutting", {}), {});
  assert.deepEqual(operationTableDefaultInputPatch("threading", {}), {});
});
