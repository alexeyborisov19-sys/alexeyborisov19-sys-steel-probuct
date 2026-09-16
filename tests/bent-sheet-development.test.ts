import assert from "node:assert/strict";
import test from "node:test";
import { measureBentSheetDevelopment } from "@/lib/instant-quote/bent-sheet-development";
import type { SheetMetalTopologyObservations } from "@/lib/instant-quote/sheet-metal";

/** A rectangular planar face: its boundary is what classifies it, not its box. */
function plane(id: string, lengthMm: number, widthMm: number, edgeHashes: number[] = []) {
  return {
    id,
    areaMm2: lengthMm * widthMm,
    centerMm: [0, 0, 0] as [number, number, number],
    normal: [0, 0, 1] as [number, number, number],
    uvSizeMm: [lengthMm, widthMm] as [number, number],
    boundaryLengthMm: 2 * (lengthMm + widthMm),
    edgeHashes,
  };
}

/** A planar face of any shape, given directly as area and boundary length. */
function ribbon(id: string, areaMm2: number, boundaryLengthMm: number, edgeHashes: number[] = []) {
  return {
    id,
    areaMm2,
    centerMm: [0, 0, 0] as [number, number, number],
    normal: [0, 0, 1] as [number, number, number],
    boundaryLengthMm,
    edgeHashes,
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
        plane("edge-a", 300, 2, [1, 2]),
        plane("edge-b", 300, 2, [3, 4]),
        plane("edge-c", 200, 2, [2, 3]),
        plane("edge-d", 200, 2, [4, 1]),
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
        plane("edge-band", perimeterMm, thicknessMm, [1]),
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
      planarFaces: [plane("top", 300, 200), plane("bottom", 300, 200), plane("edge", 1_000, 2, [1])],
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
      planarFaces: [plane("top", 300, 200), plane("bottom", 300, 200), plane("edge", 1_000, 2, [1])],
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
      planarFaces: [plane("top", 300, 200), plane("bottom", 300, 200), plane("edge", 1_000, 2, [1])],
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
        plane("tip-horizontal", widthMm, thicknessMm, [1, 2]),
        plane("tip-vertical", widthMm, thicknessMm, [3, 4]),
        // End caps: L-shaped ribbons one thickness wide. Their bounding box is
        // 100 x 60, which is exactly why width has to come from the boundary.
        ribbon("cap-near", 157.3197 * thicknessMm, 2 * 157.3197, [2, 3]),
        ribbon("cap-far", 157.3197 * thicknessMm, 2 * 157.3197, [4, 1]),
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

test("a hole is a second contour, so it is a second pierce", () => {
  // 300 x 200 x 2 plate with one round hole. The band around the outer profile
  // and the band around the hole never touch, so they are two contours — and
  // the laser pierces twice, which is what the price has to know.
  const holeDiameterMm = 20;
  const holePerimeterMm = Math.PI * holeDiameterMm;
  const holeAreaMm2 = Math.PI * (holeDiameterMm / 2) ** 2;
  const outerPerimeterMm = 2 * (300 + 200);

  const result = measureBentSheetDevelopment({
    thicknessMm: 2,
    bodyCount: 1,
    observations: observations({
      planarFaces: [
        plane("top", 300, 200),
        plane("bottom", 300, 200),
        plane("outer-band", outerPerimeterMm, 2, [1]),
        plane("hole-band", holePerimeterMm, 2, [2]),
      ],
    }),
  });

  assert.equal(result.status, "measured");
  assert.equal(result.contourCount, 2);
  // Both bands are cut, so both count towards the cut length.
  assert.ok(Math.abs((result.cutLengthMm ?? 0) - (outerPerimeterMm + holePerimeterMm)) < 1e-6);
  // The faces here are declared without the hole subtracted, so the point of
  // this case is the contour count, not the area.
  assert.ok((result.developedAreaMm2 ?? 0) > holeAreaMm2);
});

test("touching edge-band faces stay one contour rather than counting twice", () => {
  // The four sides of a rectangular blank meet at its corners. Sharing those
  // edges is what keeps them one contour and one pierce.
  const result = measureBentSheetDevelopment({
    thicknessMm: 2,
    bodyCount: 1,
    observations: observations({
      planarFaces: [
        plane("top", 300, 200),
        plane("bottom", 300, 200),
        plane("side-north", 300, 2, [1, 2]),
        plane("side-east", 200, 2, [2, 3]),
        plane("side-south", 300, 2, [3, 4]),
        plane("side-west", 200, 2, [4, 1]),
      ],
    }),
  });

  assert.equal(result.status, "measured");
  assert.equal(result.contourCount, 1);
});

test("the reference angle's blank sides come out of the same measurement", () => {
  const thicknessMm = 1.5;
  const insideRadiusMm = 2;
  const outsideRadiusMm = insideRadiusMm + thicknessMm;
  const widthMm = 250;
  const sweepRad = Math.PI / 2;
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
        plane("tip-horizontal", widthMm, thicknessMm, [1, 2]),
        plane("tip-vertical", widthMm, thicknessMm, [3, 4]),
        ribbon("cap-near", 157.3197 * thicknessMm, 2 * 157.3197, [2, 3]),
        ribbon("cap-far", 157.3197 * thicknessMm, 2 * 157.3197, [4, 1]),
      ],
      cylindricalFaces: [
        cylinder("bend-inside", insideRadiusMm, sweepRad, widthMm),
        cylinder("bend-outside", outsideRadiusMm, sweepRad, widthMm),
      ],
    }),
  });

  assert.equal(result.status, "measured");
  // The bend runs the full 250 mm, and the perimeter fixes the other side.
  assert.ok(Math.abs((result.blankWidthMm ?? 0) - 250) < 0.5, `width ${result.blankWidthMm}`);
  assert.ok(Math.abs((result.blankHeightMm ?? 0) - 157.3) < 0.5, `height ${result.blankHeightMm}`);
});

test("a blank with a hole reports no sides, because the perimeter no longer fixes them", () => {
  const thicknessMm = 1.5;
  const widthMm = 250;
  const sweepRad = Math.PI / 2;

  const result = measureBentSheetDevelopment({
    thicknessMm,
    bodyCount: 1,
    observations: observations({
      planarFaces: [
        plane("flange-a-out", widthMm, 80),
        plane("flange-a-in", widthMm, 80),
        plane("flange-b-out", widthMm, 60),
        plane("flange-b-in", widthMm, 60),
        plane("outer-band", 800, thicknessMm, [1]),
        plane("hole-band", 60, thicknessMm, [2]),
      ],
      cylindricalFaces: [
        cylinder("bend-inside", 2, sweepRad, widthMm),
        cylinder("bend-outside", 3.5, sweepRad, widthMm),
      ],
    }),
  });

  assert.equal(result.status, "measured");
  assert.equal(result.contourCount, 2);
  // Area and cut length are still measured; only the sides are withheld.
  assert.ok((result.developedAreaMm2 ?? 0) > 0);
  assert.equal(result.blankWidthMm, undefined);
  assert.equal(result.blankHeightMm, undefined);
});

test("a blank that is not a rectangle reports no sides rather than inventing them", () => {
  const thicknessMm = 1.5;
  const widthMm = 250;
  const sweepRad = Math.PI / 2;

  // A notched outline: the cut is far longer than a rectangle of this area
  // would need, so width x height cannot reproduce the area.
  const result = measureBentSheetDevelopment({
    thicknessMm,
    bodyCount: 1,
    observations: observations({
      planarFaces: [
        plane("flange-a-out", widthMm, 80),
        plane("flange-a-in", widthMm, 80),
        plane("flange-b-out", widthMm, 60),
        plane("flange-b-in", widthMm, 60),
        plane("outer-band", 2_400, thicknessMm, [1]),
      ],
      cylindricalFaces: [
        cylinder("bend-inside", 2, sweepRad, widthMm),
        cylinder("bend-outside", 3.5, sweepRad, widthMm),
      ],
    }),
  });

  assert.equal(result.status, "measured");
  assert.equal(result.contourCount, 1);
  assert.equal(result.blankWidthMm, undefined);
});

test("one bend is counted once, not once per face", () => {
  // The kernel shows a bend as two cylindrical faces — the inside radius and
  // the outside radius. Counting faces would charge for two bends on a part
  // that has one.
  const thicknessMm = 1.5;
  const insideRadiusMm = 2;
  const widthMm = 250;
  const sweepRad = Math.PI / 2;
  const blankLengthMm = 80 + 60 + sweepRad * (insideRadiusMm + thicknessMm / 2);

  const result = measureBentSheetDevelopment({
    thicknessMm,
    bodyCount: 1,
    observations: observations({
      planarFaces: [
        plane("flange-a-out", widthMm, 80),
        plane("flange-a-in", widthMm, 80),
        plane("flange-b-out", widthMm, 60),
        plane("flange-b-in", widthMm, 60),
        plane("edge-band", 2 * (widthMm + blankLengthMm), thicknessMm, [1]),
      ],
      cylindricalFaces: [
        cylinder("bend-inside", insideRadiusMm, sweepRad, widthMm),
        cylinder("bend-outside", insideRadiusMm + thicknessMm, sweepRad, widthMm),
      ],
    }),
  });

  assert.equal(result.status, "measured");
  assert.equal(result.bendCount, 1);
});

test("two bends are counted as two", () => {
  const thicknessMm = 2;
  const widthMm = 200;
  const sweepRad = Math.PI / 2;
  const bendMm = sweepRad * (3 + thicknessMm / 2);
  const blankLengthMm = 50 + 100 + 50 + bendMm * 2;

  const result = measureBentSheetDevelopment({
    thicknessMm,
    bodyCount: 1,
    observations: observations({
      planarFaces: [
        plane("a-out", widthMm, 50), plane("a-in", widthMm, 50),
        plane("b-out", widthMm, 100), plane("b-in", widthMm, 100),
        plane("c-out", widthMm, 50), plane("c-in", widthMm, 50),
        plane("edge-band", 2 * (widthMm + blankLengthMm), thicknessMm, [1]),
      ],
      cylindricalFaces: [
        cylinder("bend-1-inside", 3, sweepRad, widthMm),
        cylinder("bend-1-outside", 3 + thicknessMm, sweepRad, widthMm),
        cylinder("bend-2-inside", 3, sweepRad, widthMm),
        cylinder("bend-2-outside", 3 + thicknessMm, sweepRad, widthMm),
      ],
    }),
  });

  assert.equal(result.status, "measured");
  assert.equal(result.bendCount, 2);
});

test("a bend face without its opposite reports no count rather than a guess", () => {
  // A sharp bend with no inner radius shows one face where this reading expects
  // two. Guessing the count would charge for bending that may not match the
  // part; the blank still measures, and the count simply is not reported.
  const thicknessMm = 1.5;
  const widthMm = 250;
  const sweepRad = Math.PI / 2;

  const result = measureBentSheetDevelopment({
    thicknessMm,
    bodyCount: 1,
    observations: observations({
      planarFaces: [
        plane("flange-a-out", widthMm, 80),
        plane("flange-a-in", widthMm, 80),
        plane("flange-b-out", widthMm, 60),
        plane("flange-b-in", widthMm, 60),
        plane("edge-band", 2 * (widthMm + 145), thicknessMm, [1]),
      ],
      cylindricalFaces: [cylinder("bend-outside-only", 3.5, sweepRad, widthMm)],
    }),
  });

  assert.equal(result.status, "measured");
  assert.equal(result.bendCount, undefined);
});
