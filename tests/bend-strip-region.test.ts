import assert from "node:assert/strict";
import test from "node:test";
import { buildBendStripRegionCandidate } from "../lib/instant-quote/bend-strip-region";
import type { BendAllowanceSpacingPreview } from "../lib/instant-quote/bend-spacing-preview";

function spacing(overrides: Partial<BendAllowanceSpacingPreview["bends"][number]> = {}): BendAllowanceSpacingPreview {
  return {
    source: "approved-bend-allowance-spacing",
    displayOnly: true,
    productionAuthoritative: false,
    commercialSpacingApplied: true,
    status: "ready",
    rootPanelId: "panel-a",
    panelTranslationsMm: [
      { panelId: "panel-a", translationMm: [0, 0] },
      { panelId: "panel-b", translationMm: [0, -4.1] },
    ],
    bends: [
      {
        bendId: "bend-ab",
        parentPanelId: "panel-a",
        childPanelId: "panel-b",
        bendAllowanceMm: 4.1,
        gapBeforeMm: 0,
        gapAfterMm: 4.1,
        childCorrectionMm: [0, -4.1],
        parentTangentMm: [[0, 0], [100, 0]],
        childTangentBeforeMm: [[0, 0], [100, 0]],
        childTangentAfterMm: [[0, -4.1], [100, -4.1]],
        ...overrides,
      },
    ],
    errors: [],
  };
}

test("builds one explicit material strip from aligned tangency lines and approved allowance", () => {
  const candidate = buildBendStripRegionCandidate(spacing());

  assert.equal(candidate.status, "ready");
  assert.equal(candidate.productionAuthoritative, false);
  assert.equal(candidate.strips.length, 1);
  assert.equal(candidate.strips[0].bendId, "bend-ab");
  assert.ok(Math.abs(candidate.strips[0].bendLengthMm - 100) < 1e-8);
  assert.ok(Math.abs(candidate.strips[0].bendAllowanceMm - 4.1) < 1e-8);
  assert.ok(Math.abs(candidate.strips[0].areaMm2 - 410) < 1e-8);
  assert.deepEqual(candidate.strips[0].cornersMm, [
    [0, 0],
    [100, 0],
    [100, -4.1],
    [0, -4.1],
  ]);
});

test("blocks a bend strip when tangency endpoints are shifted along the bend axis", () => {
  const candidate = buildBendStripRegionCandidate(spacing({
    childTangentAfterMm: [[0.2, -4.1], [100.2, -4.1]],
  }));

  assert.equal(candidate.status, "blocked");
  assert.match(candidate.errors.join(" "), /endpoints do not align along the bend axis/i);
});

test("blocks a bend strip when approved allowance is not preserved at both endpoints", () => {
  const candidate = buildBendStripRegionCandidate(spacing({
    childTangentAfterMm: [[0, -4.1], [100, -4.4]],
  }));

  assert.equal(candidate.status, "blocked");
  assert.match(candidate.errors.join(" "), /not direction-aligned|does not preserve the approved allowance/i);
});

test("refuses to construct strips from a blocked spacing preview", () => {
  const input = spacing();
  input.status = "blocked";
  input.commercialSpacingApplied = false;
  input.errors = ["spacing blocked"];
  const candidate = buildBendStripRegionCandidate(input);

  assert.equal(candidate.status, "blocked");
  assert.deepEqual(candidate.strips, []);
  assert.match(candidate.errors.join(" "), /spacing blocked/i);
});
