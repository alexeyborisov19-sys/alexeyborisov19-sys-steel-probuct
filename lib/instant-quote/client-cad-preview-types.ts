import type { CadFormat } from "@/lib/instant-quote/domain";

export type ClientCadMeshPrimitive = {
  id: string;
  name?: string;
  positions: number[];
  normals?: number[];
  indices: number[];
};

export type ClientCadAssemblyNode = {
  id: string;
  name: string;
  meshIds: string[];
  children: ClientCadAssemblyNode[];
};

export type ClientCadPreviewPoint = [number, number];

export type ClientCadPreviewPolyline = {
  points: ClientCadPreviewPoint[];
  closed: boolean;
};

export type ClientCadDrawingPreview = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  widthMm: number;
  heightMm: number;
  polylines: ClientCadPreviewPolyline[];
};

/**
 * Deliberately small public DTO. It contains only display geometry, coarse
 * dimensions and a coarse review state. Production evidence never belongs here.
 */
export type ClientCadPreview = {
  kind: "client-cad-preview";
  format: CadFormat;
  units: "mm";
  cad: {
    widthMm: number | null;
    heightMm: number | null;
    depthMm: number | null;
  };
  meshes: ClientCadMeshPrimitive[];
  root: ClientCadAssemblyNode | null;
  drawing: ClientCadDrawingPreview | null;
  status: "recognized" | "needs-review";
  message: string;
};
