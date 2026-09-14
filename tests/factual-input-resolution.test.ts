import assert from "node:assert/strict";
import test from "node:test";
import type { InstantQuoteProject } from "../lib/instant-quote/domain";
import { resolveEffectiveFactualInputs } from "../lib/instant-quote/factual-input-resolution";

function projectWithGeometry(areaMm2?: number): InstantQuoteProject {
  return {
    id: "project-coating",
    title: "Coating fixture",
    createdAt: "2099-01-01T00:00:00.000Z",
    updatedAt: "2099-01-01T00:00:00.000Z",
    activePartId: "part-1",
    parts: [{
      id: "part-1",
      fileName: "part.dxf",
      fileSizeBytes: 100,
      format: "dxf",
      createdAt: "2099-01-01T00:00:00.000Z",
      state: "configurable",
      geometry: {
        widthMm: 1000,
        heightMm: 500,
        areaMm2,
        blankAreaMm2: 500000,
        cutLengthMm: 3000,
      },
      configuration: {
        materialId: "cold",
        thicknessMm: 1,
        quantity: 1,
        operations: ["powder-coating"],
      },
      quote: { kind: "not-requested" },
    }],
  };
}

test("derives powder area only from explicitly selected coating sides and confirmed net area", () => {
  const resolved = resolveEffectiveFactualInputs(projectWithGeometry(400000), {}, { "part-1": 2 });
  assert.equal(resolved["part-1"].powderAreaM2, 0.8);
});

test("keeps explicit technologist powder area authoritative over side-derived area", () => {
  const resolved = resolveEffectiveFactualInputs(
    projectWithGeometry(400000),
    { "part-1": { powderAreaM2: 0.73 } },
    { "part-1": 2 },
  );
  assert.equal(resolved["part-1"].powderAreaM2, 0.73);
});

test("keeps server-authoritative physical area ahead of side-derived fallback", () => {
  const resolved = resolveEffectiveFactualInputs(
    projectWithGeometry(400000),
    {},
    { "part-1": 2 },
    { "part-1": { powderAreaM2: 0.812345 } },
  );
  assert.equal(resolved["part-1"].powderAreaM2, 0.812345);
});

test("allows explicit technologist area to override server-authoritative CAD evidence", () => {
  const resolved = resolveEffectiveFactualInputs(
    projectWithGeometry(400000),
    { "part-1": { powderAreaM2: 0.65 } },
    {},
    { "part-1": { powderAreaM2: 0.812345 } },
  );
  assert.equal(resolved["part-1"].powderAreaM2, 0.65);
});

test("does not derive coating area from bounding blank when net CAD area is unknown", () => {
  const resolved = resolveEffectiveFactualInputs(projectWithGeometry(undefined), {}, { "part-1": 2 });
  assert.equal(resolved["part-1"], undefined);
});

test("keeps DXF coating area unresolved when coating sides are not explicitly selected", () => {
  const resolved = resolveEffectiveFactualInputs(projectWithGeometry(400000), {}, {});
  assert.equal(resolved["part-1"], undefined);
});