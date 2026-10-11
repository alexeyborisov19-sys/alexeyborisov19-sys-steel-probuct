import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateMetalCassettes,
  estimateMetalCassettesByQuantity,
  getDefaultMetalCassetteRate,
  metalCassetteThicknesses,
} from "../lib/metal-cassette-estimate";
import { cassetteProductBrief, cassetteProductSummary } from "../lib/cassette-product-spec";
import { buildCassetteElevation, createCassetteElevation, validateCassetteElevation } from "../lib/cassette-project/model";
import { basketVolumePrice, basketPriceTiers } from "../lib/quote/basket-volume-price";
import { calculatedBasketSize, emptyBasketFit, requiredBasketSpace } from "../lib/quote/basket-fit";
import { createManualSheetDxf, manualSheetGeometry, readManualSheetDxf, validateManualSheet } from "../lib/instant-quote/manual-sheet";

// Two independent deterministic passes; all amounts use the already-approved public
// formula/rate data. No live customer files, rate edits, or production submissions.
for (const replay of [1, 2]) {
  test(`replay ${replay}: all 2 cassette types x 4 thicknesses x 3 quote methods and representative order sizes`, () => {
    let combinations = 0;
    for (const type of ["open", "closed"] as const) {
      for (const thickness of metalCassetteThicknesses) {
        const rate = getDefaultMetalCassetteRate(type, thickness);
        assert.ok(rate > 0);
        for (const areaM2 of [1, 12.5, 100, 1000]) {
          const output = estimateMetalCassettes({ mode: "area", type, thickness, areaM2 });
          assert.equal(output.netAreaM2, areaM2);
          assert.equal(output.approximateTotalRub, Math.round(rate * areaM2));
          assert.ok(Number.isSafeInteger(output.quantity) && output.quantity >= 1);
          combinations++;
        }
        for (const [wallWidthMm, wallHeightMm, openingsM2] of [
          [1190, 565, 0], [12000, 6000, 8], [2400, 1100, 1],
        ]) {
          const output = estimateMetalCassettes({ mode: "wall", type, thickness, wallWidthMm, wallHeightMm, openingsM2 });
          assert.equal(output.netAreaM2, wallWidthMm * wallHeightMm / 1_000_000 - openingsM2);
          assert.equal(output.quantity > 0, true);
          assert.ok(output.columns! > 0 && output.rows! > 0);
          combinations++;
        }
        for (const [moduleWidthMm, moduleHeightMm] of [[600, 1200], [1170, 545], [300, 500]]) {
          for (const quantity of [1, 2, 10, 50, 100, 300, 100000]) {
            const result = estimateMetalCassettesByQuantity({ type, thickness, quantity, moduleWidthMm, moduleHeightMm });
            assert.equal(result.quantity, quantity);
            assert.equal(result.netAreaM2, quantity * moduleWidthMm * moduleHeightMm / 1_000_000);
            assert.equal(result.approximateTotalRub, Math.round(result.netAreaM2 * rate));
            assert.equal(result.columns, null);
            assert.equal(result.rows, null);
            combinations++;
          }
        }
      }
    }
    assert.equal(combinations, 2 * metalCassetteThicknesses.length * (4 + 3 + 3 * 7));
  });

  test(`replay ${replay}: cassette specification, 1–100 distinct sizes and variable quantities`, () => {
    for (const type of ["open", "closed"] as const) for (const rowCount of [1, 2, 5, 100]) {
      const rows = Array.from({ length: rowCount }, (_, i) => ({
        id: String(i + 1), width: String(600 + i), height: "1200", quantity: String([1, 2, 10, 100000][i % 4]),
      }));
      const draft = { type, rows, material: "", thickness: "", finish: "" };
      const summary = cassetteProductSummary(draft);
      assert.equal(summary.rows.length, rowCount);
      assert.equal(summary.quantity, rows.reduce((sum, row) => sum + Number(row.quantity), 0));
      assert.ok(summary.faceAreaM2 > 0);
      const brief = cassetteProductBrief(draft);
      assert.ok(brief.includes(`Всего: ${summary.quantity} шт.`));
      assert.doesNotMatch(brief, /\d[\d\s]*\s*₽/);
    }
    const bad = { type: "open" as const, rows: [{ id: "1", width: "600", height: "1200", quantity: "1.5" }], material: "", thickness: "", finish: "" };
    assert.throws(() => cassetteProductSummary(bad), /целое количество/);
  });

  test(`replay ${replay}: facade layout grids, cassette types, openings and reproducible counts`, () => {
    for (const type of ["open", "closed"] as const) for (const thicknessMm of [0.65, 0.7, 1, 1.2]) {
      for (const opening of ["none", "partial", "fully-inside"] as const) {
        const facade = createCassetteElevation("E1");
        facade.widthMm = 2400;
        facade.heightMm = 1200;
        facade.panel.type = type;
        facade.panel.thicknessMm = thicknessMm;
        facade.openings = opening === "none" ? [] : [
          opening === "partial"
            ? { id: "O1", name: "Окно", xMm: 300, yMm: 200, widthMm: 150, heightMm: 150 }
            : { id: "O1", name: "Окно", xMm: 0, yMm: 0, widthMm: 1170, heightMm: 545 },
        ];
        assert.deepEqual(validateCassetteElevation(facade), []);
        const a = buildCassetteElevation(facade, "QA");
        const again = buildCassetteElevation(facade, "QA");
        assert.equal(a.rows * a.columns, a.panels.length);
        assert.equal(a.summary.quantity, a.panels.filter(p => p.status !== "opening-removed").length);
        assert.deepEqual(a.panels.map(p => p.mark), again.panels.map(p => p.mark));
        assert.ok(a.panels.every(p => Number.isFinite(p.remainingAreaM2) && p.remainingAreaM2 >= 0 && p.remainingAreaM2 <= p.faceAreaM2));
        if (opening === "none") assert.equal(a.summary.removed + a.summary.affected, 0);
      }
    }
  });

  test(`replay ${replay}: all published basket quantity tiers and clearance requirements`, () => {
    for (const quantity of [1, 2, 10, 11, 25, 49, 50, 99, 100, 300, 10000]) {
      const result = basketVolumePrice(quantity);
      const tier = basketPriceTiers.find(t => quantity >= t.min && quantity <= t.max);
      assert.ok(result && tier);
      assert.equal(result.unit, tier.price);
      assert.equal(result.total, tier.price * quantity);
    }
    for (const quantity of [0, -1, 1.5, 10001, Number.NaN]) {
      assert.equal(basketVolumePrice(quantity), null);
    }
    const missing = emptyBasketFit();
    assert.equal(calculatedBasketSize(missing), null);
    for (const [width, height, depth] of [[800, 500, 300], [1000, 700, 500], [1200, 900, 600]]) {
      const fit = { width, height, depth, left: 50, right: 50, top: 40, bottom: 60, front: 100, rear: 150 };
      const size = calculatedBasketSize(fit);
      assert.deepEqual(size, { width: width + 100, height: height + 100, depth: depth + 250 });
      assert.deepEqual(requiredBasketSpace(fit), size);
    }
  });

  test(`replay ${replay}: manual CAD input with no holes, one type and five hole groups`, () => {
    for (const holeCount of [0, 1, 5]) {
      const input = {
        lengthMm: 400, widthMm: 350, holes: holeCount !== 0,
        holeGroups: Array.from({ length: holeCount }, (_, i) => ({ count: i + 1, diameterMm: 4 + i })),
      };
      const verified = validateManualSheet(input);
      const dimensions = manualSheetGeometry(verified);
      assert.equal(dimensions.widthMm, 400);
      assert.equal(dimensions.heightMm, 350);
      assert.ok(dimensions.cutLengthMm! >= 2 * (400 + 350));
      const restored = readManualSheetDxf(createManualSheetDxf(verified));
      assert.deepEqual(restored, verified);
    }
    assert.throws(() => validateManualSheet({ lengthMm: 0, widthMm: 350, holes: false, holeGroups: [] }));
  });
}
