import assert from "node:assert/strict";
import test from "node:test";
import type { InstantQuoteProject } from "../lib/instant-quote/domain";
import { createClientCalculationView } from "../lib/instant-quote/client-calculation-view";

const project: InstantQuoteProject = {
  id: "project-public-view",
  title: "Client-safe project",
  createdAt: "2099-01-01T00:00:00.000Z",
  updatedAt: "2099-01-01T00:00:00.000Z",
  activePartId: "part-1",
  parts: [{
    id: "part-1",
    fileName: "customer-part.dxf",
    fileSizeBytes: 1234,
    format: "dxf",
    createdAt: "2099-01-01T00:00:00.000Z",
    state: "configurable",
    geometry: {
      widthMm: 500,
      heightMm: 300,
      cutLengthMm: 9876,
      pierceCount: 42,
      areaMm2: 123456,
      blankAreaMm2: 150000,
      bendCount: 7,
    },
    configuration: {
      materialId: "cold",
      thicknessMm: 1,
      quantity: 25,
      operations: ["laser-cutting", "bending", "powder-coating"],
    },
    quote: { kind: "not-requested" },
  }],
};

for (const status of ["ready", "needs-review"] as const) test(`material price date accompanies ${status} prices`, () => {
  const view = createClientCalculationView(project, [{partId:"part-1",status,
    approvedSalePriceRub:status==="ready"?100:null,estimatedSalePriceRub:status==="needs-review"?100:null,
    materialPriceDate:"2026-09-22T10:00:00.000Z"}]);
  assert.equal(view.parts[0].price.materialPriceDate,"2026-09-22");
  assert.match(view.parts[0].message,/2026-09-22/);
});
test("held prices do not display a misleading price date",()=>{
 const view=createClientCalculationView(project,[{partId:"part-1",status:"blocked",approvedSalePriceRub:100,materialPriceDate:"2026-09-22"}]);
 assert.equal(view.parts[0].price.materialPriceDate,undefined);
});
