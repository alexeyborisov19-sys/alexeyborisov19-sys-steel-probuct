import assert from "node:assert/strict";
import test from "node:test";
import type { InstantQuoteProject } from "../lib/instant-quote/domain";
import type { ParsedDxf } from "../lib/instant-quote/dxf";
import type { StoredPriceSnapshot } from "../lib/instant-quote/material-price-feed";
import { calculateProjectFactualCost } from "../lib/instant-quote/project-factual-calculation";

const now = new Date("2026-09-13T12:00:00.000Z");

const snapshots: StoredPriceSnapshot[] = [
  {
    sourceId: "atlantik-smolensk",
    fetchedAt: "2026-09-13T10:00:00.000Z",
    sourceDate: "2026-09-13",
    status: "ok",
    rows: [
      {
        materialId: "cold",
        thicknessMm: 1,
        rubPerTon: 72400,
        source: "Атлантик Компани",
        sourceDate: "2026-09-13",
        fetchedAt: "2026-09-13T10:00:00.000Z",
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

test("aggregates confirmed factual direct cost at project level", () => {
  const result = calculateProjectFactualCost(project, parsedByPartId, snapshots, {}, now);

  assert.equal(result.parts.length, 1);
  assert.equal(result.parts[0].status, "complete");
  assert.equal(result.completeParts, 1);
  assert.equal(result.partialParts, 0);
  assert.equal(result.blockedParts, 0);
  assert.equal(result.confirmedDirectCostRub, 4823.6);
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

  const result = calculateProjectFactualCost(withWelding, parsedByPartId, snapshots, {}, now);
  assert.equal(result.parts[0].status, "partial");
  assert.equal(result.completeParts, 0);
  assert.equal(result.partialParts, 1);
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
    { "part-1": { weldLengthM: 0.5 } },
    now,
  );

  assert.equal(result.parts[0].status, "complete");
  assert.equal(result.confirmedDirectCostRub, 13823.6);
});
