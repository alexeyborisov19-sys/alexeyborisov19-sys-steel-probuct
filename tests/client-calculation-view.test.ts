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
      depthMm: null,
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

test("public calculation projection excludes production economics and process metrics", () => {
  const view = createClientCalculationView(project, [{
    partId: "part-1",
    status: "ready",
    approvedSalePriceRub: null,
  }]);

  assert.equal(view.paymentEnabled, false);
  assert.equal(view.parts[0].price.status, "not-published");
  assert.equal(view.parts[0].cad.widthMm, 500);
  assert.equal(view.parts[0].cad.heightMm, 300);

  const json = JSON.stringify(view).toLowerCase();
  const forbidden = [
    "rateRub".toLowerCase(),
    "rubPerTon".toLowerCase(),
    "directCost".toLowerCase(),
    "internalSubtotal".toLowerCase(),
    "supplier".toLowerCase(),
    "cutLength".toLowerCase(),
    "pierce".toLowerCase(),
    "massKg".toLowerCase(),
    "waste".toLowerCase(),
    "blankArea".toLowerCase(),
    "dfmBlocking".toLowerCase(),
    "reportId".toLowerCase(),
  ];

  for (const token of forbidden) assert.equal(json.includes(token), false, `public DTO leaked ${token}`);
});

test("public projection can expose only an explicitly approved final sale price", () => {
  const view = createClientCalculationView(project, [{
    partId: "part-1",
    status: "ready",
    approvedSalePriceRub: 12345,
  }]);

  assert.deepEqual(view.parts[0].price, { status: "approved", totalRub: 12345 });
});
