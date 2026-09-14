import assert from "node:assert/strict";
import test from "node:test";
import { createStepCadAdapter, type StepKernelPort } from "../lib/instant-quote/step-adapter";

const mesh = {
  id: "body-1",
  name: "plate",
  positions: [
    0, 0, 0,
    100, 0, 0,
    100, 50, 0,
    0, 50, 0,
    0, 0, 2,
    100, 0, 2,
    100, 50, 2,
    0, 50, 2,
  ],
  indices: [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6],
};

const kernel: StepKernelPort = {
  id: "fake-occt",
  async readStep() {
    return {
      parserVersion: "test",
      volumeMm3: 100 * 50 * 2,
      meshes: [mesh],
      warnings: ["fixture"],
    };
  },
};

function bentEvidence(issues: string[] = []) {
  return {
    source: "brep" as const,
    thicknessMm: 2,
    panels: [
      { id: "panel-a", sourceFaceIds: ["a-1", "a-2"] as [string, string], centerMm: [0, 0, 0] as [number, number, number], normal: [0, 0, 1] as [number, number, number], areaMm2: 2_000 },
      { id: "panel-b", sourceFaceIds: ["b-1", "b-2"] as [string, string], centerMm: [0, 25, 25] as [number, number, number], normal: [0, 1, 0] as [number, number, number], areaMm2: 1_000 },
      { id: "panel-c", sourceFaceIds: ["c-1", "c-2"] as [string, string], centerMm: [0, 50, 50] as [number, number, number], normal: [0, 0, -1] as [number, number, number], areaMm2: 1_000 },
    ],
    bends: [
      {
        bendId: "bend-1",
        sourceCylinderFaceIds: ["cyl-1i", "cyl-1o"] as [string, string],
        panelIds: ["panel-a", "panel-b"] as [string, string],
        axisStartMm: [0, 0, 0] as [number, number, number],
        axisEndMm: [100, 0, 0] as [number, number, number],
        angleDeg: 90,
        insideRadiusMm: 2,
      },
      {
        bendId: "bend-2",
        sourceCylinderFaceIds: ["cyl-2i", "cyl-2o"] as [string, string],
        panelIds: ["panel-b", "panel-c"] as [string, string],
        axisStartMm: [0, 50, 0] as [number, number, number],
        axisEndMm: [100, 50, 0] as [number, number, number],
        angleDeg: 90,
        insideRadiusMm: 2,
      },
    ],
    issues,
  };
}

test("normalizes STEP kernel output into Steel Product CAD model", async () => {
  const adapter = createStepCadAdapter(kernel);
  const model = await adapter.analyze({
    fileName: "plate.step",
    format: "step",
    bytes: new Uint8Array([1, 2, 3]),
  });

  assert.equal(model.units, "mm");
  assert.equal(model.geometry.widthMm, 100);
  assert.equal(model.geometry.heightMm, 50);
  assert.equal(model.geometry.depthMm, 2);
  assert.equal(model.geometry.bodyCount, 1);
  assert.equal(model.geometry.volumeMm3, 10_000);
  assert.equal(model.geometry.bendCount, undefined);
  assert.equal(model.meshes.length, 1);
  assert.equal(model.metadata.parser, "fake-occt");
  assert.equal(model.metadata.parserVersion, "test");
  assert.deepEqual(model.warnings, ["fixture"]);
});

test("promotes bend count only from clean BRep unfold evidence", async () => {
  const adapter = createStepCadAdapter({
    id: "verified-bends",
    async readStep() {
      return { meshes: [mesh], bodyCount: 1, unfoldGeometry: bentEvidence() };
    },
  });

  const model = await adapter.analyze({ fileName: "bracket.step", format: "step", bytes: new Uint8Array([1]) });
  assert.equal(model.geometry.bendCount, 2);
});

test("does not promote bend count when unfold evidence contains issues", async () => {
  const adapter = createStepCadAdapter({
    id: "ambiguous-bends",
    async readStep() {
      return { meshes: [mesh], bodyCount: 1, unfoldGeometry: bentEvidence(["ambiguous topology"]) };
    },
  });

  const model = await adapter.analyze({ fileName: "bracket.step", format: "step", bytes: new Uint8Array([1]) });
  assert.equal(model.geometry.bendCount, undefined);
});

test("rejects empty or meshless STEP results", async () => {
  const adapter = createStepCadAdapter({
    id: "empty",
    async readStep() { return { meshes: [] }; },
  });

  await assert.rejects(
    adapter.analyze({ fileName: "empty.stp", format: "stp", bytes: new Uint8Array([1]) }),
    /3D-геометрию/,
  );
  await assert.rejects(
    adapter.analyze({ fileName: "empty.stp", format: "stp", bytes: new Uint8Array() }),
    /пустой/,
  );
});
