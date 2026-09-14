import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizePartCalculationCompleteness,
  summarizeProjectCalculationCompleteness,
} from "../lib/instant-quote/calculation-completeness";
import type { FactualCalculationResult } from "../lib/instant-quote/factual-calculation";
import type { ProductionParameterSummary } from "../lib/instant-quote/production-parameters";
import type { ProjectFactualCalculationResult, ProjectFactualPartResult } from "../lib/instant-quote/project-factual-calculation";

const source = {
  id: "fixture",
  label: "Synthetic fixture",
  confirmedAt: "2099-01-01",
  note: "Test only",
};

function factual(overrides: Partial<FactualCalculationResult> = {}): FactualCalculationResult {
  return {
    kind: "factual-direct-cost",
    status: "complete",
    currency: "RUB",
    quantity: 10,
    materialId: "cold",
    thicknessMm: 1,
    materialAllocationStrategy: "bounding-rectangle",
    parameters: {
      netAreaMm2: 400000,
      blankAreaMm2: 500000,
      netMassKgEach: 3.12,
      purchasedMassKgEach: 3.9,
      cutLengthMmEach: 3000,
      pierceCountEach: 0,
      bendCountEach: null,
      weldLengthMEach: null,
      powderAreaM2Each: null,
    },
    lines: [
      {
        code: "material",
        label: "Материал",
        quantity: 3.9,
        unit: "кг/шт",
        rateRub: 100,
        amountRubEach: 390,
        amountRubBatch: 3900,
        source,
      },
      {
        code: "laser-cutting",
        label: "Лазерная резка",
        quantity: 3,
        unit: "м/шт",
        rateRub: 100,
        amountRubEach: 300,
        amountRubBatch: 3000,
        source,
      },
    ],
    confirmedDirectCostRubEach: 690,
    confirmedDirectCostRubBatch: 6900,
    missing: [],
    warnings: [],
    commercialPriceReady: false,
    ...overrides,
  };
}

const parameters: ProductionParameterSummary = {
  status: "ready",
  materialId: "cold",
  thicknessMm: 1,
  quantity: 10,
  densityKgM3: 7800,
  dimensionsMm: { width: 1000, height: 500, depth: null },
  stock: {
    strategy: "bounding-rectangle",
    blankWidthMm: 1000,
    blankHeightMm: 500,
    blankAreaMm2: 500000,
    nestedAllocatedAreaMm2: null,
    netAreaMm2: 400000,
    wasteAreaMm2Each: 100000,
    wastePct: 20,
  },
  mass: {
    netKgEach: 3.12,
    netKgBatch: 31.2,
    purchasedKgEach: 3.9,
    purchasedKgBatch: 39,
  },
  cutting: {
    cutLengthMmEach: 3000,
    cutLengthMBatch: 30,
    contourCountEach: 1,
    contourCountBatch: 10,
    pierceCountEach: 0,
    pierceCountBatch: 0,
    holeCountEach: 0,
    holeCountBatch: 0,
  },
  bending: { bendCountEach: null, bendCountBatch: null },
  welding: { weldLengthMEach: null, weldLengthMBatch: null },
  coating: { powderSides: null, powderAreaM2Each: null, powderAreaM2Batch: null },
  issues: [],
};

function part(calculation: FactualCalculationResult | null = factual()): ProjectFactualPartResult {
  return {
    partId: "part-1",
    status: calculation?.status ?? "missing-geometry",
    calculation,
    dfmBlockingReasons: [],
    dfmReviewReasons: [],
  };
}

test("marks a fully confirmed factual part as ready and 100 percent", () => {
  const summary = summarizePartCalculationCompleteness(part(), parameters);
  assert.equal(summary.status, "ready");
  assert.equal(summary.scorePct, 100);
  assert.equal(summary.confirmedChecks, summary.totalChecks);
});

test("keeps selected welding in review until actual weld length or rate is confirmed", () => {
  const calculation = factual({
    status: "partial",
    missing: [{
      code: "weld-length",
      label: "Сварка",
      reason: "Нужна фактическая длина сварного шва на деталь.",
      blocking: false,
    }],
  });
  const summary = summarizePartCalculationCompleteness(part(calculation), parameters);
  assert.equal(summary.status, "review");
  assert.ok(summary.scorePct < 100);
  assert.equal(summary.items.find((item) => item.key === "article:welding")?.state, "missing");
});

test("DFM blocking reason always makes the part blocked", () => {
  const blockedPart: ProjectFactualPartResult = {
    ...part(),
    status: "blocked",
    calculation: null,
    dfmBlockingReasons: ["Габарит превышает рабочее поле"],
  };
  const summary = summarizePartCalculationCompleteness(blockedPart, parameters);
  assert.equal(summary.status, "blocked");
  assert.ok(summary.items.some((item) => item.key === "dfm:blocking" && item.state === "blocked"));
});

test("aggregates project readiness from all part checks", () => {
  const readyPart = part();
  const reviewCalculation = factual({
    status: "partial",
    missing: [{
      code: "powder-area",
      label: "Порошковая окраска",
      reason: "Нужна фактическая окрашиваемая площадь.",
      blocking: false,
    }],
  });
  const reviewPart: ProjectFactualPartResult = {
    ...part(reviewCalculation),
    partId: "part-2",
  };
  const calculation: ProjectFactualCalculationResult = {
    kind: "project-factual-direct-cost",
    parts: [readyPart, reviewPart],
    completeParts: 1,
    partialParts: 1,
    blockedParts: 0,
    totalParts: 2,
    confirmedDirectCostRub: 13800,
    allCostArticlesComplete: false,
    commercialPriceReady: false,
  };

  const summary = summarizeProjectCalculationCompleteness(calculation, {
    "part-1": parameters,
    "part-2": parameters,
  });
  assert.equal(summary.status, "review");
  assert.equal(summary.readyParts, 1);
  assert.equal(summary.reviewParts, 1);
  assert.equal(summary.blockedParts, 0);
  assert.ok(summary.scorePct < 100);
});
