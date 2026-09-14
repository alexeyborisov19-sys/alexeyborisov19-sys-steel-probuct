import "server-only";

let kernelPromise: Promise<import("occt-wasm").OcctKernel> | null = null;

async function kernel() {
  if (!kernelPromise) {
    kernelPromise = import("occt-wasm").then(({ OcctKernel }) => OcctKernel.init());
  }
  return kernelPromise;
}

export type PrivateStepProductionEvidence = {
  /** Exact OpenCascade boundary surface area of the imported STEP shape. */
  surfaceAreaMm2: number;
};

/**
 * Extracts manufacturing-only STEP evidence in the protected server graph.
 * This value never becomes part of NormalizedCadModel or any browser DTO.
 */
export async function measurePrivateStepProductionEvidence(
  bytes: Uint8Array,
): Promise<PrivateStepProductionEvidence | null> {
  if (!bytes.byteLength) return null;

  const occt = await kernel();
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const shape = occt.importStep(arrayBuffer);

  try {
    const surfaceAreaMm2 = occt.getSurfaceArea(shape);
    if (!Number.isFinite(surfaceAreaMm2) || surfaceAreaMm2 <= 0) return null;
    return { surfaceAreaMm2 };
  } finally {
    occt.release(shape);
  }
}