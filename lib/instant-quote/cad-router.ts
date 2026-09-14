import type { CadAnalysisRequest, NormalizedCadModel } from "@/lib/instant-quote/cad-model";
import type { CadFormat } from "@/lib/instant-quote/domain";
import { dxfCadAdapter } from "@/lib/instant-quote/dxf-adapter";

export class CadAdapterUnavailableError extends Error {
  readonly format: CadFormat;

  constructor(format: CadFormat) {
    super(`Authoritative CAD adapter for ${format.toUpperCase()} is not connected yet.`);
    this.name = "CadAdapterUnavailableError";
    this.format = format;
  }
}

export function cadFormatFromFileName(fileName: string): CadFormat | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "dxf" || extension === "dwg" || extension === "step" || extension === "stp") return extension;
  return null;
}

export async function analyzeCad(request: CadAnalysisRequest): Promise<NormalizedCadModel> {
  if (request.format === "dxf") return dxfCadAdapter.analyze(request);
  throw new CadAdapterUnavailableError(request.format);
}
