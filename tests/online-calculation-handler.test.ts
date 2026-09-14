import assert from "node:assert/strict";
import test from "node:test";
import { createOnlineCalculationHandler } from "../lib/server/instant-quote/calculation-handler";
import type { OnlineCalculationHandlerDependencies } from "../lib/server/instant-quote/calculation-handler";

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
      return {
        kind: "client-calculation",
        projectId: project.id,
        title: project.title,
        paymentEnabled: false,
        parts: project.parts.map((part) => ({
          partId: part.id,
          fileName: part.fileName,
          format: part.format,
          status: "ready" as const,
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
          message: "Внутренний расчёт завершён.",
        })),
      };
    },
  };
}

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
