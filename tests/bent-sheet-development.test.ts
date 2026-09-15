import assert from "node:assert/strict";
import test from "node:test";
import { measureBentSheetDevelopment } from "@/lib/instant-quote/bent-sheet-development";
import type { SheetMetalTopologyObservations } from "@/lib/instant-quote/sheet-metal";

/** A rectangular planar face: its boundary is what classifies it, not its box. */
function plane(id: string, lengthMm: number, widthMm: number) {
  return {
    id,
    areaMm2: lengthMm * widthMm,
    centerMm: [0, 0, 0] as [number, number, number],
    normal: [0, 0, 1] as [number, number, number],
    uvSizeMm: [lengthMm, widthMm] as [number, number],
    boundaryLengthMm: 2 * (lengthMm + widthMm),
  };
}

/** A planar face of any shape, given directly as area and boundary length. */
function ribbon(id: string, areaMm2: number, boundaryLengthMm: number) {
  return {
    id,
    areaMm2,
    centerMm: [0, 0, 0] as [number, number, number],
    normal: [0, 0, 1] as [number, number, number],
    boundaryLengthMm,
  };
}

function cylinder(id: string, radiusMm: number, angleSpanRad: number, heightMm: number) {
  return { id, areaMm2: radiusMm * angleSpanRad * heightMm, radiusMm, angleSpanRad, axis: [1, 0, 0] as [number, number, number] };
}

function observations(input: Partial<SheetMetalTopologyObservations>): SheetMetalTopologyObservations {
  return { planarFaces: [], cylindricalFaces: [], otherFaceCount: 0, ...input } as SheetMetalTopologyObservations;
}

test("a flat plate develops to its own face, and its edge band gives the cut length", () => {
  // 300 x 200 x 2 mm plate: two 60 000 mm² faces and a 1 000 mm perimeter band.
  const result = measureBentSheetDevelopment({
    thicknessMm: 2,
    bodyCount: 1,
    observations: observations({
      planarFaces: [
        plane("top", 300, 200),
        plane("bottom", 300, 200),
        plane("edge-a", 300, 2),
        plane("edge-b", 300, 2),
        plane("edge-c", 200, 2),
        plane("edge-d", 200, 2),
      ],
    }),
    totalSurfaceAreaMm2: 60_000 * 2 + 1_000 * 2,
  });

  assert.equal(result.status, "measured");
  assert.equal(result.developedAreaMm2, 60_000);
  assert.equal(result.cutLengthMm, 1_000);
});

test("a bend develops along the middle of the material, with no factor chosen anywhere", () => {
  // The property that makes a bend table unnecessary: the inside face develops
  // to θ·r, the outside to θ·(r+t), and half their sum is θ·(r + t/2) — the
  // development along the middle of the material. Flange lengths are declared
  // here, so what this checks is the bend's own contribution, not arithmetic.
  const thicknessMm = 1.5;
  const insideRadiusMm = 2;
  const widthMm = 250;
  const flangeAMm = 80;
  const flangeBMm = 60;
  const sweepRad = Math.PI / 2;
  const expectedBendMm = sweepRad * (insideRadiusMm + thicknessMm / 2);
  const expectedBlankLengthMm = flangeAMm + flangeBMm + expectedBendMm;
  const perimeterMm = 2 * (widthMm + expectedBlankLengthMm);

  const result = measureBentSheetDevelopment({
    thicknessMm,
    bodyCount: 1,
    observations: observations({
      planarFaces: [
        plane("flange-a-out", widthMm, flangeAMm),
        plane("flange-a-in", widthMm, flangeAMm),
        plane("flange-b-out", widthMm, flangeBMm),
        plane("flange-b-in", widthMm, flangeBMm),
        plane("edge-band", perimeterMm, thicknessMm),
      ],
      cylindricalFaces: [
        cylinder("bend-inside", insideRadiusMm, sweepRad, widthMm),
        cylinder("bend-outside", insideRadiusMm + thicknessMm, sweepRad, widthMm),
      ],
    }),
  });

  assert.equal(result.status, "measured");
  const measuredLengthMm = (result.developedAreaMm2 ?? 0) / widthMm;
  assert.ok(
    Math.abs(measuredLengthMm - expectedBlankLengthMm) < 1e-9,
    `mid-surface development expected ${expectedBlankLengthMm}, measured ${measuredLengthMm}`,
  );
  // Stated the other way round: the bend contributed exactly K = 0,5, which is
  // the conservative end of the range steel actually bends at, so a blank is
  // never understated.
  const measuredBendMm = measuredLengthMm - flangeAMm - flangeBMm;
  assert.ok(
    Math.abs(measuredBendMm - expectedBendMm) < 1e-9,
    `bend expected ${expectedBendMm}, measured ${measuredBendMm}`,
  );
  // And the edge band gives the developed perimeter back.
  assert.ok(Math.abs((result.cutLengthMm ?? 0) - perimeterMm) < 1e-9);
});

test("an unclassified face stops the measurement instead of losing its area", () => {
  const result = measureBentSheetDevelopment({
    thicknessMm: 2,
    observations: observations({
      planarFaces: [plane("top", 300, 200), plane("bottom", 300, 200), plane("edge", 1_000, 2)],
      otherFaceCount: 1,
    }),
  });

  assert.equal(result.status, "unavailable");
  assert.match(result.reasons[0], /Не распознано граней/);
});

test("a second body stops the measurement: two parts are not one blank", () => {
  const result = measureBentSheetDevelopment({
    thicknessMm: 2,
    bodyCount: 2,
    observations: observations({
      planarFaces: [plane("top", 300, 200), plane("bottom", 300, 200), plane("edge", 1_000, 2)],
    }),
  });

  assert.equal(result.status, "unavailable");
  assert.match(result.reasons[0], /не одно тело/);
});

test("surfaces that do not add up to the solid stop the measurement", () => {
  const result = measureBentSheetDevelopment({
    thicknessMm: 2,
    bodyCount: 1,
    observations: observations({
      planarFaces: [plane("top", 300, 200), plane("bottom", 300, 200), plane("edge", 1_000, 2)],
    }),
    // A tenth of the surface is unexplained: the part was not fully understood.
    totalSurfaceAreaMm2: (60_000 * 2 + 2_000) * 1.1,
  });

  assert.equal(result.status, "unavailable");
  assert.match(result.reasons[0], /не сходятся/);
});

test("a part with no edge band gives no cut length rather than a guessed one", () => {
  const result = measureBentSheetDevelopment({
    thicknessMm: 2,
    bodyCount: 1,
    observations: observations({ planarFaces: [plane("top", 300, 200), plane("bottom", 300, 200)] }),
  });

  assert.equal(result.status, "unavailable");
  assert.match(result.reasons[0], /торцевых граней/);
});

test("the approved reference angle measures to its approved blank and cut length", () => {
  // Geometry of the owner's reference angle.step, taken from the generator that
  // produced it: t = 1,5; inside radius 2; width 250; flanges 100 and 60 from
  // the outside. Nothing here is fitted to the expected answer — the flange
  // mid-lines and the areas below follow from those dimensions alone.
  const thicknessMm = 1.5;
  const insideRadiusMm = 2;
  const outsideRadiusMm = insideRadiusMm + thicknessMm;
  const widthMm = 250;
  const sweepRad = Math.PI / 2;

  // Each flange's faces run from where the bend ends to the flange tip.
  const horizontalFaceMm = 100 - outsideRadiusMm;
  const verticalFaceMm = 60 - outsideRadiusMm;

  const result = measureBentSheetDevelopment({
    thicknessMm,
    bodyCount: 1,
    observations: observations({
      planarFaces: [
        plane("horizontal-outside", widthMm, horizontalFaceMm),
        plane("horizontal-inside", widthMm, horizontalFaceMm),
        plane("vertical-outside", widthMm, verticalFaceMm),
        plane("vertical-inside", widthMm, verticalFaceMm),
        // Flange tips: the sheet edge seen across the thickness.
        plane("tip-horizontal", widthMm, thicknessMm),
        plane("tip-vertical", widthMm, thicknessMm),
        // End caps: L-shaped ribbons one thickness wide. Their bounding box is
        // 100 x 60, which is exactly why width has to come from the boundary.
        ribbon("cap-near", 157.3197 * thicknessMm, 2 * 157.3197),
        ribbon("cap-far", 157.3197 * thicknessMm, 2 * 157.3197),
      ],
      cylindricalFaces: [
        cylinder("bend-inside", insideRadiusMm, sweepRad, widthMm),
        cylinder("bend-outside", outsideRadiusMm, sweepRad, widthMm),
      ],
    }),
  });

  assert.equal(result.status, "measured");

  const blankLengthMm = (result.developedAreaMm2 ?? 0) / widthMm;
  const blankAreaMm2 = result.developedAreaMm2 ?? 0;

  // The owner's approved reference: unfold 250 x 157,3 mm, cut 814,6 mm.
  assert.ok(
    Math.abs(blankLengthMm - 157.3) / 157.3 < 0.005,
    `approved blank 157,3 mm, measured ${blankLengthMm.toFixed(3)} mm`,
  );
  assert.ok(
    Math.abs(blankAreaMm2 - 250 * 157.3) / (250 * 157.3) < 0.005,
    `approved blank area ${250 * 157.3} mm², measured ${blankAreaMm2.toFixed(1)}`,
  );
  assert.ok(
    Math.abs((result.cutLengthMm ?? 0) - 814.6) / 814.6 < 0.005,
    `approved cut 814,6 mm, measured ${(result.cutLengthMm ?? 0).toFixed(2)} mm`,
  );
});
