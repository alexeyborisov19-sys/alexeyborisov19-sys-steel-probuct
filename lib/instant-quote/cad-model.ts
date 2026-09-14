import type { CadFormat, PartGeometrySummary } from "@/lib/instant-quote/domain";

export type CadVector3 = [number, number, number];

export type CadMeshPrimitive = {
  id: string;
  name?: string;
  positions: number[];
  normals?: number[];
  indices: number[];
};

export type CadAssemblyNode = {
  id: string;
  name: string;
  meshIds: string[];
  children: CadAssemblyNode[];
};

export type SheetMetalFeature = {
  id: string;
  kind: "bend" | "hole" | "cutout" | "face" | "edge" | "unknown";
  label?: string;
  angleDeg?: number;
  radiusMm?: number;
  diameterMm?: number;
};

export type NormalizedCadModel = {
  format: CadFormat;
  units: "mm";
  geometry: PartGeometrySummary;
  meshes: CadMeshPrimitive[];
  root: CadAssemblyNode | null;
  features: SheetMetalFeature[];
  metadata: {
    sourceFileName: string;
    sourceBytes: number;
    parser: string;
    parserVersion?: string;
    analyzedAt: string;
  };
  warnings: string[];
};

export type CadAnalysisRequest = {
  fileName: string;
  format: CadFormat;
  bytes: Uint8Array;
};

export interface CadAnalysisAdapter {
  readonly id: string;
  readonly formats: readonly CadFormat[];
  analyze(request: CadAnalysisRequest): Promise<NormalizedCadModel>;
}

export function validateNormalizedCadModel(model: NormalizedCadModel) {
  const errors: string[] = [];
  if (model.units !== "mm") errors.push("Normalized CAD model must use millimetres.");
  if (!model.metadata.sourceFileName) errors.push("Source file name is required.");
  if (!(model.metadata.sourceBytes >= 0)) errors.push("Source byte size is invalid.");
  if (model.geometry.widthMm != null && model.geometry.widthMm < 0) errors.push("Width cannot be negative.");
  if (model.geometry.heightMm != null && model.geometry.heightMm < 0) errors.push("Height cannot be negative.");
  if (model.geometry.depthMm != null && model.geometry.depthMm < 0) errors.push("Depth cannot be negative.");
  if (model.geometry.volumeMm3 != null && model.geometry.volumeMm3 < 0) errors.push("Volume cannot be negative.");
  return { ok: errors.length === 0, errors };
}
