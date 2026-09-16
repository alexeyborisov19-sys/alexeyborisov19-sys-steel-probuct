import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import type { NormalizedCadModel } from "../lib/instant-quote/cad-model";
import type { SheetMetalAnalysis } from "../lib/instant-quote/sheet-metal";
import { createOnlineCalculationHandler } from "../lib/server/instant-quote/calculation-handler";
import type { OnlineCalculationHandlerDependencies } from "../lib/server/instant-quote/calculation-handler";
import { rateLimitStore } from "../lib/security/rate-limit";

const stepBytes = "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n";
const binaryDxf = Buffer.concat([
  Buffer.from("AutoCAD Binary DXF\r\n", "latin1"),
  Buffer.from([0x1a, 0x00, 0x00, 0x01, 0x02, 0x03]),
]);

beforeEach(() => {
  rateLimitStore.clear();
});

function upload(name: string, body: BlobPart) {
  const form = new FormData();
  form.set("manifest", JSON.stringify({
    title: "Thickness guard",
    parts: [{ clientPartId: "part-1", fileIndex: 0, materialId: "hot", thicknessMm: 1, quantity: 1, operations: [] }],
  }));
  form.append("files", new File([body], name, { type: "application/octet-stream" }));
  return new Request("https://www.steelprodukt.ru/api/online-order/calculate", {
    method: "POST",
    headers: { Origin: "https://www.steelprodukt.ru" },
    body: form,
  });
}

function sheetMetal(thicknessMm: number): SheetMetalAnalysis {
  return {
    source: "brep",
    status: "candidate",
    planarFaceCount: 2,
    cylindricalFaceCount: 0,
    otherFaceCount: 0,
    thicknessCandidate: { thicknessMm, confidence: "medium", evidencePairs: 1, evidenceFaceIds: ["a", "b"] },
    bendCandidates: [],
    warnings: [],
  } as unknown as SheetMetalAnalysis;
}

function stepModel(thicknessMm: number): NormalizedCadModel {
  return {
    format: "step",
    units: "mm",
    geometry: {
      widthMm: 300,
      heightMm: 200,
      depthMm: thicknessMm,
      areaMm2: 57_286,
      blankAreaMm2: 60_000,
      cutLengthMm: 1_262.8,
      contourCount: 3,
      pierceCount: 3,
      bendCount: 0,
    },
    meshes: [],
    root: null,
    features: [],
    sheetMetal: sheetMetal(thicknessMm),
    metadata: { sourceFileName: "part.step", sourceBytes: stepBytes.length, parser: "test", analyzedAt: "2099-01-01T00:00:00.000Z" },
    warnings: [],
  } as unknown as NormalizedCadModel;
}

function dependencies(input: {
  measuredThicknessMm?: number;
  extension?: string;
  buffer?: Buffer;
  onRun?: (
    project: Parameters<OnlineCalculationHandlerDependencies["runCalculation"]>[0],
    evidence: Parameters<OnlineCalculationHandlerDependencies["runCalculation"]>[1],
  ) => void;
}): Partial<OnlineCalculationHandlerDependencies> {
  const extension = input.extension ?? "step";
  return {
    inspectUploads: async (files) => [{
      originalName: files[0].name,
      safeName: `part.${extension}`,
      extension,
      browserMime: "application/octet-stream",
      size: files[0].size,
      safety: "unverified-cad",
      buffer: input.buffer ?? Buffer.from(await files[0].arrayBuffer()),
    }],
    quarantineUploads: async (_requestId, inspections) => [{
      originalName: inspections[0].originalName,
      safeName: inspections[0].safeName,
      extension: inspections[0].extension,
      browserMime: inspections[0].browserMime,
      size: inspections[0].size,
      safety: "unverified-cad",
      storageId: `synthetic.${extension}`,
      antivirus: "clean",
    }],
    analyzeStep: async () => ({
      productionReady: true,
      model: stepModel(input.measuredThicknessMm ?? 1),
      authoritativeFactualInputs: {},
    }),
    runCalculation: async (project, evidence) => {
      input.onRun?.(project, evidence);
      return {
        kind: "client-calculation" as const,
        projectId: project.id,
        title: project.title,
        paymentEnabled: false as const,
        parts: [],
      };
    },
  };
}

test("a STEP drawn in 3 mm is not priced as the 1 mm the customer left selected", async () => {
  let pricedGeometry: unknown = "unset";
  let reasons: string[] = [];
  const handler = createOnlineCalculationHandler(dependencies({
    measuredThicknessMm: 3,
    onRun: (project, evidence) => {
      pricedGeometry = project.parts[0].geometry;
      reasons = evidence["part-1"]?.reviewReasons ?? [];
    },
  }));

  const res = await handler(upload("part.step", stepBytes));

  assert.equal(res.status, 200);
  // No geometry means no material and no laser: the part cannot be priced at
  // all, rather than being priced against a thickness the model contradicts.
  assert.equal(pricedGeometry, null);
  assert.ok(
    reasons.some((reason) => reason.includes("3") && reason.includes("1") && reason.includes("не совпадает")),
    `expected a thickness contradiction, got: ${reasons.join(" | ")}`,
  );
});

test("mill tolerance is not a contradiction: a 1,05 mm model still prices as 1 mm", async () => {
  let pricedGeometry: unknown = null;
  const handler = createOnlineCalculationHandler(dependencies({
    measuredThicknessMm: 1.05,
    onRun: (project) => {
      pricedGeometry = project.parts[0].geometry;
    },
  }));

  const res = await handler(upload("part.step", stepBytes));

  assert.equal(res.status, 200);
  assert.ok(pricedGeometry, "a thickness within tolerance must still be priced");
});

test("a binary DXF goes to an engineer instead of being read as an empty drawing", async () => {
  let pricedGeometry: unknown = "unset";
  let state: string | undefined;
  let reasons: string[] = [];
  const handler = createOnlineCalculationHandler(dependencies({
    extension: "dxf",
    buffer: binaryDxf,
    onRun: (project, evidence) => {
      pricedGeometry = project.parts[0].geometry;
      state = project.parts[0].state;
      reasons = evidence["part-1"]?.reviewReasons ?? [];
    },
  }));

  const res = await handler(upload("part.dxf", binaryDxf));

  assert.equal(res.status, 200);
  assert.equal(pricedGeometry, null);
  assert.equal(state, "manual-review");
  assert.ok(
    reasons.some((reason) => reason.includes("двоичный DXF")),
    `expected a binary-DXF reason, got: ${reasons.join(" | ")}`,
  );
});

test("a DXF without units puts one position in review instead of failing the project", async () => {
  // Real ASCII DXF geometry, but no $INSUNITS header — a common export result.
  const noUnits = "0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n90\n4\n70\n1\n10\n0\n20\n0\n10\n100\n20\n0\n10\n100\n20\n50\n10\n0\n20\n50\n0\nENDSEC\n0\nEOF\n";
  let pricedGeometry: unknown = "unset";
  let state: string | undefined;
  let reasons: string[] = [];
  const handler = createOnlineCalculationHandler(dependencies({
    extension: "dxf",
    buffer: Buffer.from(noUnits, "utf8"),
    onRun: (project, evidence) => {
      pricedGeometry = project.parts[0].geometry;
      state = project.parts[0].state;
      reasons = evidence["part-1"]?.reviewReasons ?? [];
    },
  }));

  const res = await handler(upload("part.dxf", noUnits));

  // The adapter refuses a drawing whose units it cannot establish. That
  // exception used to escape and turn the whole request into a 503, so one
  // unreadable file killed every other position in the project.
  assert.equal(res.status, 200);
  assert.equal(pricedGeometry, null);
  assert.equal(state, "manual-review");
  // The reason names the two headers that would have settled it, so the
  // customer can fix the export instead of guessing what "units" means.
  assert.ok(
    reasons.some((reason) => reason.includes("единицы измерения") && reason.includes("$INSUNITS")),
    `expected a units reason, got: ${reasons.join(" | ")}`,
  );
});
