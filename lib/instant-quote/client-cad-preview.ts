import type {
  CadAssemblyNode,
  CadMeshPrimitive,
  NormalizedCadModel,
} from "@/lib/instant-quote/cad-model";
import type { CadFormat } from "@/lib/instant-quote/domain";

export type ClientCadPreview = {
  kind: "client-cad-preview";
  format: CadFormat;
  units: "mm";
  cad: {
    widthMm: number | null;
    heightMm: number | null;
    depthMm: number | null;
  };
  meshes: CadMeshPrimitive[];
  root: CadAssemblyNode | null;
  status: "recognized" | "needs-review";
  message: string;
};

/**
 * Public CAD analysis may expose only customer-visible preview geometry and
 * coarse bounding dimensions. Production geometry/evidence (cut length,
 * pierces, areas, BRep faces, bend/thickness evidence, unfold data and detailed
 * warnings) must remain inside the confidential calculation boundary.
 */
export function createClientCadPreview(model: NormalizedCadModel): ClientCadPreview {
  const needsReview = model.warnings.length > 0;

  return {
    kind: "client-cad-preview",
    format: model.format,
    units: "mm",
    cad: {
      widthMm: model.geometry.widthMm ?? null,
      heightMm: model.geometry.heightMm ?? null,
      depthMm: model.geometry.depthMm ?? null,
    },
    meshes: model.meshes,
    root: model.root,
    status: needsReview ? "needs-review" : "recognized",
    message: needsReview
      ? "CAD распознан. Требуется внутренняя технологическая проверка."
      : "CAD распознан.",
  };
}
