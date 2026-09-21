import assert from "node:assert/strict";
import test from "node:test";
import {
  approvedSalePriceRubFromLines,
  loadCommercialPricingPolicy,
  roundMoney,
  roundUpTo,
  type CommercialPricingPolicy,
} from "../lib/server/instant-quote/commercial-pricing";

/**
 * Characterises the formula that lived inline in
 * run-confidential-calculation.ts's `approvedSalePriceRub` before it was
 * extracted here so a second caller could reuse it (§28: any change must
 * carry an old-result-vs-new-result comparison). These numbers were computed
 * by hand from the pre-extraction formula, not from running the new code —
 * this is the "old result" side of that comparison, fixed independently of
 * whatever the extracted function currently returns.
 */
const policy: CommercialPricingPolicy = {
  metalMultiplier: 1.1,
  drawingPercentOfWorks: 5,
  finalPercent: 15,
  fixedAddRubEach: 50,
  fixedAddEnabled: true,
  roundStepRub: 10,
};

test("the extracted formula reproduces the pre-extraction hand-computed result", () => {
  const lines = [
    { code: "material", amountRubEach: 280.8 },
    { code: "laser-cutting", amountRubEach: 216 },
    { code: "laser-piercing", amountRubEach: 3 },
  ];
  const quantity = 100;

  // By hand, following the exact original formula:
  // materialEach = 280.8
  // worksBaseEach = 216 + 3 = 219
  // worksEach = 219 + 50 (fixedAddEnabled) = 269
  // drawingEach = 269 * 5 / 100 = 13.45
  // subtotalEach = 280.8 * 1.1 + 269 + 13.45 = 308.88 + 269 + 13.45 = 591.33
  // saleEach = roundUpTo(591.33 * 1.15, 10) = roundUpTo(680.0295, 10) = 690
  // total = roundMoney(690 * 100) = 69000
  const result = approvedSalePriceRubFromLines(lines, quantity, policy);
  assert.equal(result, 69_000);
});

test("disabling the fixed add removes it from works, exactly as the original branch did", () => {
  const lines = [{ code: "material", amountRubEach: 100 }, { code: "welding", amountRubEach: 50 }];
  const withoutFixedAdd: CommercialPricingPolicy = { ...policy, fixedAddEnabled: false };

  // worksEach = 50 (no +50 this time)
  // drawingEach = 50 * 5 / 100 = 2.5
  // subtotalEach = 100*1.1 + 50 + 2.5 = 162.5
  // saleEach = roundUpTo(162.5 * 1.15, 10) = roundUpTo(186.875, 10) = 190
  // total (qty 1) = 190
  const result = approvedSalePriceRubFromLines(lines, 1, withoutFixedAdd);
  assert.equal(result, 190);
});

test("only the material line is multiplied by the metal multiplier, never the works lines", () => {
  const materialOnly = approvedSalePriceRubFromLines(
    [{ code: "material", amountRubEach: 1000 }],
    1,
    { metalMultiplier: 2, drawingPercentOfWorks: 0, finalPercent: 0, fixedAddRubEach: 0, fixedAddEnabled: false, roundStepRub: 1 },
  );
  assert.equal(materialOnly, 2000); // 1000 * 2, nothing else added

  const worksOnly = approvedSalePriceRubFromLines(
    [{ code: "welding", amountRubEach: 1000 }],
    1,
    { metalMultiplier: 2, drawingPercentOfWorks: 0, finalPercent: 0, fixedAddRubEach: 0, fixedAddEnabled: false, roundStepRub: 1 },
  );
  assert.equal(worksOnly, 1000); // multiplier does not apply to works lines
});

test("roundUpTo always rounds to the next step, never down, matching the pre-extraction helper", () => {
  assert.equal(roundUpTo(101, 10), 110);
  assert.equal(roundUpTo(100, 10), 100); // an exact multiple stays put, not bumped to the next step
  assert.equal(roundUpTo(0.01, 10), 10);
});

test("roundMoney rounds to whole kopecks, matching the pre-extraction helper", () => {
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(1.004), 1);
});

test("the policy loader still fails closed when the required env vars are absent", () => {
  const saved = { ...process.env };
  for (const key of [
    "STEEL_PRODUCT_METAL_MULTIPLIER", "STEEL_PRODUCT_DRAW_PCT", "STEEL_PRODUCT_FINAL_PCT",
    "STEEL_PRODUCT_FIXED_ADD_RUB", "STEEL_PRODUCT_FIXED_ADD_ENABLED", "STEEL_PRODUCT_ROUND_STEP_RUB",
  ]) delete process.env[key];

  assert.throws(() => loadCommercialPricingPolicy(), /STEEL_PRODUCT_FIXED_ADD_ENABLED is not configured/);

  process.env = saved;
});
