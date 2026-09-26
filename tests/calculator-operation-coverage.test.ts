import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateFactualProductionCost,
  type FactualRateBook,
} from "../lib/instant-quote/factual-calculation";
import { resolveEffectiveFactualInputs } from "../lib/instant-quote/factual-input-resolution";
import type { InstantQuoteProject, ManufacturingOperation } from "../lib/instant-quote/domain";
import type { MaterialMarketPrice } from "../lib/instant-quote/pricing";

const source = {
  id: "test-fixture",
  label: "Synthetic test fixture",
  confirmedAt: "2099-01-01",
  note: "Non-production values used only by automated tests.",
};

const rate = (rateRub: number) => ({ rateRub, source });

/** Every rate the public configurator can reach, all present. */
const rateBook: FactualRateBook = {
  laserRubPerM: [{
    materialId: "cold",
    thicknessMm: 2,
    rateRub: 100,
    from100mRubPerM: 80,
    from500mRubPerM: 60,
    pierceRubEach: 2,
    source,
  }],
  bendRubEach: rate(10),
  weldRubPerM: rate(1000),
  countersinkRubEach: rate(35),
  powderRubPerM2: rate(200),
  assemblyRubPerHour: rate(1500),
  surfacePreparationRubPerM2: rate(120),
  packagingRubEach: rate(50),
};

const marketPrice: MaterialMarketPrice = {
  materialId: "cold",
  thicknessMm: 2,
  rubPerTon: 100_000,
  source: "Synthetic supplier fixture",
  sourceDate: "2099-01-01",
  fetchedAt: "2099-01-01T00:00:00.000Z",
  exactThickness: true,
};

const geometry = {
  widthMm: 400,
  heightMm: 250,
  areaMm2: 99_574,
  blankAreaMm2: 100_000,
  cutLengthMm: 1433.1,
  pierceCount: 4,
  contourCount: 4,
};

/** Every operation offered by the public configurator, plus the base route. */
const PUBLIC_OPERATIONS: ManufacturingOperation[] = [
  "laser-cutting",
  "bending",
  "welding",
  "countersink",
  "assembly",
  "surface-preparation",
  "powder-coating",
  "packaging",
];

function project(operations: ManufacturingOperation[]): InstantQuoteProject {
  return {
    id: "project-1",
    title: "Coverage project",
    createdAt: "2099-01-01T00:00:00.000Z",
    updatedAt: "2099-01-01T00:00:00.000Z",
    activePartId: "part-1",
    parts: [{
      id: "part-1",
      fileName: "plate.dxf",
      format: "dxf",
      fileSizeBytes: 1000,
      createdAt: "2099-01-01T00:00:00.000Z",
      state: "configurable",
      geometry,
      configuration: { materialId: "cold", thicknessMm: 2, quantity: 10, operations, operationInputs: {} },
      quote: { kind: "not-requested" },
    }],
  };
}

function priceWith(operations: ManufacturingOperation[]) {
  // Side counts and editable operation quantities flow through the resolver in
  // exactly the same shape as the public handler sends them.
  const resolved = resolveEffectiveFactualInputs(
    project(operations),
    { "part-1": { bendCount: 2, weldLengthM: 1.5, countersinkCount: 4, assemblyMinutes: 30 } },
    { "part-1": 2 },
    {},
    { "part-1": 2 },
  );

  return calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 2,
    quantity: 10,
    geometry,
    marketPrice,
    materialPriceSourceId: "fixture-supplier",
    materialPriceStale: false,
    materialMarketUpliftPct: 5,
    operations,
    rateBook,
    ...resolved["part-1"],
  });
}

test("every operation the configurator offers can actually be priced", () => {
  const result = priceWith(PUBLIC_OPERATIONS);

  assert.deepEqual(result.missing, [], "no cost article may be left unresolved");
  assert.equal(result.status, "complete");

  for (const code of [
    "material",
    "laser-cutting",
    "laser-piercing",
    "bending",
    "welding",
    "countersink",
    "assembly",
    "surface-preparation",
    "powder-coating",
    "packaging",
  ]) {
    assert.ok(
      result.lines.some((line) => line.code === code),
      `no cost line produced for ${code}`,
    );
  }
});

test("each operation priced on its own also completes", () => {
  for (const operation of PUBLIC_OPERATIONS) {
    const operations: ManufacturingOperation[] = operation === "laser-cutting"
      ? ["laser-cutting"]
      : ["laser-cutting", operation];
    const result = priceWith(operations);
    assert.deepEqual(
      result.missing.map((item) => item.code),
      [],
      `${operation} left something unresolved`,
    );
    assert.equal(result.status, "complete", `${operation} did not complete`);
  }
});

test("an area-based operation without its side count stays incomplete rather than guessed", () => {
  const withoutSides = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 2,
    quantity: 10,
    geometry,
    marketPrice,
    materialPriceStale: false,
    operations: ["laser-cutting", "surface-preparation", "powder-coating"],
    rateBook,
  });

  const codes = withoutSides.missing.map((item) => item.code).sort();
  assert.deepEqual(codes, ["powder-area", "surface-preparation-area"]);
  assert.equal(withoutSides.status, "partial");
});

test("quantities only a technologist knows are labelled as the customer's own estimate", async () => {
  const { readFile } = await import("node:fs/promises");
  const controls = await readFile(new URL("../components/instant-quote/ClientOperationControls.tsx", import.meta.url), "utf8");

  // Weld length and assembly minutes go straight into the automatic price, but
  // a customer is not a technologist: five minutes entered instead of thirty is
  // a five-fold error in that article. The field says whose number it is.
  for (const marker of ["Ваша оценка", "подтвердит технолог", "определит технолог"]) {
    assert.ok(controls.includes(marker), `operation controls missing "${marker}"`);
  }

  // The bend count is different: it is read off the model, not estimated.
  assert.match(controls, /Определено по 3D-модели/);
});

test("manual entry carries its hole count into the countersink input", async () => {
  const { readFile } = await import("node:fs/promises");
  const manualEditor = await readFile(new URL("../components/cad/public/PublicManualSheetParts.tsx", import.meta.url), "utf8");

  assert.match(manualEditor, /manualHoleCount/);
  assert.match(manualEditor, /reconcileManualOperationInputs/);
  assert.match(manualEditor, /количество переносится в расчёт/);
});
