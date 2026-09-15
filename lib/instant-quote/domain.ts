export type CadFormat = "dxf" | "dwg" | "step" | "stp";

export type AnalysisState =
  | "queued"
  | "reading"
  | "geometry-ready"
  | "dfm-review"
  | "configurable"
  | "blocked"
  | "manual-review";

export type ManufacturingOperation =
  | "laser-cutting"
  | "bending"
  | "threading"
  | "countersink"
  | "welding"
  | "assembly"
  | "surface-preparation"
  | "powder-coating"
  | "packaging";

export type PartGeometrySummary = {
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  thicknessMm?: number;
  // Net planar area of the finished 2D part. Used for finished-part mass and process analytics.
  areaMm2?: number;
  // Rectangular purchasing blank around one part. Current Alpha material pricing uses this area.
  blankAreaMm2?: number;
  // Future nesting engine may allocate a real share of sheet stock to the part/batch.
  nestedAllocatedAreaMm2?: number;
  cutLengthMm?: number;
  contourCount?: number;
  pierceCount?: number;
  holeCount?: number;
  bendCount?: number;
  bodyCount?: number;
  volumeMm3?: number;
};

/**
 * Physical quantities a CAD file cannot supply: a DXF carries no bend count,
 * no weld length and no coating-side choice. Without them the matching cost
 * articles cannot be completed.
 */
export type OperationInputs = {
  bendCount?: number;
  weldLengthM?: number;
  powderSides?: 1 | 2;
  surfacePreparationSides?: 1 | 2;
  assemblyMinutes?: number;
};

export type PartConfiguration = {
  materialId: string | null;
  thicknessMm: number | null;
  quantity: number;
  operations: ManufacturingOperation[];
  /** Optional so projects stored before these inputs existed still load. */
  operationInputs?: OperationInputs;
};

export type QuoteState =
  | { kind: "not-requested" }
  | { kind: "unavailable"; reason: string }
  | { kind: "manual"; reason: string }
  | { kind: "calculated"; totalRub: number; unitRub: number; calculatedAt: string };

export type ProjectPart = {
  id: string;
  fileName: string;
  format: CadFormat;
  fileSizeBytes: number;
  createdAt: string;
  state: AnalysisState;
  geometry: PartGeometrySummary | null;
  configuration: PartConfiguration;
  quote: QuoteState;
};

export type InstantQuoteProject = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  activePartId: string | null;
  parts: ProjectPart[];
};

export function createEmptyProject(now = new Date()): InstantQuoteProject {
  const iso = now.toISOString();
  return {
    id: `project-${now.getTime()}`,
    title: "Новый производственный проект",
    createdAt: iso,
    updatedAt: iso,
    activePartId: null,
    parts: [],
  };
}

export function normalizeCadFormat(fileName: string): CadFormat | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "dxf" || ext === "dwg" || ext === "step" || ext === "stp") return ext;
  return null;
}
