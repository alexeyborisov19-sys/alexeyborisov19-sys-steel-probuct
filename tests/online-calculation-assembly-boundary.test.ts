import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { createClientCalculationView } from "../lib/instant-quote/client-calculation-view";
import { resolveEffectiveFactualInputs } from "../lib/instant-quote/factual-input-resolution";
import type { FactualRateBook } from "../lib/instant-quote/factual-calculation";
import { calculateProjectFactualCost } from "../lib/instant-quote/project-factual-calculation";
import { rateLimitStore } from "../lib/security/rate-limit";
import {
  createOnlineCalculationHandler,
  type OnlineCalculationHandlerDependencies,
} from "../lib/server/instant-quote/calculation-handler";

// Synthetic rectangle and rates only. The real handler, manifest parser, DXF
// analysis, factual-input resolver and costing run without private storage or APIs.
const dxf = [
  "0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC",
  "0", "SECTION", "2", "ENTITIES", "0", "LWPOLYLINE", "90", "4", "70", "1",
  "10", "0", "20", "0", "10", "100", "20", "0", "10", "100", "20", "50",
  "10", "0", "20", "50", "0", "ENDSEC", "0", "EOF", "",
].join("\n");
const now = new Date("2099-01-01T12:00:00.000Z");
const source = { id: "assembly-boundary-fixture", label: "Synthetic fixture", confirmedAt: now.toISOString(), note: "Not production rates." };
const rates: FactualRateBook = {
  laserRubPerM: [{ materialId: "cold", thicknessMm: 1, rateRub: 100, pierceRubEach: 1, source }],
  bendRubEach: null,
  weldRubPerM: null,
  powderRubPerM2: null,
  assemblyRubPerHour: { rateRub: 600, source },
};

type RunArguments = Parameters<OnlineCalculationHandlerDependencies["runCalculation"]>;

function fixture() {
  let captured: {
    project: RunArguments[0];
    inputs: RunArguments[2];
    effective: ReturnType<typeof resolveEffectiveFactualInputs>;
    cost: ReturnType<typeof calculateProjectFactualCost>;
  } | undefined;
  let quarantineCalls = 0;
  const handler = createOnlineCalculationHandler({
    inspectUploads: async (files) => [{
      originalName: files[0].name, safeName: "assembly-fixture.dxf", extension: "dxf",
      browserMime: "application/octet-stream", size: files[0].size,
      safety: "unverified-cad", buffer: Buffer.from(await files[0].arrayBuffer()),
    }],
    quarantineUploads: async () => {
      quarantineCalls++;
      return [{ originalName: "assembly-fixture.dxf", safeName: "assembly-fixture.dxf", extension: "dxf",
        browserMime: "application/octet-stream", size: dxf.length, safety: "unverified-cad",
        storageId: "synthetic-only.dxf", antivirus: "clean" }];
    },
    runCalculation: async (project, evidence, inputs) => {
      const effective = resolveEffectiveFactualInputs(project, inputs?.factualByPartId ?? {},
        inputs?.powderSidesByPartId ?? {}, inputs?.authoritativeFactualByPartId ?? {},
        inputs?.surfacePreparationSidesByPartId ?? {});
      const cost = calculateProjectFactualCost(project, evidence, [{
        sourceId: "synthetic-supplier", fetchedAt: now.toISOString(), sourceDate: "2099-01-01", status: "ok",
        rows: [{ materialId: "cold", thicknessMm: 1, rubPerTon: 100000, source: "Synthetic fixture",
          sourceDate: "2099-01-01", fetchedAt: now.toISOString() }],
      }], rates, effective, now);
      captured = { project, inputs, effective, cost };
      return createClientCalculationView(project);
    },
  });
  return {
    handler,
    captured: () => captured,
    quarantineCalls: () => quarantineCalls,
  };
}

function request(assembly: boolean, legacyMinutes?: unknown) {
  const form = new FormData();
  form.set("manifest", JSON.stringify({ title: "Assembly boundary fixture", parts: [{
    clientPartId: "part-1", fileIndex: 0, materialId: "cold", thicknessMm: 1, quantity: 3,
    operations: assembly ? ["assembly"] : [],
    operationInputs: legacyMinutes === undefined ? {} : { assemblyMinutes: legacyMinutes },
  }] }));
  form.append("files", new File([dxf], "assembly-fixture.dxf", { type: "application/octet-stream" }));
  return new Request("https://www.steelprodukt.ru/api/online-order/calculate", {
    method: "POST", headers: { Origin: "https://www.steelprodukt.ru" }, body: form,
  });
}

beforeEach(() => rateLimitStore.clear());

for (const minutes of [undefined, 25, 0, 10_000]) {
  test(`public assembly keeps the factory 10-minute estimate despite legacy input ${String(minutes)}`, async () => {
    const f = fixture();
    const response = await f.handler(request(true, minutes));
    assert.equal(response.status, 200);
    const captured = f.captured();
    assert.ok(captured, "the real handler must reach the costing pipeline");
    const part = captured.project.parts[0];
    assert.deepEqual(part.configuration.operations, ["laser-cutting", "assembly"]);
    assert.equal(part.configuration.operationInputs?.assemblyMinutes, undefined, "the parser must drop legacy factory-time input");
    assert.equal(captured.inputs?.factualByPartId?.[part.id]?.assemblyMinutes, 10);
    assert.equal(captured.effective[part.id].assemblyMinutes, 10);
    const cost = captured.cost.parts[0].calculation;
    assert.ok(cost, "parsed CAD must reach the actual factual-cost calculator");
    assert.equal(cost.parameters.assemblyMinutesEach, 10);
    const assembly = cost.lines.find(line => line.code === "assembly");
    assert.ok(assembly, "selected assembly must remain a priced operation");
    // Independently specified fixture expectation: 600 RUB/hour × 10/60 hour × 3 parts.
    assert.equal(assembly.amountRubEach, 100);
    assert.equal(assembly.amountRubBatch, 300);
    assert.equal(cost.missing.some(item => item.code === "assembly-time"), false);
    const body = await response.json();
    assert.deepEqual(body.calculation.parts[0].configuration.operations, ["laser-cutting", "assembly"]);
    assert.equal(body.calculation.parts[0].configuration.quantity, 3);
    assert.equal(body.calculation.parts[0].cad.widthMm, 100);
    assert.equal(body.calculation.parts[0].cad.heightMm, 50);
    assert.doesNotMatch(JSON.stringify(body), /assemblyMinutes|rateRub|rubPerTon|confirmedDirectCost/);
  });
}

for (const minutes of [undefined, 25]) {
  test(`no selected assembly creates no factory time or charge with legacy input ${String(minutes)}`, async () => {
    const f = fixture();
    const response = await f.handler(request(false, minutes));
    assert.equal(response.status, 200);
    const captured = f.captured();
    assert.ok(captured);
    const part = captured.project.parts[0];
    assert.deepEqual(part.configuration.operations, ["laser-cutting"]);
    assert.equal(part.configuration.operationInputs?.assemblyMinutes, undefined);
    assert.equal(captured.inputs?.factualByPartId?.[part.id]?.assemblyMinutes, undefined);
    assert.equal(captured.effective[part.id]?.assemblyMinutes, undefined);
    const cost = captured.cost.parts[0].calculation;
    assert.ok(cost);
    assert.equal(cost.parameters.assemblyMinutesEach, null);
    assert.equal(cost.lines.some(line => line.code === "assembly"), false);
    assert.equal(cost.missing.some(item => item.code === "assembly-time"), false);
  });
}

for (const minutes of [-1, 10_001, "25", {}]) {
  test(`invalid legacy assembly input ${JSON.stringify(minutes)} is rejected before quarantine or costing`, async () => {
    const f = fixture();
    const response = await f.handler(request(true, minutes));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, "INVALID_CONFIGURATION");
    assert.equal(body.ok, false);
    assert.equal(body.calculation, undefined);
    assert.equal(f.quarantineCalls(), 0);
    assert.equal(f.captured(), undefined);
  });
}
