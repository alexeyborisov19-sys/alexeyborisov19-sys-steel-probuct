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

      return {
        format: request.format,
        units: "mm",
        geometry: {
          widthMm: flatPattern?.widthMm ?? bounds.size[0],
          heightMm: flatPattern?.heightMm ?? bounds.size[1],
          depthMm: bounds.size[2],
          areaMm2: flatPattern?.areaMm2,
          blankAreaMm2: flatPattern?.blankAreaMm2,
          cutLengthMm: flatPattern?.cutLengthMm,
          contourCount: flatPattern?.contourCount,
          pierceCount: flatPattern?.contourCount,
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
