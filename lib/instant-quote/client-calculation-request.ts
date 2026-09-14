import type { InstantQuoteProject, ManufacturingOperation } from "@/lib/instant-quote/domain";
import type { PublicCalculationManifest } from "@/lib/instant-quote/calculation-manifest";
import type { MaterialId } from "@/lib/instant-quote/pricing";

const PUBLIC_OPERATIONS = new Set<ManufacturingOperation>([
  "laser-cutting",
  "bending",
  "welding",
  "assembly",
  "surface-preparation",
  "powder-coating",
  "packaging",
]);

function publicMaterial(value: string | null): MaterialId {
  if (value === "hot" || value === "cold" || value === "zinc") return value;
  return "hot";
}

/**
 * Builds the only configuration manifest sent by the browser.
 * CAD-derived geometry and every internal production/economic metric are
 * intentionally absent; the server re-derives authoritative geometry from the
 * uploaded files.
 */
export function createPublicCalculationManifest(
  project: InstantQuoteProject,
  filePartIds: string[],
): PublicCalculationManifest {
  const fileIndexByPartId = new Map(filePartIds.map((partId, index) => [partId, index]));

  return {
    title: project.title,
    parts: project.parts.map((part) => {
      const fileIndex = fileIndexByPartId.get(part.id);
      if (fileIndex == null) throw new Error(`CAD file is missing for part ${part.id}`);
      const thicknessMm = part.configuration.thicknessMm;
      if (!(thicknessMm && Number.isFinite(thicknessMm) && thicknessMm > 0)) {
        throw new Error(`Thickness is missing for part ${part.id}`);
      }

      return {
        clientPartId: part.id,
        fileIndex,
        materialId: publicMaterial(part.configuration.materialId),
        thicknessMm,
        quantity: Math.max(1, Math.floor(part.configuration.quantity)),
        operations: part.configuration.operations.filter((operation) => PUBLIC_OPERATIONS.has(operation)),
      };
    }),
  };
}

export function createCalculationFormData(
  project: InstantQuoteProject,
  filesByPartId: Record<string, File>,
) {
  const partIds = project.parts.map((part) => part.id);
  const manifest = createPublicCalculationManifest(project, partIds);
  const form = new FormData();
  form.set("manifest", JSON.stringify(manifest));
  for (const partId of partIds) {
    const file = filesByPartId[partId];
    if (!file) throw new Error(`CAD file is missing for part ${partId}`);
    form.append("files", file, file.name);
  }
  return form;
}