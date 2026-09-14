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

function finiteNonNegative(value: unknown) {
  return value == null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

export function validateNormalizedCadModel(input: unknown) {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["Normalized CAD model must be an object."] };
  }

  const model = input as Partial<NormalizedCadModel>;
  if (model.units !== "mm") errors.push("Normalized CAD model must use millimetres.");
  if (!model.format || !["dxf", "dwg", "step", "stp"].includes(model.format)) errors.push("Normalized CAD format is invalid.");
  if (!model.geometry || typeof model.geometry !== "object") {
    errors.push("Normalized CAD geometry is required.");
  } else {
    if (!finiteNonNegative(model.geometry.widthMm)) errors.push("Width cannot be negative or non-finite.");
    if (!finiteNonNegative(model.geometry.heightMm)) errors.push("Height cannot be negative or non-finite.");
    if (!finiteNonNegative(model.geometry.depthMm)) errors.push("Depth cannot be negative or non-finite.");
    if (!finiteNonNegative(model.geometry.volumeMm3)) errors.push("Volume cannot be negative or non-finite.");
    if (!finiteNonNegative(model.geometry.areaMm2)) errors.push("Area cannot be negative or non-finite.");
    if (!finiteNonNegative(model.geometry.cutLengthMm)) errors.push("Cut length cannot be negative or non-finite.");
  }

  if (!Array.isArray(model.meshes)) errors.push("Normalized CAD meshes must be an array.");
  else {
    for (const mesh of model.meshes) {
      if (!mesh || typeof mesh !== "object" || typeof mesh.id !== "string" || !mesh.id) errors.push("Every CAD mesh requires an id.");
      if (!Array.isArray(mesh.positions) || mesh.positions.length % 3 !== 0 || mesh.positions.some((value) => !Number.isFinite(value))) errors.push("CAD mesh positions must be finite XYZ triples.");
      if (!Array.isArray(mesh.indices) || mesh.indices.length % 3 !== 0 || mesh.indices.some((value) => !Number.isInteger(value) || value < 0)) errors.push("CAD mesh indices must be non-negative triangle triples.");
      const vertexCount = Array.isArray(mesh.positions) ? mesh.positions.length / 3 : 0;
      if (Array.isArray(mesh.indices) && mesh.indices.some((value) => value >= vertexCount)) errors.push("CAD mesh index references a missing vertex.");
      if (mesh.normals && (!Array.isArray(mesh.normals) || mesh.normals.length !== mesh.positions.length || mesh.normals.some((value) => !Number.isFinite(value)))) errors.push("CAD mesh normals must match the position array.");
    }
  }

  if (!Array.isArray(model.features)) errors.push("Normalized CAD features must be an array.");
  if (!Array.isArray(model.warnings) || model.warnings.some((warning) => typeof warning !== "string")) errors.push("Normalized CAD warnings must be a string array.");

  if (!model.metadata || typeof model.metadata !== "object") {
    errors.push("Normalized CAD metadata is required.");
  } else {
    if (typeof model.metadata.sourceFileName !== "string" || !model.metadata.sourceFileName) errors.push("Source file name is required.");
    if (typeof model.metadata.sourceBytes !== "number" || !Number.isFinite(model.metadata.sourceBytes) || model.metadata.sourceBytes < 0) errors.push("Source byte size is invalid.");
    if (typeof model.metadata.parser !== "string" || !model.metadata.parser) errors.push("CAD parser id is required.");
    if (typeof model.metadata.analyzedAt !== "string" || Number.isNaN(Date.parse(model.metadata.analyzedAt))) errors.push("CAD analyzedAt timestamp is invalid.");
  }

  return { ok: errors.length === 0, errors };
}
