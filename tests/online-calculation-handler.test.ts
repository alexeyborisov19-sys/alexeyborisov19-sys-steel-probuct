import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import type { NormalizedCadModel } from "../lib/instant-quote/cad-model";
import { createOnlineCalculationHandler } from "../lib/server/instant-quote/calculation-handler";
import type { OnlineCalculationHandlerDependencies } from "../lib/server/instant-quote/calculation-handler";
import { rateLimitStore } from "../lib/security/rate-limit";

const dxf = `0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES
0
LWPOLYLINE
90
4
70
1
10
0
20
0
10
100
20
0
10
100
20
50
10
0
20
50
0
ENDSEC
0
EOF
`;
const stepBytes = "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n";

beforeEach(() => {
  rateLimitStore.clear();
});

function request(manifest: Record<string, unknown>) {
  const form = new FormData();
  form.set("manifest", JSON.stringify(manifest));
  form.append("files", new File([dxf], "part.dxf", { type: "application/octet-stream" }));
  return new Request("https://www.steelprodukt.ru/api/online-order/calculate", {
    method: "POST",
    headers: { Origin: "https://www.steelprodukt.ru" },
    body: form,
  });
}

function stepRequest(manifest: Record<string, unknown>, fileName = "part.step") {
  const form = new FormData();
  form.set("manifest", JSON.stringify(manifest));
  form.append("files", new File([stepBytes], fileName, { type: "application/octet-stream" }));
  return new Request("https://www.steelprodukt.ru/api/online-order/calculate", {
    method: "POST",
    headers: { Origin: "https://www.steelprodukt.ru" },
    body: form,
  });
}

function clientView(project: Parameters<OnlineCalculationHandlerDependencies["runCalculation"]>[0]) {
  return {
    kind: "client-calculation" as const,
    projectId: project.id,
    title: project.title,
    paymentEnabled: false as const,
    parts: project.parts.map((part) => ({
      partId: part.id,
      fileName: part.fileName,
      format: part.format,
      status: (part.geometry ? "ready" : "needs-review") as "ready" | "needs-review",
      configuration: {
        materialId: part.configuration.materialId,
        thicknessMm: part.configuration.thicknessMm,
        quantity: part.configuration.quantity,
        operations: [...part.configuration.operations],
      },
      cad: {
        widthMm: part.geometry?.widthMm ?? null,
        heightMm: part.geometry?.heightMm ?? null,
        depthMm: part.geometry?.depthMm ?? null,
      },
      price: { status: "not-published" as const },
      message: part.geometry ? "Внутренний расчёт завершён." : "Требуется внутренняя проверка.",
    })),
  };
}

function dependencies(onProject?: (project: Parameters<OnlineCalculationHandlerDependencies["runCalculation"]>[0]) => void): Partial<OnlineCalculationHandlerDependencies> {
  return {
    inspectUploads: async (files) => [{
      originalName: files[0].name,
      safeName: "part.dxf",
      extension: "dxf",
      browserMime: files[0].type || "application/octet-stream",
      size: files[0].size,
      safety: "unverified-cad",
      buffer: Buffer.from(await files[0].arrayBuffer()),
    }],
    quarantineUploads: async () => [{
      originalName: "part.dxf",
      safeName: "part.dxf",
      extension: "dxf",
      browserMime: "application/octet-stream",
      size: dxf.length,
      safety: "unverified-cad",
      storageId: "synthetic-storage-id.dxf",
      antivirus: "clean",
    }],
    runCalculation: async (project) => {
      onProject?.(project);
      return clientView(project);
    },
  };
}

function stepModel(geometry: NormalizedCadModel["geometry"], warnings: string[] = []): NormalizedCadModel {
  return {
    format: "step",
    units: "mm",
    geometry,
    meshes: [],
    root: null,
    features: [],
    metadata: {
      sourceFileName: "part.step",
      sourceBytes: stepBytes.length,
      parser: "synthetic-server-step-test",
      analyzedAt: "2099-01-01T00:00:00.000Z",
    },
    warnings,
  };
}

function stepDependencies(input: {
  productionReady: boolean;
  model?: NormalizedCadModel;
  throwAnalysis?: boolean;
  authoritativePowderAreaM2?: number;
  onAnalysis?: (format: "step" | "stp") => void;
  onRun?: (
    project: Parameters<OnlineCalculationHandlerDependencies["runCalculation"]>[0],
    evidence: Parameters<OnlineCalculationHandlerDependencies["runCalculation"]>[1],
    inputs: Parameters<OnlineCalculationHandlerDependencies["runCalculation"]>[2],
  ) => void;
}): Partial<OnlineCalculationHandlerDependencies> {
  return {
    inspectUploads: async (files) => {
      const file = files[0];
      const extension = file.name.toLowerCase().endsWith(".stp") ? "stp" : "step";
      return [{
        originalName: file.name,
        safeName: `part.${extension}`,
        extension,
        browserMime: file.type || "application/octet-stream",
        size: file.size,
        safety: "unverified-cad",
        buffer: Buffer.from(await file.arrayBuffer()),
      }];
    },
    quarantineUploads: async (_requestId, inspections) => [{
      originalName: inspections[0].originalName,
      safeName: inspections[0].safeName,
      extension: inspections[0].extension,
      browserMime: inspections[0].browserMime,
      size: inspections[0].size,
      safety: "unverified-cad",
      storageId: "synthetic-step-storage-id.step",
      antivirus: "clean",
    }],
    analyzeStep: async (_inspection, format) => {
      input.onAnalysis?.(format);
      if (input.throwAnalysis) throw new Error("synthetic STEP failure");
      return {
        productionReady: input.productionReady,
        model: input.model ?? stepModel({
          widthMm: 120,
          heightMm: 80,
          depthMm: 2,
          areaMm2: 9600,
          blankAreaMm2: 9600,
          cutLengthMm: 400,
          contourCount: 1,
          pierceCount: 1,
          bendCount: 0,
        }),
        authoritativeFactualInputs: input.authoritativePowderAreaM2 == null
          ? undefined
          : { powderAreaM2: input.authoritativePowderAreaM2 },
      };
    },
    runCalculation: async (project, evidence, inputs) => {
      input.onRun?.(project, evidence, inputs);
      return clientView(project);
    },
  };
}

const stepManifest = {
  title: "STEP safe project",
  parts: [{
    clientPartId: "step-part-1",
    fileIndex: 0,
    materialId: "hot",
    thicknessMm: 2,
    quantity: 3,
    operations: [],
  }],
};

test("server derives DXF geometry and does not trust client production metrics", async () => {
  let serverCutLength: number | undefined;
  const handler = createOnlineCalculationHandler(dependencies((project) => {
    serverCutLength = project.parts[0].geometry?.cutLengthMm;
    assert.equal(project.parts[0].geometry?.widthMm, 100);
    assert.equal(project.parts[0].geometry?.heightMm, 50);
  }));

  const res = await handler(request({
    title: "Safe project",
    parts: [{
      clientPartId: "part-1",
      fileIndex: 0,
      materialId: "hot",
      thicknessMm: 2,
      quantity: 5,
      operations: ["bending"],
      cutLengthMm: 999999999,
      directCostRub: 1,
      supplierPrice: 1,
    }],
  }));

  assert.equal(res.status, 200);
  assert.notEqual(serverCutLength, 999999999);
  assert.equal(serverCutLength, 300);
  const json = JSON.stringify(await res.json()).toLowerCase();
  for (const token of ["directcost", "supplierprice", "raterub", "rubperton", "reportid", "storageid", "cutlengthmm"]) {
    assert.equal(json.includes(token), false, `response leaked ${token}`);
  }
});

test("server uses injected authoritative STEP analyzer and keeps private physical evidence out of client response", async () => {
  let analyzerCalled = false;
  const handler = createOnlineCalculationHandler(stepDependencies({
    productionReady: true,
    authoritativePowderAreaM2: 0.812345,
    onAnalysis: (format) => {
      analyzerCalled = true;
      assert.equal(format, "step");
    },
    onRun: (project, _evidence, inputs) => {
      const geometry = project.parts[0].geometry;
      assert.ok(geometry);
      assert.equal(geometry.widthMm, 120);
      assert.equal(geometry.heightMm, 80);
      assert.equal(geometry.cutLengthMm, 400);
      assert.equal(project.parts[0].state, "configurable");
      assert.equal(inputs?.authoritativeFactualByPartId?.["step-part-1"]?.powderAreaM2, 0.812345);
    },
  }));

  const res = await handler(stepRequest({
    ...stepManifest,
    parts: [{
      ...stepManifest.parts[0],
      geometry: { widthMm: 999999, heightMm: 999999, cutLengthMm: 1 },
      directCostRub: 1,
    }],
  }));

  assert.equal(res.status, 200);
  assert.equal(analyzerCalled, true);

  const json = JSON.stringify(await res.json()).toLowerCase();
  for (const token of [
    "flatpatterncandidate",
    "unfoldgeometry",
    "brep",
    "directcost",
    "raterub",
    "rubperton",
    "reportid",
    "storageid",
    "cutlengthmm",
    "powderaream2",
    "authoritativefactual",
  ]) {
    assert.equal(json.includes(token), false, `STEP response leaked ${token}`);
  }
});

test("server withholds STEP geometry and private factual evidence when analyzer marks it not production-ready", async () => {
  const handler = createOnlineCalculationHandler(stepDependencies({
    productionReady: false,
    authoritativePowderAreaM2: 1.25,
    model: stepModel({
      widthMm: 300,
      heightMm: 200,
      depthMm: 40,
      areaMm2: 60000,
      blankAreaMm2: 60000,
      cutLengthMm: 1000,
      contourCount: 1,
      bendCount: 3,
    }, ["Synthetic bent STEP evidence"]),
    onRun: (project, evidence, inputs) => {
      assert.equal(project.parts[0].geometry, null);
      assert.equal(project.parts[0].state, "manual-review");
      assert.ok(evidence["step-part-1"].reviewReasons?.some((reason) => /production-authoritative/i.test(reason)));
      assert.equal(inputs?.authoritativeFactualByPartId?.["step-part-1"], undefined);
    },
  }));

  const res = await handler(stepRequest(stepManifest));
  assert.equal(res.status, 200);
  const body = await res.json() as { calculation?: { parts?: Array<{ status?: string; cad?: { widthMm?: number | null } }> } };
  assert.equal(body.calculation?.parts?.[0]?.status, "needs-review");
  assert.equal(body.calculation?.parts?.[0]?.cad?.widthMm, null);
});

test("STEP analyzer failure fails closed into internal review without production geometry", async () => {
  const handler = createOnlineCalculationHandler(stepDependencies({
    productionReady: false,
    throwAnalysis: true,
    onRun: (project, evidence, inputs) => {
      assert.equal(project.parts[0].geometry, null);
      assert.equal(project.parts[0].state, "manual-review");
      assert.ok(evidence["step-part-1"].reviewReasons?.some((reason) => /OpenCascade/i.test(reason)));
      assert.equal(inputs?.authoritativeFactualByPartId?.["step-part-1"], undefined);
    },
  }));

  const res = await handler(stepRequest(stepManifest, "part.stp"));
  assert.equal(res.status, 200);
  const body = await res.json() as { calculation?: { parts?: Array<{ status?: string }> } };
  assert.equal(body.calculation?.parts?.[0]?.status, "needs-review");
});

test("invalid private operation is rejected before calculation", async () => {
  const handler = createOnlineCalculationHandler(dependencies());
  const res = await handler(request({
    parts: [{
      clientPartId: "part-2",
      fileIndex: 0,
      materialId: "hot",
      thicknessMm: 2,
      quantity: 1,
      operations: ["threading"],
    }],
  }));
  assert.equal(res.status, 400);
  const body = await res.json() as { code?: string };
  assert.equal(body.code, "INVALID_CONFIGURATION");
});

test("server prices a validated STEP blank only with the estimate marker and keeps its warning", async () => {
  const warning = "Additional machining excluded";
  const model = stepModel({ widthMm: 120, heightMm: 80, areaMm2: 9600, blankAreaMm2: 9600,
    cutLengthMm: 400, contourCount: 1, pierceCount: 1, bendCount: 0, bodyCount: 1, volumeMm3: 19008 }, [warning]);
  model.sheetMetal = { source: "brep", status: "candidate", planarFaceCount: 2, cylindricalFaceCount: 0, otherFaceCount: 1,
    thicknessCandidate: { thicknessMm: 2, confidence: "medium", evidencePairs: 1, evidenceFaceIds: ["a", "b"] }, bendCandidates: [], warnings: [] };
  model.preliminaryBlank = { source: "planar-face-preliminary", widthMm: 120, heightMm: 80, areaMm2: 9600,
    blankAreaMm2: 9600, cutLengthMm: 400, contourCount: 1, thicknessMm: 2, removedVolumeFraction: .01,
    excludedOperations: ["edge-finishing"], warning };
  let checked = false;
  const handler = createOnlineCalculationHandler(stepDependencies({ productionReady: false, model,
    onRun: (project, evidence) => {
      checked = true;
      assert.equal(project.parts[0].geometry?.cutLengthMm, 400);
      assert.equal(project.parts[0].state, "manual-review");
      assert.equal(evidence["step-part-1"].preliminaryGeometrySource, "measured-step-blank");
      assert.deepEqual(evidence["step-part-1"].reviewReasons, [warning]);
    },
  }));
  const response = await handler(stepRequest(stepManifest));
  assert.equal(response.status, 200);
  assert.equal(checked, true);
});
