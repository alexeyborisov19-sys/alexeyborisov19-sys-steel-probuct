import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

/**
 * End-to-end check against the owner's approved reference parts, run through
 * the real OpenCascade kernel rather than hand-built face fixtures.
 *
 * The unit tests prove the measurement's arithmetic. This one proves the thing
 * they cannot: that the kernel actually describes a sheet the way the
 * measurement expects — which is exactly where the earlier classification bug
 * lived. It needs occt-wasm, so it runs in CI and skips where node_modules is
 * unavailable; a skip is reported loudly rather than passing silently.
 */
/**
 * Only an absent occt-wasm package skips the check. Any other failure is the
 * kernel genuinely refusing the part, and must surface as a failure rather than
 * quietly disappear into a skip.
 */
function isMissingKernelPackage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Cannot find (?:package|module) 'occt-wasm'/.test(message)
    || /ERR_MODULE_NOT_FOUND/.test((error as { code?: string })?.code ?? "");
}

async function analyze(fixture: string) {
  const bytes = new Uint8Array(await readFile(new URL(`./fixtures/cad/${fixture}`, import.meta.url)));
  try {
    const [{ createStepCadAdapter }, { occtStepKernel }] = await Promise.all([
      import("@/lib/instant-quote/step-adapter"),
      import("@/lib/instant-quote/occt-step-kernel"),
    ]);
    return await createStepCadAdapter(occtStepKernel).analyze({ fileName: fixture, format: "step", bytes });
  } catch (error) {
    if (isMissingKernelPackage(error)) return null;
    throw error;
  }
}

test("the reference angle measures to its approved blank through the real kernel", async (t) => {
  const model = await analyze("reference-angle.step");
  if (!model) {
    t.skip("occt-wasm is unavailable in this environment; the reference check did not run");
    return;
  }

  const sheetMetal = model.sheetMetal;
  assert.ok(sheetMetal, "the kernel returned no sheet-metal observations for the reference angle");

  const thicknessMm = sheetMetal.thicknessCandidate?.thicknessMm;
  assert.ok(
    thicknessMm != null && Math.abs(thicknessMm - 1.5) < 0.01,
    `expected the reference thickness 1,5 mm, kernel reported ${thicknessMm}`,
  );

  const development = sheetMetal.development;
  assert.ok(development, "the kernel produced no development measurement for the reference angle");

  assert.equal(
    development.status,
    "measured",
    `reference angle was not measurable: ${development.reasons.join(" | ")}`,
  );

  // The owner's approved reference: unfold 250 x 157,3 mm, cut 814,6 mm, one pierce.
  const blankAreaMm2 = development.developedAreaMm2 ?? 0;
  assert.ok(
    Math.abs(blankAreaMm2 - 250 * 157.3) / (250 * 157.3) < 0.005,
    `approved blank ${250 * 157.3} mm², measured ${blankAreaMm2.toFixed(1)}`,
  );
  assert.ok(
    Math.abs((development.cutLengthMm ?? 0) - 814.6) / 814.6 < 0.005,
    `approved cut 814,6 mm, measured ${(development.cutLengthMm ?? 0).toFixed(2)}`,
  );
  assert.equal(development.contourCount, 1, "the reference angle has a single contour");
});

test("the reference plate measures to its approved blank through the real kernel", async (t) => {
  const model = await analyze("reference-plate.step");
  if (!model) {
    t.skip("occt-wasm is unavailable in this environment; the reference check did not run");
    return;
  }

  const sheetMetal = model.sheetMetal;
  assert.ok(sheetMetal, "the kernel returned no sheet-metal observations for the reference plate");

  const thicknessMm = sheetMetal.thicknessCandidate?.thicknessMm;
  assert.ok(
    thicknessMm != null && Math.abs(thicknessMm - 2) < 0.01,
    `expected the reference thickness 2 mm, kernel reported ${thicknessMm}`,
  );

  const development = sheetMetal.development;
  assert.ok(development, "the kernel produced no development measurement for the reference plate");

  assert.equal(
    development.status,
    "measured",
    `reference plate was not measurable: ${development.reasons.join(" | ")}`,
  );

  // Approved reference: 300 x 200 net 57 286 mm², cut 1 262,8 mm, three pierces.
  assert.ok(
    Math.abs((development.developedAreaMm2 ?? 0) - 57_286) / 57_286 < 0.005,
    `approved net area 57 286 mm², measured ${(development.developedAreaMm2 ?? 0).toFixed(1)}`,
  );
  assert.ok(
    Math.abs((development.cutLengthMm ?? 0) - 1_262.8) / 1_262.8 < 0.005,
    `approved cut 1 262,8 mm, measured ${(development.cutLengthMm ?? 0).toFixed(2)}`,
  );
  assert.equal(development.contourCount, 3, "the reference plate has an outer profile, a hole and a cut-out");
});

/**
 * The question the measurement tests cannot answer: does a STEP part actually
 * reach a price? The gate lives in the calculation handler, so it is driven
 * here rather than restated — a restatement would pass while production
 * refused the same part.
 */
async function serverAnalysis(fixture: string) {
  const bytes = await readFile(new URL(`./fixtures/cad/${fixture}`, import.meta.url));
  try {
    const { analyzePlanarStep } = await import("@/lib/server/instant-quote/calculation-handler");
    return await analyzePlanarStep(
      {
        originalName: fixture,
        safeName: fixture,
        extension: "step",
        browserMime: "application/step",
        size: bytes.byteLength,
        safety: "unverified-cad",
        buffer: bytes,
      },
      "step",
    );
  } catch (error) {
    if (isMissingKernelPackage(error)) return null;
    throw error;
  }
}

test("a flat reference plate carries production geometry into the price", async (t) => {
  const analysis = await serverAnalysis("reference-plate.step");
  if (!analysis) {
    t.skip("occt-wasm is unavailable in this environment; the pricing gate did not run");
    return;
  }

  const { model, productionReady } = analysis;
  assert.equal(
    productionReady,
    true,
    `a plain plate is the simplest case there is; if it is not priced, no STEP is. `
      + `flatPattern=${model.sheetMetal?.flatPatternCandidate?.confidence ?? "none"} `
      + `area=${model.geometry.areaMm2} blank=${model.geometry.blankAreaMm2} `
      + `cut=${model.geometry.cutLengthMm} contours=${model.geometry.contourCount}`,
  );
});

test("the reference angle carries its measured blank into the price", async (t) => {
  const analysis = await serverAnalysis("reference-angle.step");
  if (!analysis) {
    t.skip("occt-wasm is unavailable in this environment; the pricing gate did not run");
    return;
  }

  const { model, productionReady } = analysis;
  // The development measures to the approved blank in the test above. This
  // asserts the measurement is not then dropped on the way to the price.
  assert.equal(
    productionReady,
    true,
    `the development measures to the approved blank, so it must reach the price. `
      + `development=${model.sheetMetal?.development?.status ?? "none"} `
      + `area=${model.geometry.areaMm2} blank=${model.geometry.blankAreaMm2} `
      + `cut=${model.geometry.cutLengthMm} contours=${model.geometry.contourCount} `
      + `bends=${model.geometry.bendCount}`,
  );
  assert.equal(model.geometry.bendCount, 1, "a bent part priced without its bend count loses the bending");
});
