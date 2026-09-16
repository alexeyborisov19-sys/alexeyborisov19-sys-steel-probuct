import type {
  CadAnalysisAdapter,
  CadAssemblyNode,
  CadMeshPrimitive,
  NormalizedCadModel,
  SheetMetalFeature,
} from "@/lib/instant-quote/cad-model";
import { calculateMeshBounds } from "@/lib/instant-quote/mesh";
import type { SheetMetalAnalysis } from "@/lib/instant-quote/sheet-metal";
import type { StepUnfoldGeometryEvidence } from "@/lib/instant-quote/unfold-geometry";

export type StepKernelResult = {
  meshes: CadMeshPrimitive[];
  volumeMm3?: number;
  bodyCount?: number;
  root?: CadAssemblyNode | null;
  features?: SheetMetalFeature[];
  sheetMetal?: SheetMetalAnalysis;
  unfoldGeometry?: StepUnfoldGeometryEvidence;
  warnings?: string[];
  parserVersion?: string;
};

/**
 * Narrow boundary between Steel Product and the concrete OpenCascade runtime.
 * A browser/worker implementation may use occt-wasm, while tests can inject a deterministic fake.
 */
export interface StepKernelPort {
  readonly id: string;
  readStep(bytes: Uint8Array): Promise<StepKernelResult>;
}

function verifiedBendCount(result: StepKernelResult, flatPattern: SheetMetalAnalysis["flatPatternCandidate"] | null) {
  // A high-confidence planar-prism reconciliation proves there are no bends in
  // the promoted sheet-metal geometry.
  if (flatPattern?.confidence === "high") return 0;

  const evidence = result.unfoldGeometry;
  if (!evidence || evidence.source !== "brep" || evidence.issues.length > 0 || evidence.bends.length === 0) {
    return undefined;
  }

  const panelIds = new Set(evidence.panels.map((panel) => panel.id));
  const bendIds = new Set<string>();
  for (const bend of evidence.bends) {
    if (bendIds.has(bend.bendId)) return undefined;
    bendIds.add(bend.bendId);
    if (bend.panelIds[0] === bend.panelIds[1]) return undefined;
    if (!panelIds.has(bend.panelIds[0]) || !panelIds.has(bend.panelIds[1])) return undefined;
    if (!(bend.angleDeg > 0 && bend.angleDeg < 180) || !(bend.insideRadiusMm > 0)) return undefined;
  }

  return evidence.bends.length;
}

/**
 * Production geometry for a bent part, measured from the sheet's own surfaces.
 *
 * Only a development that proved its own blank is promoted: the area and cut
 * length are measured, and the sides were reproduced from the bend's extent and
 * the perimeter. Without those sides the part cannot be bought or cut by the
 * numbers, so nothing is promoted and it goes to an engineer, exactly as before.
 */
function promotedBentGeometry(result: StepKernelResult) {
  const development = result.sheetMetal?.development;
  if (development?.status !== "measured") return null;
  if (development.blankWidthMm == null || development.blankHeightMm == null) return null;
  if (!(development.developedAreaMm2 && development.developedAreaMm2 > 0)) return null;
  if (!(development.cutLengthMm && development.cutLengthMm > 0)) return null;
  if (!(development.contourCount && development.contourCount > 0)) return null;
  // Two solids cannot share one blank; the measurement refuses them too, but
  // the price must not depend on that being checked only once.
  if ((result.bodyCount ?? 1) !== 1) return null;

  return {
    widthMm: development.blankWidthMm,
    heightMm: development.blankHeightMm,
    areaMm2: development.developedAreaMm2,
    // Metal is bought by the rectangle around the blank, as it is for a flat
    // part. Here the blank was proved rectangular, so the two coincide.
    blankAreaMm2: development.blankWidthMm * development.blankHeightMm,
    cutLengthMm: development.cutLengthMm,
    contourCount: development.contourCount,
    pierceCount: development.contourCount,
  };
}

export function createStepCadAdapter(kernel: StepKernelPort): CadAnalysisAdapter {
  return {
    id: `steel-product-step:${kernel.id}`,
    formats: ["step", "stp"],

    async analyze(request): Promise<NormalizedCadModel> {
      if (request.format !== "step" && request.format !== "stp") {
        throw new Error("STEP adapter received a non-STEP file.");
      }
      if (!request.bytes.byteLength) throw new Error("STEP-файл пустой.");

      const result = await kernel.readStep(request.bytes);
      if (!result.meshes.length) throw new Error("OpenCascade не вернул 3D-геометрию STEP-файла.");

      const bounds = calculateMeshBounds(result.meshes);
      if (!bounds) throw new Error("Не удалось определить габариты STEP-модели.");

      const flatPattern = result.sheetMetal?.flatPatternCandidate?.confidence === "high"
        ? result.sheetMetal.flatPatternCandidate
        : null;
      // The unfold evidence stays authoritative where it exists. Where it does
      // not, the development's own count fills the gap: it is measured from the
      // same surfaces that proved the blank, and both halves of every bend had
      // to be found for it to be reported at all. Without this a bent part
      // whose blank was fully measured still lost its price, because the count
      // the price needs came from somewhere else entirely.
      const bendCount = verifiedBendCount(result, flatPattern)
        ?? result.sheetMetal?.development?.bendCount;
      // A confirmed flat pattern stays authoritative where it exists; the
      // measured development only fills the case it cannot cover, which is a
      // part with bends in it.
      //
      // The bend count has to be verified too, not just the blank. Pricing a
      // bent part whose bends were not counted would charge for the material
      // and the cutting and silently drop the bending.
      const bent = flatPattern == null && bendCount != null && bendCount > 0
        ? promotedBentGeometry(result)
        : null;

      return {
        format: request.format,
        units: "mm",
        geometry: {
          widthMm: flatPattern?.widthMm ?? bent?.widthMm ?? bounds.size[0],
          heightMm: flatPattern?.heightMm ?? bent?.heightMm ?? bounds.size[1],
          depthMm: bounds.size[2],
          areaMm2: flatPattern?.areaMm2 ?? bent?.areaMm2,
          blankAreaMm2: flatPattern?.blankAreaMm2 ?? bent?.blankAreaMm2,
          cutLengthMm: flatPattern?.cutLengthMm ?? bent?.cutLengthMm,
          contourCount: flatPattern?.contourCount ?? bent?.contourCount,
          pierceCount: flatPattern?.contourCount ?? bent?.pierceCount,
          bendCount,
          bodyCount: result.bodyCount ?? result.meshes.length,
          volumeMm3: result.volumeMm3,
        },
        meshes: result.meshes,
        root: result.root ?? null,
        features: result.features ?? [],
        sheetMetal: result.sheetMetal,
        unfoldGeometry: result.unfoldGeometry,
        metadata: {
          sourceFileName: request.fileName,
          sourceBytes: request.bytes.byteLength,
          parser: kernel.id,
          parserVersion: result.parserVersion,
          analyzedAt: new Date().toISOString(),
        },
        // A high-confidence planar-prism flat pattern has already reconciled
        // opposite faces, thickness evidence, boundary length and solid volume.
        // Keep the raw sheet-metal diagnostics on model.sheetMetal, but do not
        // turn superseded candidate-only messages into commercial-review flags.
        warnings: flatPattern
          ? [...(result.warnings ?? [])]
          : [...(result.warnings ?? []), ...(result.sheetMetal?.warnings ?? [])],
      };
    },
  };
}
