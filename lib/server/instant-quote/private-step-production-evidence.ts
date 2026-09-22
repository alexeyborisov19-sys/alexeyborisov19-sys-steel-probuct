import "server-only";
import { readIsolatedStep } from "./step-process-runtime";

export type PrivateStepProductionEvidence = { surfaceAreaMm2: number };

/** Same isolated import as geometry analysis; never add this private value to a browser DTO. */
export async function measurePrivateStepProductionEvidence(bytes: Uint8Array): Promise<PrivateStepProductionEvidence | null> {
  if (!bytes.byteLength) return null;
  const { surfaceAreaMm2 } = await readIsolatedStep(bytes);
  return typeof surfaceAreaMm2 === "number" && Number.isFinite(surfaceAreaMm2) && surfaceAreaMm2 > 0
    ? { surfaceAreaMm2 } : null;
}
