import assert from "node:assert/strict";
import test from "node:test";
import {
  OPERATION_TABLE_DEFAULTS,
  operationTableDefaultInputPatch,
} from "../lib/instant-quote/operation-table-defaults";

test("countersink uses the approved table default when CAD has no count", () => {
  assert.deepEqual(
    operationTableDefaultInputPatch("countersink", {}, null),
    { countersinkCount: OPERATION_TABLE_DEFAULTS.countersinkCount },
  );
});

test("CAD countersink count takes priority over the table default", () => {
  assert.deepEqual(
    operationTableDefaultInputPatch("countersink", {}, 7),
    { countersinkCount: 7 },
  );
});

test("existing countersink input is never overwritten", () => {
  assert.deepEqual(
    operationTableDefaultInputPatch("countersink", { countersinkCount: 12 }, 7),
    {},
  );
});

test("assembly uses the approved ten-minute table norm", () => {
  assert.deepEqual(
    operationTableDefaultInputPatch("assembly", {}),
    { assemblyMinutes: OPERATION_TABLE_DEFAULTS.assemblyMinutes },
  );
});

test("unrelated operations receive no hidden default", () => {
  assert.deepEqual(operationTableDefaultInputPatch("welding", {}), {});
});
