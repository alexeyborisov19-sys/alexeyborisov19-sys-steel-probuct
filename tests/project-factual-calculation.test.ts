import assert from "node:assert/strict";
import test from "node:test";
import type { InstantQuoteProject } from "../lib/instant-quote/domain";
import type { ParsedDxf } from "../lib/instant-quote/dxf";
import type { FactualRateBook } from "../lib/instant-quote/factual-calculation";
import type { StoredPriceSnapshot } from "../lib/instant-quote/material-price-feed";
import { calculateProjectFactualCost } from "../lib/instant-quote/project-factual-calculation";

const now = new Date("2099-01-01T12:00:00.000Z");
const fixtureSource = { id: "fixture", label: "Synthetic fixture", confirmedAt: "2099-01-01", note: "Non-production test values." };
const rateBook: FactualRateBook = {
  laserRubPerM: [{ materialId: "cold", thicknessMm: 1, rateRub: 100, source: fixtureSource }],
  bendRubEach: { rateRub: 10, source: fixtureSource },
  weldRubPerM: { rateRub: 1000, source: fixtureSource },
  powderRubPerM2: { rateRub: 200, source: fixtureSource },
};

const snapshots: StoredPriceSnapshot[] = [
  {
    sourceId: "synthetic-supplier",
    fetchedAt: "2099-01-01T10:00:00.000Z",
    sourceDate: "2099-01-01",
    status: "ok",
    rows: [
      {
        materialId: "cold",
        thicknessMm: 1,
        rubPerTon: 100000,
        source: "Synthetic supplier fixture",
        sourceDate: "2099-01-01",
        fetchedAt: "2099-01-01T10:00:00.000Z",
      },
    ],
  },
];

const project: InstantQuoteProject = {
  id: "project-test",
  title: "Test factual project",
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  activePartId: "part-1",
  parts: [
    {
      id: "part-1",
      fileName: "part.dxf",
      format: "dxf",
      fileSizeBytes: 100,
      createdAt: now.toISOString(),
      state: "configurable",
      geometry: {
        widthMm: 1000,
        heightMm: 500,
        areaMm2: 500000,
        blankAreaMm2: 500000,
        cutLengthMm: 3000,
        contourCount: 0,
        pierceCount: 0,
        bendCount: 2,
      },
      configuration: {
        materialId: "cold",
        thicknessMm: 1,
        quantity: 10,
        operations: ["laser-cutting", "bending"],
      },
      quote: { kind: "not-requested" },
    },
  ],
};

const parsedByPartId = {
  "part-1": { unsupportedEntities: [] } as unknown as ParsedDxf,
};

test("aggregates internal factual direct cost at project level", () => {
  const result = calculateProjectFactualCost(project, parsedByPartId, snapshots, rateBook, {}, now);

  assert.equal(result.parts.length, 1);
  assert.equal(result.parts[0].status, "complete");
  assert.equal(result.completeParts, 1);
  assert.equal(result.confirmedDirectCostRub, 7100);
  assert.equal(result.allCostArticlesComplete, true);
  assert.equal(result.commercialPriceReady, false);
});

test("keeps project incomplete when a selected operation lacks a factual input", () => {
  const withWelding: InstantQuoteProject = {
    ...project,
    parts: project.parts.map((part) => ({
      ...part,
      configuration: { ...part.configuration, operations: [...part.configuration.operations, "welding"] },
    })),
  };

  const result = calculateProjectFactualCost(withWelding, parsedByPartId, snapshots, rateBook, {}, now);
  assert.equal(result.parts[0].status, "partial");
  assert.equal(result.allCostArticlesComplete, false);
  assert.ok(result.parts[0].calculation?.missing.some((item) => item.code === "weld-length"));
});

test("completes welding only after actual weld length is supplied", () => {
  const withWelding: InstantQuoteProject = {
    ...project,
    parts: project.parts.map((part) => ({
      ...part,
      configuration: { ...part.configuration, operations: [...part.configuration.operations, "welding"] },
    })),
  };

  const result = calculateProjectFactualCost(
    withWelding,
    parsedByPartId,
    snapshots,
    rateBook,
    { "part-1": { weldLengthM: 0.5 } },
    now,
  );

  assert.equal(result.parts[0].status, "complete");
  assert.equal(result.confirmedDirectCostRub, 12100);
});
