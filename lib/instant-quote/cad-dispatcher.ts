import { validateNormalizedCadModel, type NormalizedCadModel } from "@/lib/instant-quote/cad-model";
import type { CadFormat } from "@/lib/instant-quote/domain";
import { dxfCadAdapter } from "@/lib/instant-quote/dxf-adapter";
import { occtStepKernel } from "@/lib/instant-quote/occt-step-kernel";
import { createStepCadAdapter } from "@/lib/instant-quote/step-adapter";

const stepCadAdapter = createStepCadAdapter(occtStepKernel);

function validated(model: NormalizedCadModel) {
  const validation = validateNormalizedCadModel(model);
  if (!validation.ok) {
    throw new Error(`CAD-модель не прошла внутреннюю проверку: ${validation.errors.join(" ")}`);
  }
  return model;
}

export async function analyzeCadBytes(
  fileName: string,
  format: CadFormat,
  bytes: Uint8Array,
): Promise<NormalizedCadModel> {
  if (format === "dxf") {
    return validated(await dxfCadAdapter.analyze({ fileName, format, bytes }));
  }

  if (format === "step" || format === "stp") {
    return validated(await stepCadAdapter.analyze({ fileName, format, bytes }));
  }

  throw new Error("DWG сохранён в проекте, но authoritative DWG parser пока не подключён.");
}
