import assert from "node:assert/strict";
import test from "node:test";
import {
  createManualSheetDxf,
  manualHoleCount,
  manualSheetGeometry,
  readManualSheetDxf,
  type ManualSheetInput,
} from "../lib/instant-quote/manual-sheet";
import { reconcileManualOperationInputs } from "../lib/instant-quote/operation-table-defaults";

const grouped: ManualSheetInput = {
  lengthMm: 400,
  widthMm: 250,
  holes: true,
  holeGroups: [
    { count: 4, diameterMm: 5 },
    { count: 2, diameterMm: 8 },
  ],
};

test("manual grouped holes are summed per detail", () => {
  assert.equal(manualHoleCount(grouped), 6);
  assert.equal(manualSheetGeometry(grouped).holeCount, 6);
});

test("legacy manual blank hole count remains readable", () => {
  const legacy: ManualSheetInput = {
    lengthMm: 300,
    widthMm: 200,
    holes: true,
    holeCount: 5,
    holeDiameterMm: 6,
  };
  assert.equal(manualHoleCount(legacy), 5);
});

test("manual DXF roundtrip preserves the operation quantity evidence", () => {
  const decoded = readManualSheetDxf(createManualSheetDxf(grouped));
  assert.ok(decoded);
  assert.equal(manualHoleCount(decoded), 6);
  assert.deepEqual(
    reconcileManualOperationInputs(["laser-cutting"], {}, null, manualHoleCount(decoded)),
    { countersinkCount: 6 },
  );
});

test("manual blank without holes does not invent geometry holes", () => {
  const blank: ManualSheetInput = {
    lengthMm: 300,
    widthMm: 200,
    holes: false,
    holeGroups: [],
  };
  assert.equal(manualHoleCount(blank), 0);
  assert.equal(manualSheetGeometry(blank).holeCount, 0);
});
