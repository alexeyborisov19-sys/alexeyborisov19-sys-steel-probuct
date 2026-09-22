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
  assemblyRubPerHour: { rateRub: 600, source: fixtureSource },
  surfacePreparationRubPerM2: { rateRub: 200, source: fixtureSource },
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

test("geometry the DXF parser could not read blocks the price instead of warning about it", () => {
  const result = calculateProjectFactualCost(
    project,
    { "part-1": { unsupportedEntities: ["SPLINE_UNSUPPORTED"] } as unknown as ParsedDxf },
    snapshots,
    rateBook,
    {},
    now,
  );

  // An unread entity may carry cut length, pierces or area, so the part must
  // not reach a published price on a drawing that was only partly understood.
  assert.equal(result.parts[0].status, "blocked");
  assert.equal(result.parts[0].calculation, null);
  // The blocking reason is what the customer reads, so it names the geometry
  // that stayed unread and what to do about it.
  const [reason] = result.parts[0].dfmBlockingReasons;
  assert.ok(reason?.includes("SPLINE_UNSUPPORTED"), reason);
  assert.ok(/EXPLODE/.test(reason ?? ""), reason);
  assert.equal(result.blockedParts, 1);
  assert.equal(result.completeParts, 0);
  assert.equal(result.confirmedDirectCostRub, 0);
  assert.equal(result.allCostArticlesComplete, false);
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

test("assembly and surface preparation stay partial until physical inputs are supplied", () => {
  const withOperations: InstantQuoteProject = {
    ...project,
    parts: project.parts.map((part) => ({
      ...part,
      configuration: {
        ...part.configuration,
        operations: [...part.configuration.operations, "assembly", "surface-preparation"],
      },
    })),
  };

  const missing = calculateProjectFactualCost(withOperations, parsedByPartId, snapshots, rateBook, {}, now);
  assert.equal(missing.parts[0].status, "partial");
  assert.ok(missing.parts[0].calculation?.missing.some((item) => item.code === "assembly-time"));
  assert.ok(missing.parts[0].calculation?.missing.some((item) => item.code === "surface-preparation-area"));

  const completed = calculateProjectFactualCost(
    withOperations,
    parsedByPartId,
    snapshots,
    rateBook,
    {
      "part-1": {
        assemblyMinutes: 12,
        surfacePreparationAreaM2: 0.4,
      },
    },
    now,
  );

  assert.equal(completed.parts[0].status, "complete");
  assert.equal(completed.allCostArticlesComplete, true);
  assert.equal(completed.parts[0].calculation?.parameters.assemblyMinutesEach, 12);
  assert.equal(completed.parts[0].calculation?.parameters.surfacePreparationAreaM2Each, 0.4);
  assert.equal(completed.confirmedDirectCostRub, 9100);
});
test("a part without geometry leads with the reason the analysis measured", () => {
  // Only the first reason reaches the customer, so a generic sentence in front
  // of the real one is the same as not having the real one.
  const withoutGeometry: InstantQuoteProject = {
    ...project,
    parts: project.parts.map((part) => ({ ...part, geometry: null })),
  };
  const reason = "Толщина STEP-модели 3 мм не совпадает с выбранной в расчёте 1 мм.";

  const measured = calculateProjectFactualCost(
    withoutGeometry,
    { "part-1": { reviewReasons: [reason] } },
    snapshots,
    rateBook,
    {},
    now,
  );
  assert.equal(measured.parts[0].status, "missing-geometry");
  assert.deepEqual(measured.parts[0].dfmReviewReasons, [reason]);

  const silent = calculateProjectFactualCost(withoutGeometry, {}, snapshots, rateBook, {}, now);
  assert.equal(silent.parts[0].dfmReviewReasons.length, 1);
});


test("approved server-measured features clear the laser gate, violations block, bending still needs review", () => {
 const measured = {supported:true,reasons:[],holeCount:1,minHoleDiameterMm:1,minLigamentMm:3,minPartSideMm:500};
 const laserProject: InstantQuoteProject = {...project, parts:project.parts.map(p=>({...p,configuration:{...p.configuration,operations:["laser-cutting"]}}))};
 const calculate = (flatFeatures: typeof measured, candidate=laserProject) => calculateProjectFactualCost(candidate,{"part-1":{flatFeatures}},snapshots,rateBook,{},now).parts[0];
 const passed=calculate(measured);
 assert.equal(passed.status,"complete");assert.deepEqual(passed.dfmReviewReasons,[]);
 assert.equal(calculate({...measured,minHoleDiameterMm:0.99}).status,"blocked");
 assert.equal(calculate({...measured,minLigamentMm:2.99}).status,"blocked");
 assert.ok(calculate(measured,project).dfmReviewReasons.some(reason=>reason.includes("гиба")));
});
