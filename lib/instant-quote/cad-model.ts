import type { CadFormat, PartGeometrySummary } from "@/lib/instant-quote/domain";
import type { SheetMetalAnalysis, SheetMetalBoundaryPreview } from "@/lib/instant-quote/sheet-metal";

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
  sheetMetal?: SheetMetalAnalysis;
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

function finitePositive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validateBoundaryPreview(preview: unknown, errors: string[]) {
  if (preview == null) return;
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) {
    errors.push("STEP flat-pattern preview must be an object.");
    return;
  }

  const candidate = preview as Partial<SheetMetalBoundaryPreview>;
  if (candidate.source !== "brep-edge-sampling") errors.push("STEP flat-pattern preview source is invalid.");
  if (candidate.displayOnly !== true) errors.push("STEP flat-pattern preview must be explicitly display-only.");
  if (!Array.isArray(candidate.wires) || candidate.wires.length < 1) {
    errors.push("STEP flat-pattern preview requires at least one wire.");
    return;
  }

  for (const wire of candidate.wires) {
    if (!wire || typeof wire.id !== "string" || !wire.id) errors.push("Every STEP preview wire requires an id.");
    if (!Array.isArray(wire?.edges) || wire.edges.length < 1) {
      errors.push("Every STEP preview wire requires at least one edge.");
      continue;
    }
    for (const edge of wire.edges) {
      if (!edge || typeof edge.id !== "string" || !edge.id) errors.push("Every STEP preview edge requires an id.");
      if (typeof edge?.curveKind !== "string" || !edge.curveKind) errors.push("Every STEP preview edge requires a curve kind.");
      if (!Array.isArray(edge?.pointsMm) || edge.pointsMm.length < 2) {
        errors.push("Every STEP preview edge requires at least two display points.");
        continue;
      }
      for (const point of edge.pointsMm) {
        if (!Array.isArray(point) || point.length !== 2 || point.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
          errors.push("STEP preview points must be finite UV pairs.");
          break;
        }
      }
    }
  }
}

function validateSheetMetalAnalysis(sheetMetal: unknown, errors: string[]) {
  if (sheetMetal == null) return;
  if (!sheetMetal || typeof sheetMetal !== "object" || Array.isArray(sheetMetal)) {
    errors.push("Sheet-metal analysis must be an object.");
    return;
  }

  const analysis = sheetMetal as Partial<SheetMetalAnalysis>;
  if (analysis.source !== "brep") errors.push("Sheet-metal analysis source must be BRep.");
  if (analysis.status !== "candidate" && analysis.status !== "insufficient") errors.push("Sheet-metal analysis status is invalid.");
  if (!Number.isInteger(analysis.planarFaceCount) || (analysis.planarFaceCount ?? -1) < 0) errors.push("Planar face count is invalid.");
  if (!Number.isInteger(analysis.cylindricalFaceCount) || (analysis.cylindricalFaceCount ?? -1) < 0) errors.push("Cylindrical face count is invalid.");
  if (!Number.isInteger(analysis.otherFaceCount) || (analysis.otherFaceCount ?? -1) < 0) errors.push("Other face count is invalid.");
  if (!Array.isArray(analysis.bendCandidates)) errors.push("Sheet-metal bend candidates must be an array.");
  else {
    for (const candidate of analysis.bendCandidates) {
      if (!candidate || typeof candidate.id !== "string" || !candidate.id) errors.push("Every bend candidate requires an id.");
      if (!finitePositive(candidate?.radiusMm)) errors.push("Bend-candidate inner radius must be finite and positive.");
      if (!finitePositive(candidate?.outerRadiusMm)) errors.push("Bend-candidate outer radius must be finite and positive.");
      if (finitePositive(candidate?.radiusMm) && finitePositive(candidate?.outerRadiusMm) && candidate.outerRadiusMm <= candidate.radiusMm) errors.push("Bend-candidate outer radius must exceed the inner radius.");
      if (!finitePositive(candidate?.angleDeg) || candidate.angleDeg > 189) errors.push("Bend-candidate angle must be finite, positive and within the conservative supported range.");
      if (!finitePositive(candidate?.areaMm2)) errors.push("Bend-candidate area must be finite and positive.");
      if (!Array.isArray(candidate?.faceIds) || candidate.faceIds.length !== 2 || candidate.faceIds.some((id) => typeof id !== "string" || !id)) errors.push("Bend candidate must reference exactly two BRep faces.");
    }
  }
  if (!Array.isArray(analysis.warnings) || analysis.warnings.some((warning) => typeof warning !== "string")) errors.push("Sheet-metal warnings must be a string array.");

  if (analysis.thicknessCandidate != null) {
    const candidate = analysis.thicknessCandidate;
    if (!finitePositive(candidate.thicknessMm)) errors.push("Thickness candidate must be finite and positive.");
    if (candidate.confidence !== "low" && candidate.confidence !== "medium") errors.push("Thickness-candidate confidence is invalid.");
    if (!Number.isInteger(candidate.evidencePairs) || candidate.evidencePairs < 1) errors.push("Thickness candidate requires evidence pairs.");
    if (!Array.isArray(candidate.evidenceFaceIds) || candidate.evidenceFaceIds.some((id) => typeof id !== "string" || !id)) errors.push("Thickness candidate evidence face ids are invalid.");
  }

  if (analysis.flatPatternCandidate != null) {
    const flat = analysis.flatPatternCandidate;
    if (flat.source !== "planar-prism") errors.push("Trusted flat pattern must use the planar-prism source.");
    if (flat.confidence !== "high") errors.push("Trusted planar flat pattern must have high confidence.");
    if (typeof flat.faceId !== "string" || !flat.faceId || typeof flat.oppositeFaceId !== "string" || !flat.oppositeFaceId || flat.faceId === flat.oppositeFaceId) errors.push("Trusted flat pattern must reference two distinct BRep faces.");
    if (!finitePositive(flat.widthMm) || !finitePositive(flat.heightMm)) errors.push("Trusted flat-pattern dimensions must be finite and positive.");
    if (!finitePositive(flat.areaMm2) || !finitePositive(flat.blankAreaMm2) || flat.blankAreaMm2 < flat.areaMm2) errors.push("Trusted flat-pattern areas are invalid.");
    if (!finitePositive(flat.cutLengthMm)) errors.push("Trusted flat-pattern cut length must be finite and positive.");
    if (!Number.isInteger(flat.contourCount) || flat.contourCount < 1) errors.push("Trusted flat pattern requires at least one contour.");
    if (typeof flat.volumeConsistencyError !== "number" || !Number.isFinite(flat.volumeConsistencyError) || flat.volumeConsistencyError < 0 || flat.volumeConsistencyError > 0.02) errors.push("Trusted flat-pattern volume consistency is outside the accepted range.");
    if (analysis.thicknessCandidate?.confidence !== "medium") errors.push("Trusted planar flat pattern requires a medium-confidence BRep thickness candidate.");
    if (Array.isArray(analysis.bendCandidates) && analysis.bendCandidates.length > 0) errors.push("Planar-prism flat pattern cannot coexist with bend candidates.");
    const evidenceIds = new Set(analysis.thicknessCandidate?.evidenceFaceIds ?? []);
    if (!evidenceIds.has(flat.faceId) || !evidenceIds.has(flat.oppositeFaceId)) errors.push("Trusted flat-pattern faces must be part of the thickness evidence.");
    validateBoundaryPreview(flat.preview, errors);
  }
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
    if (!finiteNonNegative(model.geometry.thicknessMm)) errors.push("Thickness cannot be negative or non-finite.");
    if (!finiteNonNegative(model.geometry.volumeMm3)) errors.push("Volume cannot be negative or non-finite.");
    if (!finiteNonNegative(model.geometry.areaMm2)) errors.push("Area cannot be negative or non-finite.");
    if (!finiteNonNegative(model.geometry.blankAreaMm2)) errors.push("Blank area cannot be negative or non-finite.");
    if (!finiteNonNegative(model.geometry.nestedAllocatedAreaMm2)) errors.push("Nested allocated area cannot be negative or non-finite.");
    if (!finiteNonNegative(model.geometry.cutLengthMm)) errors.push("Cut length cannot be negative or non-finite.");
    for (const [label, value] of [
      ["Contour count", model.geometry.contourCount],
      ["Pierce count", model.geometry.pierceCount],
      ["Hole count", model.geometry.holeCount],
      ["Bend count", model.geometry.bendCount],
      ["Body count", model.geometry.bodyCount],
    ] as const) {
      if (value != null && (!Number.isInteger(value) || value < 0)) errors.push(`${label} must be a non-negative integer.`);
    }
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
  validateSheetMetalAnalysis(model.sheetMetal, errors);
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
